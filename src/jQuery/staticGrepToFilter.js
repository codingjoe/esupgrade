import { default as j } from "jscodeshift"

/**
 * Replace $.grep(array, fn) with array.filter(fn).
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function staticGrepToFilter(root) {
  let modified = false

  // Find MemberExpression calls like $.grep(arr, fn)
  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "$" },
        property: { type: "Identifier", name: "grep" },
      },
    })
    .forEach((path) => {
      const { node } = path
      const arr = node.arguments?.[0]
      const cb = node.arguments?.[1]
      if (!arr || !cb) return
      // $.grep(array, fn) -> array.filter(fn)
      const replacement = j.callExpression(
        j.memberExpression(arr, j.identifier("filter")),
        [cb],
      )
      j(path).replaceWith(replacement)
      modified = true
    })

  return modified
}
