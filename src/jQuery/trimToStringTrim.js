import { default as j } from "jscodeshift"

/**
 * Replace $.trim(str) with str.trim().
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function trimToStringTrim(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const callee = node.callee
      if (!callee.property || callee.property.name !== "trim") return
      const obj = callee.object
      if (!j.Identifier.check(obj)) return
      if (!(obj.name === "$" || obj.name === "jQuery")) return

      const arg = node.arguments?.[0]
      if (!arg) return
      const repl = j.callExpression(j.memberExpression(arg, j.identifier("trim")), [])
      j(path).replaceWith(repl)
      modified = true
    })
  return modified
}
