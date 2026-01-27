import { default as j } from "jscodeshift"

/**
 * Replace $.map(array, fn) with array.map(fn).
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function staticMapToMap(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const callee = node.callee
      if (!callee.property || callee.property.name !== "map") return

      const obj = callee.object
      if (!j.Identifier.check(obj)) return
      if (!(obj.name === "$" || obj.name === "jQuery")) return

      const arr = node.arguments?.[0]
      const fn = node.arguments?.[1]
      if (!arr || !fn) return

      const repl = j.callExpression(j.memberExpression(arr, j.identifier("map")), [fn])
      j(path).replaceWith(repl)
      modified = true
    })
  return modified
}
