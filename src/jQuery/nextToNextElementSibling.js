import { default as j } from "jscodeshift"

/**
 * Transform $(el).next() to el.nextElementSibling.
 * When selector string provided, walk nextElementSibling until matches(selector).
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function nextToNextElementSibling(root) {
  let modified = false
  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node
      if (!j.MemberExpression.check(node.callee)) return false
      if (!j.Identifier.check(node.callee.property)) return false
      if (node.callee.property.name !== "next") return false
      const obj = node.callee.object
      if (!j.CallExpression.check(obj)) return false
      if (!j.Identifier.check(obj.callee)) return false
      if (obj.callee.name !== "$" && obj.callee.name !== "jQuery") return false
      // allow no arg or string arg
      if (!node.arguments[0]) return true
      const a0 = node.arguments[0]
      return a0.type === "Literal" || a0.type === "StringLiteral"
    })
    .forEach((path) => {
      const node = path.node
      const target = node.callee.object.arguments[0]
      if (!node.arguments[0]) {
        j(path).replaceWith(
          j.memberExpression(target, j.identifier("nextElementSibling")),
        )
        modified = true
      } else {
        const sel = node.arguments[0]
        // create a small IIFE that finds next matching sibling: (function(n){ while(n && !n.matches(sel)) n = n.nextElementSibling; return n; })(el.nextElementSibling)
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
                        j.identifier("nextElementSibling"),
                      ),
                    ),
                  ),
                ),
                j.returnStatement(j.identifier("n")),
              ]),
            ),
          ),
          [j.memberExpression(target, j.identifier("nextElementSibling"))],
        )
        j(path).replaceWith(iife)
        modified = true
      }
    })
  return modified
}
