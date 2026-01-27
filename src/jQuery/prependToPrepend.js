import { default as j } from "jscodeshift"
import { getJQueryInitTarget, isSafeToTransformInitializer } from "./utils.js"

/**
 * Replace $(parent).prepend(child) with parent.prepend(child).
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function prependToPrepend(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "prepend") return

      const obj = member.object
      let parentExpr = null

      if (
        j.CallExpression.check(obj) &&
        j.Identifier.check(obj.callee) &&
        (obj.callee.name === "$" || obj.callee.name === "jQuery")
      ) {
        if (!isSafeToTransformInitializer(root, path.get("callee", "object"))) return
        const arg = obj.arguments?.[0]
        if (!arg) return
        parentExpr = arg
      }

      if (j.Identifier.check(obj)) {
        const target = getJQueryInitTarget(root, obj.name)
        if (!target) return
        parentExpr = target
      }

      if (!parentExpr) return

      const childArg = node.arguments?.[0]
      if (!childArg) return

      const call = j.callExpression(
        j.memberExpression(parentExpr, j.identifier("prepend")),
        [childArg],
      )
      j(path).replaceWith(call)
      modified = true
    })
  return modified
}
