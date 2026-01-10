import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform indexOf() existence checks to includes() method.
 * Converts patterns like arr.indexOf(item) !== -1 to arr.includes(item).
 * Also handles negative checks: arr.indexOf(item) === -1 to !arr.includes(item).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes
 */
export function indexOfToIncludes(root) {
  let modified = false

  root
    .find(j.BinaryExpression)
    .filter((path) => {
      const node = path.node

      // Check for comparison operators: !==, ===, >, >=, <, <=
      if (!["!==", "===", ">", ">=", "<", "<="].includes(node.operator)) {
        return false
      }

      // Check if one side is a .indexOf() call and the other is -1 or 0
      const indexOfInfo = new NodeTest(node).getIndexOfInfo()
      if (!indexOfInfo) {
        return false
      }

      const { indexOfCall, comparisonValue, isLeftIndexOf } = indexOfInfo

      // Only transform if indexOf has exactly 1 argument (the search value)
      // indexOf with fromIndex (2nd argument) has different semantics
      if (!indexOfCall || indexOfCall.arguments.length !== 1) {
        return false
      }

      // Only transform if we can verify the object type is an array or string
      // This ensures both indexOf and includes are available
      const objectNode = indexOfCall.callee.object
      if (!new NodeTest(objectNode).hasIndexOfAndIncludes()) {
        return false
      }

      // Comparison value must be -1 or 0
      const value = new NodeTest(comparisonValue).getNumericValue()
      if (value !== -1 && value !== 0) {
        return false
      }

      // Validate operator with value combinations
      const operator = node.operator
      // For -1 comparisons:
      // - indexOf() !== -1 → includes()
      // - indexOf() === -1 → !includes()
      // - indexOf() > -1 → includes()
      // - indexOf() <= -1 → !includes()
      // For 0 comparisons:
      // - indexOf() >= 0 → includes()
      // - indexOf() < 0 → !includes()

      if (value === -1) {
        if (isLeftIndexOf) {
          // indexOf() !== -1
          if (!["!==", "===", ">", "<="].includes(operator)) {
            return false
          }
        } else {
          // -1 === indexOf()
          if (!["!==", "===", "<", ">="].includes(operator)) {
            return false
          }
        }
      } else if (value === 0) {
        if (isLeftIndexOf) {
          // indexOf() >= 0
          if (![">=", "<"].includes(operator)) {
            return false
          }
        } else {
          // 0 < indexOf()
          if (!["<=", ">"].includes(operator)) {
            return false
          }
        }
      }

      return true
    })
    .forEach((path) => {
      const node = path.node

      // Get indexOf call info using helper
      const indexOfInfo = new NodeTest(node).getIndexOfInfo()
      const { indexOfCall, comparisonValue, isLeftIndexOf } = indexOfInfo

      const operator = node.operator
      const value = new NodeTest(comparisonValue).getNumericValue()

      // Determine if this should be negated
      let shouldNegate = false

      if (value === -1) {
        if (isLeftIndexOf) {
          // indexOf() !== -1
          // Negate for: ===, <=
          shouldNegate = operator === "===" || operator === "<="
        } else {
          // -1 === indexOf()
          // Negate for: ===, >=
          shouldNegate = operator === "===" || operator === ">="
        }
      } else if (value === 0) {
        if (isLeftIndexOf) {
          // indexOf() >= 0
          // Negate for: <
          shouldNegate = operator === "<"
        } else {
          // 0 < indexOf()
          // Negate for: >
          shouldNegate = operator === ">"
        }
      }

      // Create includes() call
      const includesCall = j.callExpression(
        j.memberExpression(indexOfCall.callee.object, j.identifier("includes"), false),
        indexOfCall.arguments,
      )

      // Wrap in negation if needed
      const replacement = shouldNegate
        ? j.unaryExpression("!", includesCall)
        : includesCall

      j(path).replaceWith(replacement)

      modified = true
    })

  return modified
}
