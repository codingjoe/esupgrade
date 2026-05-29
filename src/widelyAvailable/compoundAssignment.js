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
 * - `x = x + 1` (statement) → `x++`
 * - `x = x - 1` (statement) → `x--`
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

      // Transform x = x + 1 → x++ and x = x - 1 → x-- only in statement context,
      // since x++ and x-- return the old value (unlike x += 1 and x -= 1).
      if (
        (op === "+" || op === "-") &&
        j.Literal.check(right) &&
        right.value === 1 &&
        j.ExpressionStatement.check(path.parent.node)
      ) {
        j(path).replaceWith(
          j.updateExpression(op === "+" ? "++" : "--", node.left, false),
        )
      } else {
        j(path).replaceWith(
          j.assignmentExpression(BINARY_TO_COMPOUND.get(op), node.left, right),
        )
      }
      modified = true
    })

  return modified
}

compoundAssignment.baselineDate = new Date(Date.UTC(1997, 5, 1))
