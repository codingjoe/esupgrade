import { default as j } from "jscodeshift"

/**
 * Transform console.log() to console.info().
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/API/console
 */
export function consoleLogToInfo(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node
      // Check if this is a console.log() call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.object) ||
        node.callee.object.name !== "console" ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "log"
      ) {
        return false
      }

      return true
    })
    .forEach((path) => {
      const node = path.node

      // Replace the property name from 'log' to 'info'
      node.callee.property.name = "info"

      modified = true
    })

  return modified
}
