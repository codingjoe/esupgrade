import { default as j } from "jscodeshift"
import { isJQueryObject } from "./utils.js"

/**
 * Transform $(el).parent() to el.parentElement.
 * When a string selector is provided, return `p && p.matches(selector) ? p : null`.
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function parentToParentElement(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "parent") return

      // Allow no arguments or string selector argument
      if (node.arguments && node.arguments.length > 0) {
        const a0 = node.arguments[0]
        if (
          !(
            (a0.type === "Literal" && typeof a0.value === "string") ||
            a0.type === "StringLiteral"
          )
        ) {
          return
        }
      }

      if (!isJQueryObject(root, member.object)) return

      if (!node.arguments || node.arguments.length === 0) {
        j(path).replaceWith(
          j.memberExpression(member.object, j.identifier("parentElement")),
        )
        modified = true
      } else {
        const sel = node.arguments[0]
        const p = j.memberExpression(member.object, j.identifier("parentElement"))
        const cond = j.conditionalExpression(
          j.logicalExpression(
            "&&",
            p,
            j.callExpression(j.memberExpression(p, j.identifier("matches")), [sel]),
          ),
          p,
          j.literal(null),
        )
        j(path).replaceWith(cond)
        modified = true
      }
    })

  return modified
}
