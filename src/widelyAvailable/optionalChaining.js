import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform conditional property access patterns to optional chaining. Converts
 * patterns like:
 *
 * - Obj && obj.prop to obj?.prop
 * - Arr && arr[0] to arr?.[0]
 * - Fn && fn() to fn?.()
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining
 */
export function optionalChaining(root) {
  let modified = false

  function buildOptionalChain(base, accesses) {
    let result = base

    for (const access of accesses) {
      if (j.MemberExpression.check(access)) {
        result = j.optionalMemberExpression(
          result,
          access.property,
          access.computed,
          true,
        )
      } else if (j.CallExpression.check(access)) {
        result = j.optionalCallExpression(result, access.arguments, true)
      }
    }

    return result
  }

  function extractChain(node) {
    const parts = []
    let current = node

    while (j.LogicalExpression.check(current) && current.operator === "&&") {
      parts.unshift(current.right)
      current = current.left
    }
    parts.unshift(current)

    const base = parts[0]
    const accesses = []
    for (let i = 1; i < parts.length; i++) {
      const prev = i === 1 ? base : parts[i - 1]
      if (!new NodeTest(parts[i]).isAccessOnBase(prev)) {
        return null
      }
      accesses.push(parts[i])
    }

    return accesses.length > 0 ? { base, accesses } : null
  }

  // Transform logical && expressions to optional chaining
  root
    .find(j.LogicalExpression, { operator: "&&" })
    .filter((path) => {
      // Only transform if this is the top-level && in the chain
      const parent = path.parent.node
      if (
        j.LogicalExpression.check(parent) &&
        parent.operator === "&&" &&
        parent.left === path.node
      ) {
        return false
      }
      return true
    })
    .forEach((path) => {
      const chain = extractChain(path.node)
      if (!chain) {
        return
      }

      const { base, accesses } = chain
      const optionalExpr = buildOptionalChain(base, accesses)

      j(path).replaceWith(optionalExpr)
      modified = true
    })

  return modified
}
