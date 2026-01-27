import { default as j } from "jscodeshift"
import { isJQueryObject, isSafeToTransformInitializer } from "./utils.js"

/**
 * Replace $(parent).append(child) with parent.append(child) or innerHTML append for string literals.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function appendToAppend(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "append") return

      // Check if this is a safe initializer when it's a direct jQuery call
      if (j.CallExpression.check(member.object)) {
        if (!isSafeToTransformInitializer(root, path.get("callee", "object"))) return
      }

      if (!isJQueryObject(root, member.object)) return

      const childArg = node.arguments?.[0]
      if (!childArg) return

      if (
        (childArg.type === "Literal" || childArg.type === "StringLiteral") &&
        typeof childArg.value === "string"
      ) {
        // Convert to parent.innerHTML += '...'
        const expr = j.assignmentExpression(
          "+=",
          j.memberExpression(member.object, j.identifier("innerHTML")),
          childArg,
        )
        j(path).replaceWith(expr)
        modified = true
        return
      }

      // Otherwise use parent.append(child)
      const call = j.callExpression(
        j.memberExpression(member.object, j.identifier("append")),
        [childArg],
      )
      j(path).replaceWith(call)
      modified = true
    })
  return modified
}
