import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform Array.slice(0) and Array.slice() to array spread syntax.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
 */
export function arraySliceToSpread(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      // Check if this is a .slice() call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "slice"
      ) {
        return false
      }

      // Only transform slice() with no arguments or slice(0)
      if (node.arguments.length === 0) {
        // slice() with no arguments is valid
      } else if (node.arguments.length === 1) {
        // slice(0) is valid
        const arg = node.arguments[0]
        if (!j.Literal.check(arg) || arg.value !== 0) {
          return false
        }
      } else {
        // slice with 2+ arguments is not a copying operation
        return false
      }

      // Only transform if we can verify the object is an iterable
      return new NodeTest(node.callee.object).isIterable()
    })
    .forEach((path) => {
      const node = path.node
      const arrayExpr = node.callee.object

      // Create array with spread element
      const spreadArray = j.arrayExpression([j.spreadElement(arrayExpr)])

      j(path).replaceWith(spreadArray)

      modified = true
    })

  return modified
}
