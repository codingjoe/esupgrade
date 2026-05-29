import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform negative array index access to Array.at(). Converts patterns like
 * arr[arr.length - 1] to arr.at(-1) and arr[arr.length - n] to arr.at(-n).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at
 */
export function negativeIndexToAt(root) {
  let modified = false

  root
    .find(j.MemberExpression)
    .filter(({ node }) => {
      // Must be computed access: expr[...]
      if (!node.computed) {
        return false
      }

      // Property must be a subtraction binary expression
      if (
        !j.BinaryExpression.check(node.property) ||
        node.property.operator !== "-"
      ) {
        return false
      }

      const { left, right } = node.property

      // Left of subtraction must be <expr>.length (non-computed)
      if (
        !j.MemberExpression.check(left) ||
        left.computed ||
        !j.Identifier.check(left.property) ||
        left.property.name !== "length"
      ) {
        return false
      }

      // The object of .length must equal the outer object
      if (!new NodeTest(left.object).isEqual(node.object)) {
        return false
      }

      // Must be a statically verifiable iterable (array literal, new Array, Array.from/of, etc.)
      if (!new NodeTest(node.object).isIterable()) {
        return false
      }

      // Right side must not be a negative literal or unary negation
      if (j.UnaryExpression.check(right) && right.operator === "-") {
        return false
      }

      // Right side must not be zero (arr[arr.length - 0] = arr[arr.length] = undefined)
      if (j.Literal.check(right) && right.value === 0) {
        return false
      }

      return true
    })
    .forEach((path) => {
      const { object, property } = path.node

      j(path).replaceWith(
        j.callExpression(
          j.memberExpression(object, j.identifier("at"), false),
          [j.unaryExpression("-", property.right)],
        ),
      )

      modified = true
    })

  return modified
}
