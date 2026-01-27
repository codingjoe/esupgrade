import { default as j } from "jscodeshift"
import { isJQueryObject } from "./utils.js"

/**
 * Transform $(el).addClass('a b') to el.classList.add('a', 'b').
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean} True if modified.
 */
export function addClassToClassList(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "addClass") return
      if (!node.arguments || node.arguments.length !== 1) return

      if (!isJQueryObject(root, member.object)) return

      const arg = node.arguments[0]
      let newArgs = []
      if (
        (arg.type === "Literal" || arg.type === "StringLiteral") &&
        typeof arg.value === "string"
      ) {
        // split on whitespace
        const parts = arg.value.split(/\s+/).filter(Boolean)
        parts.forEach((p) => newArgs.push(j.literal(p)))
      } else {
        newArgs.push(arg)
      }

      const replacement = j.callExpression(
        j.memberExpression(
          j.memberExpression(member.object, j.identifier("classList")),
          j.identifier("add"),
        ),
        newArgs,
      )

      j(path).replaceWith(replacement)
      modified = true
    })
  return modified
}
