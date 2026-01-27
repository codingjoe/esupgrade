import { default as j } from "jscodeshift"

/**
 * Replace $.inArray(value, array) with array.includes(value).
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function inArrayToIncludes(root) {
  let modified = false

  // Handle call expressions $.inArray(val, arr)
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const callee = node.callee
      if (!callee.property || callee.property.name !== "inArray") return
      const obj = callee.object
      if (!j.Identifier.check(obj)) return
      if (!(obj.name === "$" || obj.name === "jQuery")) return

      const val = node.arguments?.[0]
      const arr = node.arguments?.[1]
      if (!val || !arr) return

      const repl = j.callExpression(j.memberExpression(arr, j.identifier("includes")), [
        val,
      ])
      j(path).replaceWith(repl)
      modified = true
    })

  return modified
}
