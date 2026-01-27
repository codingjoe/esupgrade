import { default as j } from "jscodeshift"
import { isJQueryObject } from "./utils.js"

/**
 * Transform $(el).before(node) -> el.before(node) or insertAdjacentHTML for strings.
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function beforeToBefore(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "before") return

      if (!isJQueryObject(root, member.object)) return

      const arg = node.arguments?.[0]
      if (!arg) return

      if (
        (arg.type === "Literal" || arg.type === "StringLiteral") &&
        typeof arg.value === "string"
      ) {
        const call = j.callExpression(
          j.memberExpression(member.object, j.identifier("insertAdjacentHTML")),
          [j.literal("beforebegin"), arg],
        )
        j(path).replaceWith(call)
        modified = true
        return
      }

      const call = j.callExpression(
        j.memberExpression(member.object, j.identifier("before")),
        [arg],
      )
      j(path).replaceWith(call)
      modified = true
    })
  return modified
}
