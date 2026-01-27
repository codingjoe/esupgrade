import { default as j } from "jscodeshift"
import { isSafeToTransformInitializer, getJQueryInitTarget } from "./utils.js"

/**
 * Replace $(el).html() getter/setter with el.innerHTML access or assignment.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function htmlToInnerHTML(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "html") return

      const obj = member.object
      let replacer = null

      if (
        j.CallExpression.check(obj) &&
        j.Identifier.check(obj.callee) &&
        (obj.callee.name === "$" || obj.callee.name === "jQuery")
      ) {
        if (!isSafeToTransformInitializer(root, path.get("callee", "object"))) return
        const arg = obj.arguments?.[0]
        if (!arg) return
        replacer = arg
      }

      if (j.Identifier.check(obj)) {
        const target = getJQueryInitTarget(root, obj.name)
        if (!target) return
        // Prefer the identifier alias to avoid inlining literals or duplicating calls.
        replacer = j.identifier(obj.name)
      }

      if (!replacer) return

      if (!node.arguments || node.arguments.length === 0) {
        j(path).replaceWith(j.memberExpression(replacer, j.identifier("innerHTML")))
        modified = true
        return
      }

      if (node.arguments.length === 1) {
        const assign = j.assignmentExpression(
          "=",
          j.memberExpression(replacer, j.identifier("innerHTML")),
          node.arguments[0],
        )
        j(path).replaceWith(assign)
        modified = true
      }
    })
  return modified
}
