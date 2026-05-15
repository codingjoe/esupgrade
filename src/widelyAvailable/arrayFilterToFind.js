import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform Array.filter()[0] to Array.find().
 * Converts patterns like arr.filter(predicate)[0] to arr.find(predicate).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
 */
export function arrayFilterToFind(root) {
  let modified = false

  root
    .find(j.MemberExpression)
    .filter((path) => {
      const node = path.node

      // Must be computed access: expr[0]
      if (!node.computed) {
        return false
      }

      // Property must be literal 0
      if (!j.Literal.check(node.property) || node.property.value !== 0) {
        return false
      }

      // Object must be a .filter() call
      if (!j.CallExpression.check(node.object)) {
        return false
      }

      const filterCall = node.object

      if (
        !j.MemberExpression.check(filterCall.callee) ||
        filterCall.callee.property.name !== "filter"
      ) {
        return false
      }

      // .filter() must have exactly one argument
      if (filterCall.arguments.length !== 1) {
        return false
      }

      // Predicate must be an inline function to avoid transforming side-effectful predicates.
      // Named function references are skipped because their bodies cannot be inspected.
      const predicate = filterCall.arguments[0]
      if (
        !j.ArrowFunctionExpression.check(predicate) &&
        !j.FunctionExpression.check(predicate)
      ) {
        return false
      }

      // Object being filtered must be a known array
      return new NodeTest(filterCall.callee.object).hasIndexOfAndIncludes()
    })
    .forEach((path) => {
      const filterCall = path.node.object

      j(path).replaceWith(
        j.callExpression(
          j.memberExpression(filterCall.callee.object, j.identifier("find"), false),
          filterCall.arguments,
        ),
      )

      modified = true
    })

  return modified
}
