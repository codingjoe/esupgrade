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

      if (
        !j.MemberExpression.check(node.callee) ||
        node.callee.computed ||
        !j.Identifier.check(node.callee.property) ||
        !TRIM_METHOD_RENAMES.has(node.callee.property.name)
      ) {
        return false
      }

      return new NodeTest(node.callee.object).hasIndexOfAndIncludes()
    })
    .forEach(({ node }) => {
      const { property } = node.callee
      property.name = TRIM_METHOD_RENAMES.get(property.name)

      modified = true
    })

  return modified
}
trimLeftRightToTrimStartEnd.baselineDate = new Date(Date.UTC(2020, 0, 15))
