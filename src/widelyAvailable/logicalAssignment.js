import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

const LOGICAL_TO_ASSIGNMENT = new Map([
  ["??", "??="],
  ["||", "||="],
  ["&&", "&&="],
])

/**
 * Transform logical assignment patterns to logical assignment operators.
 *
 * Transforms:
 * - `x = x ?? y` → `x ??= y`
 * - `x = x || y` → `x ||= y`
 * - `x = x && y` → `x &&= y`
 * - `if (x === null || x === undefined) x = y` → `x ??= y`
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_OR_assignment
 */
export function logicalAssignment(root) {
  let modified = false

  root
    .find(j.AssignmentExpression, { operator: "=" })
    .filter(({ node }) => {
      if (!j.LogicalExpression.check(node.right)) return false
      return new NodeTest(node.left).isEqual(node.right.left)
    })
    .forEach((path) => {
      const { node } = path
      j(path).replaceWith(
        j.assignmentExpression(
          LOGICAL_TO_ASSIGNMENT.get(node.right.operator),
          node.left,
          node.right.right,
        ),
      )
      modified = true
    })

  root
    .find(j.IfStatement)
    .filter(({ node }) => {
      if (node.alternate) return false
      if (!j.LogicalExpression.check(node.test) || node.test.operator !== "||")
        return false

      const leftNullCheck = new NodeTest(node.test.left).getNullCheck()
      const leftUndefinedCheck = new NodeTest(node.test.left).getUndefinedCheck()
      const rightNullCheck = new NodeTest(node.test.right).getNullCheck()
      const rightUndefinedCheck = new NodeTest(node.test.right).getUndefinedCheck()

      const nullCheck = leftNullCheck || rightNullCheck
      const undefinedCheck = leftUndefinedCheck || rightUndefinedCheck

      if (!nullCheck || !undefinedCheck) return false
      if (nullCheck.isNegated || undefinedCheck.isNegated) return false
      if (!new NodeTest(nullCheck.value).isEqual(undefinedCheck.value)) return false

      if (!j.ExpressionStatement.check(node.consequent)) return false
      const { expression } = node.consequent
      if (!j.AssignmentExpression.check(expression) || expression.operator !== "=")
        return false

      return new NodeTest(nullCheck.value).isEqual(expression.left)
    })
    .forEach((path) => {
      const { expression } = path.node.consequent
      j(path).replaceWith(
        j.expressionStatement(
          j.assignmentExpression("??=", expression.left, expression.right),
        ),
      )
      modified = true
    })

  return modified
}

logicalAssignment.baselineDate = new Date(Date.UTC(2021, 3, 26))
