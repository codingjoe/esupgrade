import { default as j } from "jscodeshift"

const DECIMAL_LITERAL = /^(?<digits>[1-9]\d{4,})(?<suffix>n)?$/
const HEX_LITERAL = /^(?<prefix>0[xX])(?<digits>[0-9a-fA-F]{3,})(?<suffix>n)?$/
const BINARY_LITERAL = /^(?<prefix>0[bB])(?<digits>[01]{9,})(?<suffix>n)?$/

/**
 * Return a decimal integer literal with numeric separators when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatDecimalLiteral(rawLiteral) {
  const match = rawLiteral.match(DECIMAL_LITERAL)

  if (!match?.groups) {
    return null
  }

  const { digits, suffix = "" } = match.groups

  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, "_")}${suffix}`
}

/**
 * Return a hex literal with byte-level numeric separators when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatHexLiteral(rawLiteral) {
  const match = rawLiteral.match(HEX_LITERAL)

  if (!match?.groups) {
    return null
  }

  const { prefix, digits, suffix = "" } = match.groups

  // Insert `_` before each group of 2 hex chars counted from the right.
  return `${prefix}${digits.replace(/\B(?=([0-9a-fA-F]{2})+(?![0-9a-fA-F]))/g, "_")}${suffix}`
}

/**
 * Return a binary literal with byte-level numeric separators when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatBinaryLiteral(rawLiteral) {
  const match = rawLiteral.match(BINARY_LITERAL)

  if (!match?.groups) {
    return null
  }

  const { prefix, digits, suffix = "" } = match.groups

  // Insert `_` before each group of 8 bits counted from the right.
  return `${prefix}${digits.replace(/\B(?=([01]{8})+(?![01]))/g, "_")}${suffix}`
}

/**
 * Return a numeric literal with separators when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatLiteral(rawLiteral) {
  return (
    formatDecimalLiteral(rawLiteral) ??
    formatHexLiteral(rawLiteral) ??
    formatBinaryLiteral(rawLiteral)
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
