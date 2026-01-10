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
      const node = path.node

      // Check for === or !== operators
      if (!["===", "!=="].includes(node.operator)) {
        return false
      }

      // Check if one side is lastIndexOf() and the other is a subtraction
      let lastIndexOfCall = null
      let comparisonValue = null

      // Check left side for lastIndexOf
      if (
        j.CallExpression.check(node.left) &&
        j.MemberExpression.check(node.left.callee) &&
        j.Identifier.check(node.left.callee.property) &&
        node.left.callee.property.name === "lastIndexOf"
      ) {
        lastIndexOfCall = node.left
        comparisonValue = node.right
      }
      // Check right side for lastIndexOf
      else if (
        j.CallExpression.check(node.right) &&
        j.MemberExpression.check(node.right.callee) &&
        j.Identifier.check(node.right.callee.property) &&
        node.right.callee.property.name === "lastIndexOf"
      ) {
        lastIndexOfCall = node.right
        comparisonValue = node.left
      }

      if (!lastIndexOfCall) {
        return false
      }

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
      return new NodeTest(lastIndexOfCall.callee.object).hasIndexOfAndIncludes()
    })
    .forEach((path) => {
      const node = path.node

      // Determine which side is lastIndexOf (guaranteed by filter to exist)
      let lastIndexOfCall
      if (
        j.CallExpression.check(node.left) &&
        j.MemberExpression.check(node.left.callee) &&
        j.Identifier.check(node.left.callee.property) &&
        node.left.callee.property.name === "lastIndexOf"
      ) {
        lastIndexOfCall = node.left
      } else {
        lastIndexOfCall = node.right
      }

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
