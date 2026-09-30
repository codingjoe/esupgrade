import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

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
    .filter(({ node }) => {
      // Check if this is a console.log() call
      return (
        new NodeTest(node).isMethodCall(["log"]) &&
        j.Identifier.check(node.callee.object) &&
        node.callee.object.name === "console"
      )
    })
    .forEach(({ node }) => {
      // Replace the property name from 'log' to 'info'
      node.callee.property.name = "info"

      modified = true
    })

  return modified
}
consoleLogToInfo.baselineDate = new Date(Date.UTC(2015, 6, 29))
