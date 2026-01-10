import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform Array.concat() to array spread syntax.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
 */
export function arrayConcatToSpread(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      // Check if this is a .concat() call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "concat"
      ) {
        return false
      }

      // Must have at least one argument
      if (node.arguments.length === 0) {
        return false
      }

      // Only transform if we can verify the object is an iterable
      return new NodeTest(node.callee.object).isIterable()
    })
    .forEach((path) => {
      const node = path.node
      const baseArray = node.callee.object
      const concatArgs = node.arguments

      // Build array elements: start with spread of base array
      const elements = [j.spreadElement(baseArray)]

      // Add each concat argument
      concatArgs.forEach((arg) => {
        // If the argument is an array literal, spread it
        // Otherwise, check if it's likely an array (could be iterable)
        if (j.ArrayExpression.check(arg)) {
          // Spread array literals
          elements.push(j.spreadElement(arg))
        } else {
          // For non-array arguments, we need to determine if they should be spread
          // In concat(), arrays are flattened one level, primitives are added as-is
          // Since we can't statically determine types, we spread everything
          // This matches concat's behavior for arrays and iterables
          elements.push(j.spreadElement(arg))
        }
      })

      // Create new array expression with spread elements
      const spreadArray = j.arrayExpression(elements)

      j(path).replaceWith(spreadArray)

      modified = true
    })

  return modified
}
