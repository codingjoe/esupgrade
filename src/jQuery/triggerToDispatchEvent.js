import { default as j } from "jscodeshift"
import { getJQueryInitTarget } from "./utils.js"

/**
 * Replace $(el).trigger('event') with el.dispatchEvent(new Event('event')).
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function triggerToDispatchEvent(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "trigger") return

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

      const eventArg = node.arguments?.[0]
      if (!eventArg) return

      // If event name is literal, use Event; else fallback to CustomEvent
      if (eventArg.type === "Literal" || eventArg.type === "StringLiteral") {
        const ev = j.newExpression(j.identifier("Event"), [eventArg])
        const dispatch = j.callExpression(
          j.memberExpression(target, j.identifier("dispatchEvent")),
          [ev],
        )
        j(path).replaceWith(dispatch)
        modified = true
        return
      }

      const ev = j.newExpression(j.identifier("CustomEvent"), [eventArg])
      const dispatch = j.callExpression(
        j.memberExpression(target, j.identifier("dispatchEvent")),
        [ev],
      )
      j(path).replaceWith(dispatch)
      modified = true
    })
  return modified
}
