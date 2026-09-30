import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

// Consume each escape sequence or single code unit as one match, so that an
// escaped backslash such as `\\uD83D` never matches the `\uD83D` escape. A
// leading surrogate escape directly followed by a trailing one merges into
// one code point escape.
const RAW_TEXT_ESCAPES =
  /\\(?:u([dD][89abAB][0-9a-fA-F]{2})\\u([dD][c-fC-F][0-9a-fA-F]{2})|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g
const QUOTE_DELIMITED_RAW = /^(["'])[\s\S]*\1$/
const LINE_LEADING_WHITESPACE = /(?:^|(?<=[\n\r]))\s*/g
// recast separates a reprinted node from a following identifier character
// with a space (`riskyAdjoiningCharExp`, node_modules/recast/lib/patcher.js).
const RISKY_ADJOINING_CHARACTER = /[0-9a-z_$]/i

/**
 * Merge a leading and a trailing surrogate escape into one code point escape.
 *
 * @param {string} escapeText - Matched escape sequence or single code unit.
 * @param {string | undefined} leadHex - Hex digits of the leading escape.
 * @param {string | undefined} trailHex - Hex digits of the trailing escape.
 * @returns {string} Code point escape, or the matched text for any other match.
 */
function mergeSurrogatePairEscape(escapeText, leadHex, trailHex) {
  if (leadHex === undefined) {
    return escapeText
  }

  const codePoint = String.fromCharCode(
    Number.parseInt(leadHex, 16),
    Number.parseInt(trailHex, 16),
  ).codePointAt(0)
  const hex = codePoint.toString(16)
  // Preserve the hex case of the leading escape.
  const formattedHex = leadHex === leadHex.toLowerCase() ? hex : hex.toUpperCase()

  return `\\u{${formattedHex}}`
}

/**
 * Replace surrogate pair escapes in raw literal text with code point escapes.
 *
 * @param {string} rawText - Literal text without quotes or backticks.
 * @returns {string | null} Rewritten text, or null when no pair was replaced.
 */
function formatRawText(rawText) {
  const formatted = rawText.replace(RAW_TEXT_ESCAPES, mergeSurrogatePairEscape)

  return formatted === rawText ? null : formatted
}

/**
 * Write the tabs that start a line as `\t` escapes.
 *
 * A reprint re-indents a rewritten literal and expands those tabs into
 * spaces, which changes the value the literal evaluates to.
 *
 * @param {string} reprintedText - Text to reprint: a template quasi, or a string literal with its quotes.
 * @returns {string} Text whose line-leading tabs are written as `\t` escapes.
 */
function escapeLeadingTabs(reprintedText) {
  return reprintedText.replace(LINE_LEADING_WHITESPACE, (whitespace) =>
    whitespace.replaceAll("\t", "\\t"),
  )
}

/**
 * Read the text of a node as written in the source.
 *
 * recast hands its parser a tab-free copy of the source, so a node's raw
 * text and value hide the whitespace a reprint has to keep.
 *
 * @param {import("ast-types").namedTypes.Node} node - Node to read the text of.
 * @returns {string | null} Text as written in the source, or null for a node built by a transform.
 */
function getSourceText(node) {
  return node.loc?.lines
    ? node.loc.lines.sliceString(node.loc.start, node.loc.end)
    : null
}

/**
 * Update a string literal node to use code point escapes.
 *
 * @param {import("ast-types").namedTypes.StringLiteral} literalNode - String literal node to update.
 * @returns {boolean} True when the node changes.
 */
function updateStringLiteral(literalNode) {
  const raw = getSourceText(literalNode)

  // Only a quote-delimited raw holds string literal text to strip.
  if (typeof raw !== "string" || !QUOTE_DELIMITED_RAW.test(raw)) {
    return false
  }

  const formatted = formatRawText(raw.slice(1, -1))

  if (!formatted) {
    return false
  }

  // recast prints a StringLiteral from its value and honors `extra.raw` for a
  // Literal only, so the node is retyped for the raw text to reach the output.
  literalNode.type = "Literal"
  literalNode.extra = {
    ...literalNode.extra,
    raw: escapeLeadingTabs(`${raw[0]}${formatted}${raw[0]}`),
    rawValue: literalNode.value,
  }

  return true
}

/**
 * Tell whether reprinting the quasi would insert a space into the template.
 *
 * recast separates a reprinted node from a following identifier character
 * with a space, and a quasi that precedes `${…}` ends on the `$`.
 *
 * @param {import("ast-types").namedTypes.TemplateLiteral} templateLiteralNode - Template literal that holds the quasi.
 * @param {number} quasiIndex - Index of the quasi.
 * @param {string} reprintedText - Quasi text as it will reprint.
 * @returns {boolean} True when a reprint would change the template value.
 */
function gainsAdjoiningSpace(templateLiteralNode, quasiIndex, reprintedText) {
  return (
    quasiIndex < templateLiteralNode.quasis.length - 1 &&
    RISKY_ADJOINING_CHARACTER.test(reprintedText.slice(-1))
  )
}

/**
 * Update a template literal node to use code point escapes.
 *
 * @param {import("ast-types").namedTypes.TemplateLiteral} templateLiteralNode - Template literal node to update.
 * @returns {boolean} True when a quasi changes.
 */
function updateTemplateLiteral(templateLiteralNode) {
  let modified = false

  templateLiteralNode.quasis.forEach((quasi, quasiIndex) => {
    const formatted = formatRawText(getSourceText(quasi) ?? quasi.value.raw)

    if (!formatted) {
      return
    }

    const reprinted = escapeLeadingTabs(formatted)

    if (gainsAdjoiningSpace(templateLiteralNode, quasiIndex, reprinted)) {
      return
    }

    quasi.value = { ...quasi.value, raw: reprinted }
    modified = true
  })

  return modified
}

/**
 * Transform surrogate pair escapes into Unicode code point escapes.
 *
 * Leaves tagged templates, JSX attribute values, JSX text children, and
 * template parts that end in an identifier character right before `${…}`
 * untouched, where a merge would add a space and change the value.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#unicode_code_point_escapes
 */
export function unicodePointEscapes(root) {
  let modified = false

  root.find(j.Literal).forEach((path) => {
    // JSX text children are source text, and a JSX attribute value keeps its
    // backslashes, so neither is an evaluated string.
    if (
      j.JSXText.check(path.node) ||
      j.JSXAttribute.check(path.parent.node) ||
      !new NodeTest(path.node).isStringLiteral()
    ) {
      return
    }

    modified = updateStringLiteral(path.node) || modified
  })

  root.find(j.TemplateLiteral).forEach((path) => {
    // The raw text of a tagged template is observable through String.raw.
    if (j.TaggedTemplateExpression.check(path.parent.node)) {
      return
    }

    modified = updateTemplateLiteral(path.node) || modified
  })

  return modified
}
unicodePointEscapes.baselineDate = new Date(Date.UTC(2015, 8, 30))
