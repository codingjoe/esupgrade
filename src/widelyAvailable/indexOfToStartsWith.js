import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform indexOf() prefix checks to startsWith().
 * Converts patterns like str.indexOf(prefix) === 0 to str.startsWith(prefix).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
 */
export function indexOfToStartsWith(root) {
  let modified = false

  root
    .find(j.BinaryExpression)
    .filter((path) => {
      const node = path.node

      // Check for === or !== operators
      if (!["===", "!=="].includes(node.operator)) {
        return false
      }

      // Check if one side is a .indexOf() call and the other is 0
      const indexOfInfo = new NodeTest(node).getIndexOfInfo()
      if (!indexOfInfo) {
        return false
      }

      const { indexOfCall, comparisonValue } = indexOfInfo

      // Only transform if indexOf has exactly 1 argument (the search value)
      if (!indexOfCall || indexOfCall.arguments.length !== 1) {
        return false
      }

      // Only transform if we can verify the object is a string
      const objectNode = indexOfCall.callee.object
      if (!new NodeTest(objectNode).hasIndexOfAndIncludes()) {
        return false
      }

      // Comparison value must be 0
      const value = new NodeTest(comparisonValue).getNumericValue()
      return value === 0
    })
    .forEach((path) => {
      const node = path.node
      const indexOfInfo = new NodeTest(node).getIndexOfInfo()
      const { indexOfCall } = indexOfInfo

      // Create startsWith() call
      const startsWithCall = j.callExpression(
        j.memberExpression(
          indexOfCall.callee.object,
          j.identifier("startsWith"),
          false,
        ),
        indexOfCall.arguments,
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
