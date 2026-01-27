import { default as j } from "jscodeshift"
import { getJQueryInitTarget } from "./utils.js"

/**
 * Replace $(el).css(...) getter/setter with getComputedStyle or el.style assignments.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function cssToStyleAndComputed(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "css") return

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

      // Getter: one string arg -> getComputedStyle(target).prop
      if (node.arguments && node.arguments.length === 1) {
        const arg0 = node.arguments[0]
        if (arg0.type === "Literal" || arg0.type === "StringLiteral") {
          const memberExpr = j.memberExpression(
            j.callExpression(j.identifier("getComputedStyle"), [target]),
            j.identifier(arg0.value),
          )
          j(path).replaceWith(memberExpr)
          modified = true
          return
        }
      }

      // Setter: (prop, value) or ({...})
      if (node.arguments && node.arguments.length === 2) {
        const prop = node.arguments[0]
        const val = node.arguments[1]
        if ((prop.type === "Literal" || prop.type === "StringLiteral") && val) {
          const assign2 = j.assignmentExpression(
            "=",
            j.memberExpression(
              j.memberExpression(target, j.identifier("style")),
              j.identifier(prop.value),
            ),
            val,
          )
          j(path).replaceWith(assign2)
          modified = true
          return
        }
      }

      if (
        node.arguments &&
        node.arguments.length === 1 &&
        node.arguments[0].type === "ObjectExpression"
      ) {
        const props = node.arguments[0].properties
        const stmts = props
          .map((p) => {
            const key = p.key.name || p.key.value || null
            if (!key) return null
            return j.expressionStatement(
              j.assignmentExpression(
                "=",
                j.memberExpression(
                  j.memberExpression(target, j.identifier("style")),
                  j.identifier(key),
                ),
                p.value,
              ),
            )
          })
          .filter(Boolean)
        if (stmts.length > 0) {
          // Check if the parent is an ExpressionStatement
          const parentNodeType = path.parent?.node?.type
          switch (parentNodeType) {
            case "ExpressionStatement":
              j(path.parent).replaceWith(j.blockStatement(stmts))
              break
            default:
              // Wrap in IIFE for expression contexts
              const iifeExpression = j.callExpression(
                j.arrowFunctionExpression([], j.blockStatement(stmts)),
                [],
              )
              j(path).replaceWith(iifeExpression)
              break
          }
          modified = true
          return
        }
      }
    })
  return modified
}
