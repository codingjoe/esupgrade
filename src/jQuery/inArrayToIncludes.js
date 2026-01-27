import { default as j } from "jscodeshift"

/**
 * Replace $.inArray(value, array) with array.includes(value).
 * When used in !== -1 comparison, also removes the comparison.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function inArrayToIncludes(root) {
  let modified = false

  // First handle call expressions that are in !== -1 comparisons
  root.find(j.BinaryExpression).forEach((path) => {
    const { node } = path
    if (node.operator !== "!==" || !node.left || !node.right) return

    // Check if right side is -1
    if (
      !(
        (node.right.type === "Literal" && node.right.value === -1) ||
        (node.right.type === "UnaryExpression" &&
          node.right.operator === "-" &&
          node.right.argument.type === "Literal" &&
          node.right.argument.value === 1)
      )
    )
      return

    // Check if left side is $.inArray or jQuery.inArray
    const left = node.left
    if (!j.CallExpression.check(left)) return
    const callee = left.callee
    if (!j.MemberExpression.check(callee)) return
    if (!callee.property || callee.property.name !== "inArray") return
    const obj = callee.object
    if (!j.Identifier.check(obj)) return
    if (!(obj.name === "$" || obj.name === "jQuery")) return

    const val = left.arguments?.[0]
    const arr = left.arguments?.[1]
    if (!val || !arr) return

    // Replace the entire binary expression with just array.includes(value)
    const repl = j.callExpression(j.memberExpression(arr, j.identifier("includes")), [
      val,
    ])
    j(path).replaceWith(repl)
    modified = true
  })

  // Handle standalone call expressions $.inArray(val, arr)
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const callee = node.callee
      if (!callee.property || callee.property.name !== "inArray") return
      const obj = callee.object
      if (!j.Identifier.check(obj)) return
      if (!(obj.name === "$" || obj.name === "jQuery")) return

      const val = node.arguments?.[0]
      const arr = node.arguments?.[1]
      if (!val || !arr) return

      const repl = j.callExpression(j.memberExpression(arr, j.identifier("includes")), [
        val,
      ])
      j(path).replaceWith(repl)
      modified = true
    })

  return modified
}
