import { default as j } from "jscodeshift"

const LARGE_DECIMAL_INTEGER_LITERAL = /^(?<digits>[1-9]\d{4,})(?<suffix>n)?$/

/**
 * Return a decimal integer literal with numeric separators when applicable.
 *
 * @param {string} rawLiteral - Raw literal source text.
 * @returns {string | null} Formatted literal or null when no change applies.
 */
function formatNumericLiteral(rawLiteral) {
  const match = rawLiteral.match(LARGE_DECIMAL_INTEGER_LITERAL)

  if (!match?.groups) {
    return null
  }

  const { digits, suffix = "" } = match.groups

  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, "_")}${suffix}`
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
      ? formatNumericLiteral(literalNode.extra.raw)
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
 * Transform large decimal integer literals to use numeric separators.
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
