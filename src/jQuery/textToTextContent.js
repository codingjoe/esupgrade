import { default as j } from "jscodeshift"
import { isJQueryObject, isSafeToTransformInitializer } from "./utils.js"

/**
 * Replace $(el).text() getter/setter with el.textContent access or assignment.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function textToTextContent(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "text") return

      // Check if this is a safe initializer when it's a direct jQuery call
      if (j.CallExpression.check(member.object)) {
        if (!isSafeToTransformInitializer(root, path.get("callee", "object"))) return
      }

      if (!isJQueryObject(root, member.object)) return

      // If no args -> getter
      if (!node.arguments || node.arguments.length === 0) {
        j(path).replaceWith(
          j.memberExpression(member.object, j.identifier("textContent")),
        )
        modified = true
        return
      }

      // Setter when single arg
      if (node.arguments.length === 1) {
        const assign = j.assignmentExpression(
          "=",
          j.memberExpression(member.object, j.identifier("textContent")),
          node.arguments[0],
        )
        j(path).replaceWith(assign)
        modified = true
      }
    })
  return modified
}
