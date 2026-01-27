import { default as j } from "jscodeshift"
import { isJQueryObject } from "./utils.js"

/**
 * Transform $(el).on('event', handler) to el.addEventListener('event', handler).
 * Skip delegated form $(el).on('event', '.selector', handler).
 *
 * Supports local aliases like: const $el = $('#id'); $el.on('click', handler)
 * but avoids transforming global/window-scoped aliases.
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function onToAddEventListener(root) {
  let modified = false

  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "on") return

      // skip delegated events with selector arg (3+ args and second is string)
      if (
        node.arguments.length >= 3 &&
        j.Literal.check(node.arguments[1]) &&
        typeof node.arguments[1].value === "string"
      )
        return

      if (!node.arguments || node.arguments.length < 2) return

      if (!isJQueryObject(root, member.object)) return

      const eventArg = node.arguments[0]
      const handler = node.arguments[1]

      const replacement = j.callExpression(
        j.memberExpression(member.object, j.identifier("addEventListener")),
        [eventArg, handler],
      )

      j(path).replaceWith(replacement)
      modified = true
    })

  return modified
}
