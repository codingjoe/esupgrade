import { default as j } from "jscodeshift"
import { processMultipleDeclarators, processSingleDeclarator } from "../types.js"

/**
 * Detect whether a path is nested in a declared TypeScript module.
 *
 * @param {import("ast-types").NodePath} path - The path to check.
 * @returns {boolean} True when the path is inside a declared TypeScript module.
 */
function isInDeclaredTypeScriptModule({ parentPath: currentPath }) {
  while (currentPath) {
    const currentNode = currentPath.node

    if (j.TSModuleDeclaration.check(currentNode) && currentNode.declare === true) {
      return true
    }

    currentPath = currentPath.parentPath
  }

  return false
}

/**
 * Detect whether a variable declaration is ambient in TypeScript.
 *
 * @param {import("ast-types").NodePath} path - The variable declaration path.
 * @returns {boolean} True when TypeScript ambient syntax requires keeping `var`.
 */
function isAmbientTypeScriptVar(path) {
  return path.node.declare === true || isInDeclaredTypeScriptModule(path)
}

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
    if (isAmbientTypeScriptVar(path)) {
      return
    }

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
varToLetOrConst.baselineDate = new Date(Date.UTC(2016, 8, 20))
