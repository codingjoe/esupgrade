import { default as j } from "jscodeshift"
import { isJQueryObject } from "./utils.js"

/**
 * Transform $(el).attr(name) to el.getAttribute(name), $(el).attr(name, val) to el.setAttribute(name, val)
 * and $(el).removeAttr(name) to el.removeAttribute(name).
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function attrToGetSetRemove(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property) return
      const name = member.property.name
      if (name !== "attr" && name !== "removeAttr") return
      if (!node.arguments || node.arguments.length < 1) return

      if (!isJQueryObject(root, member.object)) return

      if (name === "attr" && node.arguments.length === 1) {
        // getter
        const replacement = j.callExpression(
          j.memberExpression(member.object, j.identifier("getAttribute")),
          [node.arguments[0]],
        )
        j(path).replaceWith(replacement)
        modified = true
      } else if (name === "attr" && node.arguments.length === 2) {
        const replacement = j.callExpression(
          j.memberExpression(member.object, j.identifier("setAttribute")),
          [node.arguments[0], node.arguments[1]],
        )
        j(path).replaceWith(replacement)
        modified = true
      } else if (name === "removeAttr" && node.arguments.length === 1) {
        const replacement = j.callExpression(
          j.memberExpression(member.object, j.identifier("removeAttribute")),
          [node.arguments[0]],
        )
        j(path).replaceWith(replacement)
        modified = true
      }
    })
  return modified
}
