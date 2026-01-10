import { default as j } from "jscodeshift"
import { NodeTest, validateChecks } from "../types.js"

/**
 * Transform null/undefined checks to nullish coalescing operator (??).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing
 */
export function nullishCoalescingOperator(root) {
  let modified = false

  root
    .find(j.ConditionalExpression)
    .filter((path) => {
      const node = path.node

      // Test must be a logical AND expression
      if (!j.LogicalExpression.check(node.test) || node.test.operator !== "&&") {
        return false
      }

      const left = node.test.left
      const right = node.test.right

      // Check if left and right are null and undefined checks
      const nullCheck = new NodeTest(left).getNullCheck()
      const undefinedCheck = new NodeTest(right).getUndefinedCheck()

      if (!nullCheck || !undefinedCheck) {
        // Try swapped order
        const nullCheckSwapped = new NodeTest(right).getNullCheck()
        const undefinedCheckSwapped = new NodeTest(left).getUndefinedCheck()

        if (!nullCheckSwapped || !undefinedCheckSwapped) {
          return false
        }

        return validateChecks(nullCheckSwapped, undefinedCheckSwapped, node.consequent)
      }

      return validateChecks(nullCheck, undefinedCheck, node.consequent)
    })
    .forEach((path) => {
      const node = path.node
      const test = node.test
      const left = test.left
      const right = test.right

      // Get the value being checked
      let valueNode
      const nullCheck = new NodeTest(left).getNullCheck()
      const undefinedCheck = new NodeTest(right).getUndefinedCheck()

      if (nullCheck && undefinedCheck) {
        // Normal order: null check on left, undefined check on right
        valueNode = nullCheck.value
      } else {
        // Swapped order: undefined check on left, null check on right
        // The filter guarantees both checks exist in this case
        const nullCheckSwapped = new NodeTest(right).getNullCheck()
        valueNode = nullCheckSwapped.value
      }

      // Create nullish coalescing expression: value ?? default
      const nullishCoalescing = j.logicalExpression("??", valueNode, node.alternate)

      j(path).replaceWith(nullishCoalescing)

      modified = true
    })

  return modified
}
