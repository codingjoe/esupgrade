import { default as j } from "jscodeshift"
import { isJQueryObject } from "./utils.js"

/**
 * Transform $(el).closest(selector) to el.closest(selector).
 * Only applies when selector is a string literal.
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function closestToClosest(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "closest") return
      if (!node.arguments || !node.arguments[0]) return

      const arg = node.arguments[0]
      if (
        !(
          (arg.type === "Literal" && typeof arg.value === "string") ||
          arg.type === "StringLiteral"
        )
      ) {
        return
      }

      if (!isJQueryObject(root, member.object)) return

      const replacement = j.callExpression(
        j.memberExpression(member.object, j.identifier("closest")),
        [arg],
      )
      j(path).replaceWith(replacement)
      modified = true
    })
  return modified
}
