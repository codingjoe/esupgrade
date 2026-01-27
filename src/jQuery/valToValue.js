import { default as j } from "jscodeshift"
import { isJQueryObject } from "./utils.js"

/**
 * Replace $(el).val() getter/setter with el.value access or assignment.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function valToValue(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "val") return

      if (!isJQueryObject(root, member.object)) return

      if (!node.arguments || node.arguments.length === 0) {
        j(path).replaceWith(j.memberExpression(member.object, j.identifier("value")))
        modified = true
        return
      }

      if (node.arguments.length === 1) {
        const assign = j.assignmentExpression(
          "=",
          j.memberExpression(member.object, j.identifier("value")),
          node.arguments[0],
        )
        j(path).replaceWith(assign)
        modified = true
      }
    })
  return modified
}
