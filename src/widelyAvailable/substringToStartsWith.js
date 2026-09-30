import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform substring() prefix checks to startsWith().
 * Converts patterns like str.substring(0, prefix.length) === prefix to
 * str.startsWith(prefix).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
 */
export function substringToStartsWith(root) {
  let modified = false

  root
    .find(j.BinaryExpression)
    .filter((path) => {
      const { node } = path

      // Check for === or !== operators
      if (!["===", "!=="].includes(node.operator)) {
        return false
      }

      // Check if one side is a .substring() call and the other a comparison value
      const substringInfo = new NodeTest(node).getComparisonCall(["substring"])
      if (!substringInfo) {
        return false
      }

      const { call: substringCall, comparisonValue } = substringInfo

      // Must have exactly 2 arguments
      if (substringCall.arguments.length !== 2) {
        return false
      }

      // First argument must be 0
      const firstArg = substringCall.arguments[0]
      if (new NodeTest(firstArg).getNumericValue() !== 0) {
        return false
      }

      // Second argument must be comparisonValue.length
      const secondArg = substringCall.arguments[1]
      if (
        !j.MemberExpression.check(secondArg) ||
        secondArg.computed ||
        !j.Identifier.check(secondArg.property) ||
        secondArg.property.name !== "length"
      ) {
        return false
      }

      // The object of the length property must match the comparison value
      if (!new NodeTest(secondArg.object).isEqual(comparisonValue)) {
        return false
      }

      // Only transform if we can verify the substring object is a string
      return new NodeTest(substringCall.callee.object, path).hasIndexOfAndIncludes()
    })
    .forEach((path) => {
      const node = path.node

      const substringInfo = new NodeTest(node).getComparisonCall(["substring"])
      const { call: substringCall, comparisonValue } = substringInfo

      // Create startsWith() call
      const startsWithCall = j.callExpression(
        j.memberExpression(
          substringCall.callee.object,
          j.identifier("startsWith"),
          false,
        ),
        [comparisonValue],
      )

      // Wrap in negation if operator is !==
      const replacement =
        node.operator === "!=="
          ? j.unaryExpression("!", startsWithCall)
          : startsWithCall

      j(path).replaceWith(replacement)

      modified = true
    })

  return modified
}
substringToStartsWith.baselineDate = new Date(Date.UTC(2015, 8, 30))
