import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform Array.from(obj) to [...obj] spread syntax. This handles cases like
 * Array.from(obj).map(), .filter(), .some(), etc. that are not covered by the forEach
 * transformer.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
 */
export function arrayFromToSpread(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      // Check if this is Array.from() call
      if (!new NodeTest(node).isArrayStaticCall("from")) {
        return false
      }

      // Must have exactly one argument (the iterable)
      // If there's a second argument (mapping function), we should not transform
      if (node.arguments.length !== 1) {
        return false
      }

      // Don't transform if this is Array.from().forEach()
      // as that's handled by arrayFromForEachToForOf
      const parent = path.parent.node
      if (
        j.MemberExpression.check(parent) &&
        j.Identifier.check(parent.property) &&
        parent.property.name === "forEach"
      ) {
        return false
      }

      return true
    })
    .forEach((path) => {
      const node = path.node
      const iterable = node.arguments[0]

      // Create array with spread element
      const spreadArray = j.arrayExpression([j.spreadElement(iterable)])

      j(path).replaceWith(spreadArray)

      modified = true
    })

  return modified
}
