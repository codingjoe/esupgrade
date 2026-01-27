import { default as j } from "jscodeshift"

/**
 * Transform $(el).prev() to el.previousElementSibling.
 * When selector string provided, walk previousElementSibling until matches(selector).
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function prevToPreviousElementSibling(root) {
  let modified = false
  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node
      if (!j.MemberExpression.check(node.callee)) return false
      if (!j.Identifier.check(node.callee.property)) return false
      if (node.callee.property.name !== "prev") return false
      const obj = node.callee.object
      if (!j.CallExpression.check(obj)) return false
      if (!j.Identifier.check(obj.callee)) return false
      if (obj.callee.name !== "$" && obj.callee.name !== "jQuery") return false
      if (!node.arguments[0]) return true
      const a0 = node.arguments[0]
      return a0.type === "Literal" || a0.type === "StringLiteral"
    })
    .forEach((path) => {
      const node = path.node
      const target = node.callee.object.arguments[0]
      if (!node.arguments[0]) {
        j(path).replaceWith(
          j.memberExpression(target, j.identifier("previousElementSibling")),
        )
        modified = true
      } else {
        const sel = node.arguments[0]
        const iife = j.callExpression(
          j.parenthesizedExpression(
            j.functionExpression(
              null,
              [j.identifier("n")],
              j.blockStatement([
                j.whileStatement(
                  j.logicalExpression(
                    "&&",
                    j.identifier("n"),
                    j.unaryExpression(
                      "!",
                      j.callExpression(
                        j.memberExpression(j.identifier("n"), j.identifier("matches")),
                        [sel],
                      ),
                    ),
                  ),
                  j.expressionStatement(
                    j.assignmentExpression(
                      "=",
                      j.identifier("n"),
                      j.memberExpression(
                        j.identifier("n"),
                        j.identifier("previousElementSibling"),
                      ),
                    ),
                  ),
                ),
                j.returnStatement(j.identifier("n")),
              ]),
            ),
          ),
          [j.memberExpression(target, j.identifier("previousElementSibling"))],
        )
        j(path).replaceWith(iife)
        modified = true
      }
    })
  return modified
}
