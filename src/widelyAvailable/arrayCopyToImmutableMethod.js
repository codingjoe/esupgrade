import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

const COPYING_METHODS = new Map([
  ["sort", "toSorted"],
  ["reverse", "toReversed"],
  ["splice", "toSpliced"],
])

/**
 * Get the Array by copy method replacing a mutating array method.
 *
 * @param {import("ast-types").ASTNode} callee - The callee of a call expression
 * @returns {string | null} The copying method name or null
 */
function copyingMethodName(callee) {
  if (
    !j.MemberExpression.check(callee) ||
    callee.computed ||
    !j.Identifier.check(callee.property)
  ) {
    return null
  }

  return COPYING_METHODS.get(callee.property.name) ?? null
}

/**
 * Extract the copied array from a `[...array]` expression.
 *
 * @param {import("ast-types").ASTNode} node - The candidate copy expression
 * @returns {import("ast-types").ASTNode | null} The spread argument or null
 */
function spreadCopySource(node) {
  if (
    !j.ArrayExpression.check(node) ||
    node.elements.length !== 1 ||
    !j.SpreadElement.check(node.elements[0]) ||
    !new NodeTest(node.elements[0].argument).isArray()
  ) {
    return null
  }

  return node.elements[0].argument
}

/**
 * Extract the copied array from an `array.slice()` or `array.slice(0)` expression.
 *
 * @param {import("ast-types").ASTNode} node - The candidate copy expression
 * @returns {import("ast-types").ASTNode | null} The slice receiver or null
 */
function sliceCopySource(node) {
  if (
    !j.CallExpression.check(node) ||
    !j.MemberExpression.check(node.callee) ||
    node.callee.computed ||
    !j.Identifier.check(node.callee.property) ||
    node.callee.property.name !== "slice" ||
    node.arguments.length > 1
  ) {
    return null
  }

  const [start] = node.arguments
  if (start && !(j.Literal.check(start) && start.value === 0)) {
    return null
  }

  return new NodeTest(node.callee.object).isArray() ? node.callee.object : null
}

/**
 * Extract the copied array from an array copy expression.
 *
 * @param {import("ast-types").ASTNode} node - The candidate copy expression
 * @returns {import("ast-types").ASTNode | null} The copied array or null
 */
function arrayCopySource(node) {
  return spreadCopySource(node) ?? sliceCopySource(node)
}

/**
 * Check if any expression references an identifier, including nested functions.
 *
 * @param {import("ast-types").ASTNode[]} nodes - The expressions to search
 * @param {string} name - The identifier name to look for
 * @returns {boolean} True if the identifier is referenced
 */
function anyReferencesIdentifier(nodes, name) {
  return nodes.some(
    (node) =>
      (j.Identifier.check(node) && node.name === name) ||
      j(node).find(j.Identifier, { name }).size() > 0,
  )
}

/**
 * Transform array copies followed by a mutating method call into Array by copy methods.
 * Converts `[...array].sort()` to `array.toSorted()` and
 * `const copy = [...array]` followed by `copy.splice(1, 2)` to
 * `const copy = array.toSpliced(1, 2)`.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted
 */
export function arrayCopyToImmutableMethod(root) {
  let modified = false

  root.find(j.CallExpression).forEach((path) => {
    const { node } = path
    const method = copyingMethodName(node.callee)

    if (!method || method === "toSpliced") {
      return
    }

    const source = arrayCopySource(node.callee.object)
    if (!source) {
      return
    }

    j(path).replaceWith(
      j.callExpression(
        j.memberExpression(source, j.identifier(method), false),
        node.arguments,
      ),
    )

    modified = true
  })

  root.find(j.ExpressionStatement).forEach((path) => {
    const { node } = path
    const call = node.expression

    if (!j.CallExpression.check(call) || !j.MemberExpression.check(call.callee)) {
      return
    }

    const method = copyingMethodName(call.callee)
    const copyName = j.Identifier.check(call.callee.object)
      ? call.callee.object.name
      : null

    if (!method || !copyName) {
      return
    }

    const statements = path.parent.node.body
    if (!Array.isArray(statements)) {
      return
    }

    const index = statements.indexOf(node)
    const declaration = statements[index - 1]
    if (
      !j.VariableDeclaration.check(declaration) ||
      declaration.declarations.length !== 1
    ) {
      return
    }

    const [declarator] = declaration.declarations
    if (!j.Identifier.check(declarator.id) || declarator.id.name !== copyName) {
      return
    }

    const source = arrayCopySource(declarator.init)
    if (!source) {
      return
    }

    // an argument referencing the copy lands in the copy's temporal dead zone
    if (anyReferencesIdentifier(call.arguments, copyName)) {
      return
    }

    declarator.init = j.callExpression(
      j.memberExpression(source, j.identifier(method), false),
      call.arguments,
    )
    statements.splice(index, 1)

    modified = true
  })

  return modified
}
arrayCopyToImmutableMethod.baselineDate = new Date(Date.UTC(2023, 6, 4))
