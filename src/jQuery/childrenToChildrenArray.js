import { default as j } from "jscodeshift"
import { getJQueryInitTarget } from "./utils.js"

/**
 * Replace $(el).children() with Array.from(el.children).
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function childrenToChildrenArray(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "children") return

      const obj = member.object
      let target = null

      if (
        j.CallExpression.check(obj) &&
        j.Identifier.check(obj.callee) &&
        (obj.callee.name === "$" || obj.callee.name === "jQuery")
      ) {
        const arg = obj.arguments?.[0]
        if (!arg) return
        target = arg
      }

      if (j.Identifier.check(obj)) {
        target = getJQueryInitTarget(root, obj.name)
        if (!target) return
      }

      if (!target) return

      const call = j.callExpression(j.identifier("Array.from"), [
        j.memberExpression(target, j.identifier("children")),
      ])
      j(path).replaceWith(call)
      modified = true
    })
  return modified
}
