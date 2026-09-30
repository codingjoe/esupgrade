import { default as j } from "jscodeshift"
import {
  processMultipleDeclarators,
  processSingleDeclarator,
  ReassignmentIndex,
} from "../types.js"

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
 * A single reassignment index serves all declarations, because indexing the whole
 * tree once is far cheaper than traversing it per declaration. Splitting a
 * multi-declarator declaration only re-parents declarators, so the indexed paths
 * stay usable: the shadowing analysis reads enclosing functions, which splitting
 * leaves in place.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let
 */
export function varToLetOrConst(root) {
  let modified = false
  let reassignments = null

  root.find(j.VariableDeclaration, { kind: "var" }).forEach((path) => {
    if (isAmbientTypeScriptVar(path)) {
      return
    }

    reassignments ??= new ReassignmentIndex(root)

    if (path.node.declarations.length === 1) {
      processSingleDeclarator(reassignments, path)
    } else {
      processMultipleDeclarators(reassignments, path)
    }

    modified = true
  })

  return modified
}
varToLetOrConst.baselineDate = new Date(Date.UTC(2016, 8, 20))
