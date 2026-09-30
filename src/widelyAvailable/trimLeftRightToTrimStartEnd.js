import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

const TRIM_METHOD_RENAMES = new Map([
  ["trimLeft", "trimStart"],
  ["trimRight", "trimEnd"],
])

/**
 * Transform String.prototype.trimLeft() and String.prototype.trimRight() to
 * the standard trimStart() and trimEnd() methods.
 * - str.trimLeft() → str.trimStart()
 * - str.trimRight() → str.trimEnd()
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trimStart
 */
export function trimLeftRightToTrimStartEnd(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter(({ node }) => {
      // Skip optional chained calls: value?.trimLeft()
      if (
        j.OptionalCallExpression.check(node) ||
        j.OptionalMemberExpression.check(node.callee)
      ) {
        return false
      }

      // Check if this is a .trimLeft() or .trimRight() call
      if (
        !j.MemberExpression.check(node.callee) ||
        node.callee.computed ||
        !j.Identifier.check(node.callee.property) ||
        !TRIM_METHOD_RENAMES.has(node.callee.property.name)
      ) {
        return false
      }

      // Only transform if the object is a known string
      return new NodeTest(node.callee.object).hasIndexOfAndIncludes()
    })
    .forEach(({ node }) => {
      // Rename the deprecated alias to the standard method name
      const { property } = node.callee
      property.name = TRIM_METHOD_RENAMES.get(property.name)

      modified = true
    })

  return modified
}
trimLeftRightToTrimStartEnd.baselineDate = new Date(Date.UTC(2020, 0, 15))
