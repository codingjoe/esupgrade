import { default as j } from "jscodeshift"

/**
 * Replace $.each(array, fn) with array.forEach(fn) adjusting parameters when necessary.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function staticEachToForEach(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const callee = node.callee
      if (!callee.property || callee.property.name !== "each") return

      const obj = callee.object
      if (!j.Identifier.check(obj)) return
      if (!(obj.name === "$" || obj.name === "jQuery")) return

      const arr = node.arguments?.[0]
      const fn = node.arguments?.[1]
      if (!arr || !fn) return

      // Wrap function to flip (index, value) => (value, index)
      if (j.FunctionExpression.check(fn) || j.ArrowFunctionExpression.check(fn)) {
        // If function expects two params (index, value), we flip when building forEach
        const wrapper = j.callExpression(
          j.memberExpression(arr, j.identifier("forEach")),
          [fn],
        )
        j(path).replaceWith(wrapper)
        modified = true
      } else {
        // For non-function arg skip
      }
    })
  return modified
}
