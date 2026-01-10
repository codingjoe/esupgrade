import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform String.substr() to String.slice().
 * Converts the deprecated substr method to the modern slice method.
 * - str.substr(start, length) → str.slice(start, start + length)
 * - str.substr(start) → str.slice(start)
 * - str.substr() → str.slice()
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/slice
 */
export function substrToSlice(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      // Check if this is a .substr() call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "substr"
      ) {
        return false
      }

      // Only transform if we can verify the object is a string or returns a string
      return new NodeTest(node.callee.object).hasIndexOfAndIncludes()
    })
    .forEach((path) => {
      const node = path.node
      const object = node.callee.object
      const args = node.arguments

      let newArgs

      if (args.length === 0) {
        // substr() → slice()
        newArgs = []
      } else if (args.length === 1) {
        // substr(start) → slice(start)
        newArgs = [args[0]]
      } else {
        // substr(start, length) → slice(start, start + length)
        // This transformation works correctly even for negative start values:
        // - 'hello'.substr(-3, 2) returns 'll' (2 chars from position 5-3=2)
        // - 'hello'.slice(-3, -3 + 2) = slice(-3, -1) returns 'll' (same result)
        const start = args[0]
        const length = args[1]

        // Create start + length expression
        const endExpr = j.binaryExpression("+", start, length)

        newArgs = [start, endExpr]
      }

      // Create slice() call
      const sliceCall = j.callExpression(
        j.memberExpression(object, j.identifier("slice"), false),
        newArgs,
      )

      j(path).replaceWith(sliceCall)

      modified = true
    })

  return modified
}
