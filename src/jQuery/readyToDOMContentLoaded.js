import { default as j } from "jscodeshift"

/**
 * Transform $(document).ready(fn) to document.addEventListener('DOMContentLoaded', fn) with readyState guard.
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function readyToDOMContentLoaded(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .filter((path) => {
      const node = path.node
      const callee = node.callee
      if (!j.Identifier.check(callee.property)) return false
      if (callee.property.name !== "ready") return false
      // check callee object is $(document) or jQuery(document)
      if (!j.CallExpression.check(callee.object)) return false
      const call = callee.object
      if (!j.Identifier.check(call.callee)) return false
      if (
        (call.callee.name !== "$" && call.callee.name !== "jQuery") ||
        !call.arguments[0]
      )
        return false
      const arg = call.arguments[0]
      return j.Identifier.check(arg) && arg.name === "document"
    })
    .forEach((path) => {
      const fn = path.node.arguments[0]
      const addListenerCall = j.callExpression(
        j.memberExpression(j.identifier("document"), j.identifier("addEventListener")),
        [j.literal("DOMContentLoaded"), fn],
      )

      const testExpr = j.logicalExpression(
        "||",
        j.binaryExpression(
          "===",
          j.memberExpression(j.identifier("document"), j.identifier("readyState")),
          j.literal("complete"),
        ),
        j.binaryExpression(
          "===",
          j.memberExpression(j.identifier("document"), j.identifier("readyState")),
          j.literal("interactive"),
        ),
      )

      const callExpression = j.expressionStatement(j.callExpression(fn, []))
      const consequent = callExpression
      const alternate = j.blockStatement([j.expressionStatement(addListenerCall)])

      const ifStmt = j.ifStatement(testExpr, consequent, alternate)

      // Check if the parent is an ExpressionStatement
      const parentNodeType = path.parent?.node?.type
      switch (parentNodeType) {
        case "ExpressionStatement":
          // Replace the CallExpression directly with IfStatement for statement context
          j(path).replaceWith(ifStmt)
          break
        default:
          // Wrap in IIFE for expression contexts
          const iifeExpression = j.callExpression(
            j.arrowFunctionExpression([], j.blockStatement([ifStmt])),
            [],
          )
          j(path).replaceWith(iifeExpression)
          break
      }
      modified = true
    })
  return modified
}
