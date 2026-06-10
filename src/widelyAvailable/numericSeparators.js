import { default as j } from "jscodeshift"

const MIN_DIGITS_FOR_GROUPING = 5
const TRANSFORMABLE_DECIMAL_INTEGER_LITERAL = new RegExp(
  `^(?<digits>[1-9]\\d{${MIN_DIGITS_FOR_GROUPING - 1},})(?<suffix>n)?$`,
)
const TRANSFORMABLE_OCTAL_LITERAL =
  /^(?<prefix>0[oO])(?<digits>[0-7]{4,})(?<suffix>n)?$/
const TRANSFORMABLE_HEX_LITERAL =
  /^(?<prefix>0[xX])(?<digits>[0-9a-fA-F]{3,})(?<suffix>n)?$/
const TRANSFORMABLE_BINARY_LITERAL =
  /^(?<prefix>0[bB])(?<digits>[01]{9,})(?<suffix>n)?$/
const FLOAT_LITERAL = /^(?<integer>\d+)\.(?<decimal>\d*)$/
const EXPONENTIAL_LITERAL =
  /^(?:(?<mantissaInt>\d+)(?:\.(?<mantissaDec>\d*))?|\.(?<mantissaLeadingDec>\d+))(?<expMarker>[eE])(?<sign>[+-]?)(?<exponent>\d+)$/

/**
 * Apply numeric separators to digit groups counted from the right.
 *
 * @param {string} digits - Digit string without separators.
 * @param {number} groupSize - Number of characters per group.
 * @returns {string} Digits with `_` inserted between right-aligned groups.
 */
function applyDigitGroupSep(digits, groupSize) {
  const firstGroupLength = digits.length % groupSize || groupSize

  return digits.length > groupSize
    ? `${digits.slice(0, firstGroupLength)}_${applyDigitGroupSep(digits.slice(firstGroupLength), groupSize)}`
    : digits
}

/**
 * Return a decimal integer literal with numeric separators when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatDecimalIntegerLiteral(rawLiteral) {
  const match = rawLiteral.match(TRANSFORMABLE_DECIMAL_INTEGER_LITERAL)

  if (!match?.groups) {
    return null
  }

  const { digits, suffix = "" } = match.groups

  return `${applyDigitGroupSep(digits, 3)}${suffix}`
}

/**
 * Return an octal literal with triplet numeric separators when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatOctalLiteral(rawLiteral) {
  const match = rawLiteral.match(TRANSFORMABLE_OCTAL_LITERAL)

  if (!match?.groups) {
    return null
  }

  const { prefix, digits, suffix = "" } = match.groups

  return `${prefix}${applyDigitGroupSep(digits, 3)}${suffix}`
}

/**
 * Return a hex literal with byte-level numeric separators when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatHexLiteral(rawLiteral) {
  const match = rawLiteral.match(TRANSFORMABLE_HEX_LITERAL)

  if (!match?.groups) {
    return null
  }

  const { prefix, digits, suffix = "" } = match.groups

  // Insert `_` before each group of 2 hex chars counted from the right.
  return `${prefix}${applyDigitGroupSep(digits, 2)}${suffix}`
}

/**
 * Return a binary literal with byte-level numeric separators when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatBinaryLiteral(rawLiteral) {
  const match = rawLiteral.match(TRANSFORMABLE_BINARY_LITERAL)

  if (!match?.groups) {
    return null
  }

  const { prefix, digits, suffix = "" } = match.groups

  // Insert `_` before each group of 8 bits counted from the right.
  return `${prefix}${applyDigitGroupSep(digits, 8)}${suffix}`
}

/**
 * Return a float literal with thousands separators on the integer part when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatFloatLiteral(rawLiteral) {
  const match = rawLiteral.match(FLOAT_LITERAL)

  if (!match?.groups) {
    return null
  }

  const { integer, decimal } = match.groups

  if (integer.length < MIN_DIGITS_FOR_GROUPING) {
    return null
  }

  return `${applyDigitGroupSep(integer, 3)}.${decimal}`
}

/**
 * Return an exponential literal with thousands separators on large parts when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatExponentialLiteral(rawLiteral) {
  const match = rawLiteral.match(EXPONENTIAL_LITERAL)

  if (!match?.groups) {
    return null
  }

  const {
    mantissaInt = "",
    mantissaDec,
    mantissaLeadingDec,
    expMarker,
    sign,
    exponent,
  } = match.groups

  const formattedMantissaInt =
    mantissaInt.length >= MIN_DIGITS_FOR_GROUPING
      ? applyDigitGroupSep(mantissaInt, 3)
      : mantissaInt
  const formattedExponent =
    exponent.length >= MIN_DIGITS_FOR_GROUPING
      ? applyDigitGroupSep(exponent, 3)
      : exponent

  if (formattedMantissaInt === mantissaInt && formattedExponent === exponent) {
    return null
  }

  const mantissa =
    typeof mantissaLeadingDec === "string"
      ? `.${mantissaLeadingDec}`
      : typeof mantissaDec === "string"
        ? `${formattedMantissaInt}.${mantissaDec}`
        : formattedMantissaInt

  return `${mantissa}${expMarker}${sign}${formattedExponent}`
}

/**
 * Return a numeric literal with separators when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatLiteral(rawLiteral) {
  return (
    formatDecimalIntegerLiteral(rawLiteral) ??
    formatOctalLiteral(rawLiteral) ??
    formatHexLiteral(rawLiteral) ??
    formatBinaryLiteral(rawLiteral) ??
    formatFloatLiteral(rawLiteral) ??
    formatExponentialLiteral(rawLiteral)
  )
}

/**
 * Update a literal node to use numeric separators.
 *
 * @param {import("ast-types").namedTypes.NumericLiteral | import("ast-types").namedTypes.BigIntLiteral} literalNode - Literal node to update.
 * @returns {boolean} True when the node changes.
 */
function updateNumericLiteral(literalNode) {
  const formattedLiteral =
    typeof literalNode.extra?.raw === "string"
      ? formatLiteral(literalNode.extra.raw)
      : null

  if (!formattedLiteral) {
    return false
  }

  literalNode.extra = {
    ...literalNode.extra,
    raw: formattedLiteral,
  }

  return true
}

/**
 * Transform numeric literals to use numeric separators.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#numeric_separators
 */
export function numericSeparators(root) {
  let modified = false

  root.find(j.NumericLiteral).forEach((path) => {
    modified = updateNumericLiteral(path.node) || modified
  })

  root.find(j.BigIntLiteral).forEach((path) => {
    modified = updateNumericLiteral(path.node) || modified
  })

  return modified
}
numericSeparators.baselineDate = new Date(Date.UTC(2020, 6, 28))
