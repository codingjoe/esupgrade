import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

const COPYING_METHODS = new Map([
  ["sort", "toSorted"],
  ["reverse", "toReversed"],
  ["splice", "toSpliced"],
])
const COPYING_METHOD_NAMES = [...COPYING_METHODS.keys()]

/**
 * Get the Array by copy method replacing a mutating array method.
 *
 * @param {import("ast-types").ASTNode} call - The candidate mutating call
 * @returns {string | null} The copying method name or null
 */
function copyingMethodName(call) {
  if (!new NodeTest(call).isMethodCall(COPYING_METHOD_NAMES)) {
    return null
  }

  return COPYING_METHODS.get(call.callee.property.name)
}

/**
 * Extract the copied array from a `[...array]` expression.
 *
 * @param {import("ast-types").ASTNode} node - The candidate copy expression
 * @param {import("ast-types").NodePath} path - Path of the candidate copy
 *   expression, or of a node inside the same scope
 * @returns {import("ast-types").ASTNode | null} The spread argument or null
 */
function spreadCopySource(node, path) {
  if (
    !j.ArrayExpression.check(node) ||
    node.elements.length !== 1 ||
    !j.SpreadElement.check(node.elements[0]) ||
    !new NodeTest(node.elements[0].argument, path).isArray()
  ) {
    return null
  }

  return node.elements[0].argument
}

/**
 * Extract the copied array from an `array.slice()` or `array.slice(0)` expression.
 *
 * @param {import("ast-types").ASTNode} node - The candidate copy expression
 * @param {import("ast-types").NodePath} path - Path of the candidate copy
 *   expression, or of a node inside the same scope
 * @returns {import("ast-types").ASTNode | null} The slice receiver or null
 */
function sliceCopySource(node, path) {
  if (!new NodeTest(node).isMethodCall(["slice"]) || node.arguments.length > 1) {
    return null
  }

  const [start] = node.arguments
  if (start && !(j.Literal.check(start) && start.value === 0)) {
    return null
  }

  return new NodeTest(node.callee.object, path).isArray() ? node.callee.object : null
}

/**
 * Extract the copied array from an array copy expression.
 *
 * @param {import("ast-types").ASTNode} node - The candidate copy expression
 * @param {import("ast-types").NodePath} path - Path of the candidate copy
 *   expression, or of a node inside the same scope
 * @returns {import("ast-types").ASTNode | null} The copied array or null
 */
function arrayCopySource(node, path) {
  return spreadCopySource(node, path) ?? sliceCopySource(node, path)
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
    const method = copyingMethodName(node)

    if (!method || method === "toSpliced") {
      return
    }

    const source = arrayCopySource(node.callee.object, path)
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
    const method = copyingMethodName(call)

    if (!method) {
      return
    }

    const copyName = j.Identifier.check(call.callee.object)
      ? call.callee.object.name
      : null

    if (!copyName) {
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

    const source = arrayCopySource(declarator.init, path)
    if (!source) {
      return
    }

    // an argument referencing the copy lands in the copy's temporal dead zone
    if (
      call.arguments.some((argument) =>
        new NodeTest(argument).containsIdentifier(copyName, { crossFunctions: true }),
      )
    ) {
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
