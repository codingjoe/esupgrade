import { default as j } from "jscodeshift"
import { getJQueryInitTarget, isSafeToTransformInitializer } from "./utils.js"

/**
 * Transform $(selector).each(function() { ... }) to document.querySelectorAll(selector).forEach(function(el) { ... })
 * Replace `this` references inside the callback with the element parameter.
 * Only transform when callback is a FunctionExpression (not an ArrowFunction) for safety.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function eachToForOf(root) {
  let modified = false

  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "each") return

      const obj = member.object
      let collectionExpr = null

      if (
        j.CallExpression.check(obj) &&
        j.Identifier.check(obj.callee) &&
        (obj.callee.name === "$" || obj.callee.name === "jQuery")
      ) {
        if (!isSafeToTransformInitializer(root, path.get("callee", "object"))) return
        const arg = obj.arguments?.[0]
        if (!arg) return
        collectionExpr = j.callExpression(
          j.memberExpression(
            j.identifier("document"),
            j.identifier("querySelectorAll"),
          ),
          [arg],
        )
      }

      if (j.Identifier.check(obj)) {
        const target = getJQueryInitTarget(root, obj.name)
        if (!target) return
        collectionExpr = j.callExpression(
          j.memberExpression(
            j.identifier("document"),
            j.identifier("querySelectorAll"),
          ),
          [target],
        )
      }

      if (!collectionExpr) return

      const cb = node.arguments?.[0]
      if (!cb) return

      // Only transform FunctionExpression (not ArrowFunctionExpression) for predictable `this` semantics.
      if (!j.FunctionExpression.check(cb)) return

      // Ensure callback parameters don't rely on jQuery's (index, element) ordering.
      // If callback expects two params, skip (conservative).
      if (cb.params && cb.params.length > 1) return

      // Determine element param name. If callback already has one param, reuse it.
      let elParamName = cb.params?.[0]?.name ? cb.params[0].name : null
      if (!elParamName) {
        elParamName = "el"
        cb.params = [j.identifier(elParamName)]
      }

      // Replace `this` occurrences inside callback body with the param identifier.
      j(cb.body)
        .find(j.ThisExpression)
        .forEach((thisPath) => {
          j(thisPath).replaceWith(j.identifier(elParamName))
        })

      // Build forEach call: collectionExpr.forEach(cb)
      const forEachCall = j.callExpression(
        j.memberExpression(collectionExpr, j.identifier("forEach")),
        [cb],
      )
      j(path).replaceWith(forEachCall)
      modified = true
    })

  return modified
}
