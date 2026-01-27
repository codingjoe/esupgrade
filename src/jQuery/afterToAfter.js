import { default as j } from "jscodeshift"
import { getJQueryInitTarget, isSafeToTransformInitializer } from "./utils.js"

/**
 * Replace $(el).after(node) with el.after(node).
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function afterToAfter(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "after") return

      const obj = member.object
      let targetExpr = null

      if (
        j.CallExpression.check(obj) &&
        j.Identifier.check(obj.callee) &&
        (obj.callee.name === "$" || obj.callee.name === "jQuery")
      ) {
        if (!isSafeToTransformInitializer(root, path.get("callee", "object"))) return
        const arg = obj.arguments?.[0]
        if (!arg) return
        targetExpr = arg
      }

      if (j.Identifier.check(obj)) {
        const t = getJQueryInitTarget(root, obj.name)
        if (!t) return
        targetExpr = t
      }

      if (!targetExpr) return

      const arg = node.arguments?.[0]
      if (!arg) return

      const call = j.callExpression(
        j.memberExpression(targetExpr, j.identifier("after")),
        [arg],
      )
      j(path).replaceWith(call)
      modified = true
    })
  return modified
}
