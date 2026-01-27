import { default as j } from "jscodeshift"
import { isJQueryObject } from "./utils.js"

/**
 * Transform $(el).off('event', handler) to el.removeEventListener('event', handler).
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function offToRemoveEventListener(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "off") return
      if (!node.arguments || node.arguments.length < 1) return

      if (!isJQueryObject(root, member.object)) return

      const eventArg = node.arguments[0]
      const handler = node.arguments[1] || j.identifier("undefined")

      const replacement = j.callExpression(
        j.memberExpression(member.object, j.identifier("removeEventListener")),
        [eventArg, handler],
      )

      j(path).replaceWith(replacement)
      modified = true
    })
  return modified
}
