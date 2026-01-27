import { default as j } from "jscodeshift"

/**
 * Transform $(el).siblings() to Array.from(el.parentElement.children).filter(c => c !== el)
 * When selector provided, also filter by matches(selector).
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function siblingsToSiblingsArray(root) {
  let modified = false
  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node
      if (!j.MemberExpression.check(node.callee)) return false
      if (!j.Identifier.check(node.callee.property)) return false
      if (node.callee.property.name !== "siblings") return false
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
      const childrenExpr = j.memberExpression(
        j.memberExpression(target, j.identifier("parentElement")),
        j.identifier("children"),
      )
      const arrayFrom = j.callExpression(
        j.memberExpression(j.identifier("Array"), j.identifier("from")),
        [childrenExpr],
      )
      if (!node.arguments[0]) {
        const cb = j.arrowFunctionExpression(
          [j.identifier("c")],
          j.binaryExpression("!==", j.identifier("c"), target),
        )
        const filtered = j.callExpression(
          j.memberExpression(arrayFrom, j.identifier("filter")),
          [cb],
        )
        j(path).replaceWith(filtered)
        modified = true
      } else {
        const sel = node.arguments[0]
        const cb = j.arrowFunctionExpression(
          [j.identifier("c")],
          j.logicalExpression(
            "&&",
            j.binaryExpression("!==", j.identifier("c"), target),
            j.callExpression(
              j.memberExpression(j.identifier("c"), j.identifier("matches")),
              [sel],
            ),
          ),
        )
        const filtered = j.callExpression(
          j.memberExpression(arrayFrom, j.identifier("filter")),
          [cb],
        )
        j(path).replaceWith(filtered)
        modified = true
      }
    })
  return modified
}
