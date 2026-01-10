import { default as j } from "jscodeshift"
import { processMultipleDeclarators, processSingleDeclarator } from "../types.js"

/**
 * Transform var to const or let.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let
 */
export function varToLetOrConst(root) {
  let modified = false

  root.find(j.VariableDeclaration, { kind: "var" }).forEach((path) => {
    const isSingleDeclarator = path.node.declarations.length === 1

    const result = isSingleDeclarator
      ? processSingleDeclarator(root, path)
      : processMultipleDeclarators(root, path)

    if (result.modified) {
      modified = true
    }
  })

  return modified
}
