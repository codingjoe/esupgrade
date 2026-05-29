import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

const BINARY_TO_COMPOUND = new Map([
  ["+", "+="],
  ["-", "-="],
  ["*", "*="],
  ["/", "/="],
  ["%", "%="],
  ["**", "**="],
])

/**
 * Transform verbose assignment patterns to compound assignment operators.
 *
 * Transforms:
 * - `x = x + y` → `x += y`
 * - `x = x - y` → `x -= y`
 * - `x = x * y` → `x *= y`
 * - `x = x / y` → `x /= y`
 * - `x = x % y` → `x %= y`
 * - `x = x ** y` → `x **= y`
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Addition_assignment
 */
export function compoundAssignment(root) {
  let modified = false

  root
    .find(j.AssignmentExpression, { operator: "=" })
    .filter(({ node }) => {
      if (!j.BinaryExpression.check(node.right)) return false
      const op = node.right.operator
      if (!BINARY_TO_COMPOUND.has(op)) return false
      return new NodeTest(node.left).isEqual(node.right.left)
    })
    .forEach((path) => {
      const { node } = path
      const op = node.right.operator
      const right = node.right.right

      j(path).replaceWith(
        j.assignmentExpression(BINARY_TO_COMPOUND.get(op), node.left, right),
      )
      modified = true
    })

  return modified
}

compoundAssignment.baselineDate = new Date(Date.UTC(1997, 5, 1))
