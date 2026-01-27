import { default as j } from "jscodeshift"
import { getJQueryInitTarget } from "./utils.js"

/**
 * Replace $(el).show() / hide() with el.style.display assignments.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function showHideToStyleDisplay(root) {
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
      if (name !== "show" && name !== "hide") return

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

      const value = name === "show" ? j.literal("") : j.literal("none")
      const assign = j.assignmentExpression(
        "=",
        j.memberExpression(
          j.memberExpression(target, j.identifier("style")),
          j.identifier("display"),
        ),
        value,
      )
      j(path).replaceWith(assign)
      modified = true
    })
  return modified
}
