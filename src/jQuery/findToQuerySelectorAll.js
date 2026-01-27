import { default as j } from "jscodeshift"
import { getJQueryInitTarget } from "./utils.js"

/**
 * Transform $(root).find(selector) to root.querySelectorAll(selector).
 * Only applies when the argument is a string literal.
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function findToQuerySelectorAll(root) {
  let modified = false
  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node
      if (!j.MemberExpression.check(node.callee)) return false
      if (!j.Identifier.check(node.callee.property)) return false
      if (node.callee.property.name !== "find") return false
      const obj = node.callee.object
      let resolvedTarget = null
      if (j.CallExpression.check(obj)) {
        if (!j.Identifier.check(obj.callee)) return false
        if (obj.callee.name !== "$" && obj.callee.name !== "jQuery") return false
        resolvedTarget = obj.arguments[0]
      } else if (j.Identifier.check(obj)) {
        const arg = getJQueryInitTarget(root, obj.name)
        if (!arg) return false
        resolvedTarget = arg
      } else {
        return false
      }
      if (!node.arguments[0]) return false
      const arg = node.arguments[0]
      if (
        !(
          (arg.type === "Literal" && typeof arg.value === "string") ||
          arg.type === "StringLiteral"
        )
      )
        return false
      path.__resolvedTarget = resolvedTarget
      return true
    })
    .forEach((path) => {
      const node = path.node
      const target = path.__resolvedTarget || node.callee.object.arguments[0]
      const selector = node.arguments[0]
      const replacement = j.callExpression(
        j.memberExpression(target, j.identifier("querySelectorAll")),
        [selector],
      )
      j(path).replaceWith(replacement)
      modified = true
    })
  return modified
}
