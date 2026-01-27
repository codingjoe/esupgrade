import { default as j } from "jscodeshift"
import { isJQueryObject } from "./utils.js"

/**
 * Transform $(el).toggleClass('a') to el.classList.toggle('a').
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function toggleClassToClassList(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "toggleClass") return
      if (!node.arguments || node.arguments.length !== 1) return

      if (!isJQueryObject(root, member.object)) return

      const replacement = j.callExpression(
        j.memberExpression(
          j.memberExpression(member.object, j.identifier("classList")),
          j.identifier("toggle"),
        ),
        node.arguments,
      )

      j(path).replaceWith(replacement)
      modified = true
    })
  return modified
}
