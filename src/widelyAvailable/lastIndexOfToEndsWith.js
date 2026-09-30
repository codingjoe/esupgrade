import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform lastIndexOf() suffix checks to endsWith().
 * Converts patterns like str.lastIndexOf(suffix) === str.length - suffix.length to
 * str.endsWith(suffix).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
 */
export function lastIndexOfToEndsWith(root) {
  let modified = false

  root
    .find(j.BinaryExpression)
    .filter((path) => {
      const { node } = path

      // Check for === or !== operators
      if (!["===", "!=="].includes(node.operator)) {
        return false
      }

      // Check if one side is a .lastIndexOf() call and the other is a subtraction
      const lastIndexOfInfo = new NodeTest(node).getComparisonCall(["lastIndexOf"])
      if (!lastIndexOfInfo) {
        return false
      }

      const { call: lastIndexOfCall, comparisonValue } = lastIndexOfInfo

      // Only transform if lastIndexOf has exactly 1 argument (the search value)
      if (lastIndexOfCall.arguments.length !== 1) {
        return false
      }

      const searchValue = lastIndexOfCall.arguments[0]

      // Comparison value must be a binary expression: str.length - suffix.length
      if (!j.BinaryExpression.check(comparisonValue)) {
        return false
      }

      if (comparisonValue.operator !== "-") {
        return false
      }

      // Left side of subtraction must be str.length
      if (
        !j.MemberExpression.check(comparisonValue.left) ||
        comparisonValue.left.computed ||
        !j.Identifier.check(comparisonValue.left.property) ||
        comparisonValue.left.property.name !== "length"
      ) {
        return false
      }

      // The object of str.length must match the lastIndexOf object
      if (
        !new NodeTest(comparisonValue.left.object).isEqual(
          lastIndexOfCall.callee.object,
        )
      ) {
        return false
      }

      // Right side of subtraction must be suffix.length
      if (
        !j.MemberExpression.check(comparisonValue.right) ||
        !j.Identifier.check(comparisonValue.right.property) ||
        comparisonValue.right.property.name !== "length"
      ) {
        return false
      }

      // The object of suffix.length must match the search value
      if (!new NodeTest(comparisonValue.right.object).isEqual(searchValue)) {
        return false
      }

      // Only transform if we can verify the object is a string
      return new NodeTest(lastIndexOfCall.callee.object, path).hasIndexOfAndIncludes()
    })
    .forEach((path) => {
      const node = path.node

      const lastIndexOfInfo = new NodeTest(node).getComparisonCall(["lastIndexOf"])
      const { call: lastIndexOfCall } = lastIndexOfInfo

      // Create endsWith() call
      const endsWithCall = j.callExpression(
        j.memberExpression(
          lastIndexOfCall.callee.object,
          j.identifier("endsWith"),
          false,
        ),
        lastIndexOfCall.arguments,
      )

      // Wrap in negation if operator is !==
      const replacement =
        node.operator === "!==" ? j.unaryExpression("!", endsWithCall) : endsWithCall

      j(path).replaceWith(replacement)

      modified = true
    })

  return modified
}
lastIndexOfToEndsWith.baselineDate = new Date(Date.UTC(2015, 8, 30))
