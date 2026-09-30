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
 * Rewrites `var` declarations to `let` or `const`.
 *
 * A single reassignment index serves all declarations, because indexing the whole
 * tree once is far cheaper than traversing it per declaration. Splitting a
 * multi-declarator declaration only re-parents declarators, so the indexed paths
 * stay usable: the shadowing analysis reads enclosing functions, which splitting
 * leaves in place.
 */
class VarDeclarationUpgrader {
  #root
  #reassignments = null

  /**
   * @param {import("jscodeshift").Collection} root - The root AST collection
   */
  constructor(root) {
    this.#root = root
  }

  /**
   * Rewrite every upgradable `var` declaration of the root collection.
   *
   * @returns {boolean} True if code was modified
   */
  upgrade() {
    let modified = false

    this.#root.find(j.VariableDeclaration, { kind: "var" }).forEach((path) => {
      modified = this.#upgradeDeclaration(path) || modified
    })

    return modified
  }

  /**
   * Rewrite a single variable declaration.
   *
   * @param {import("ast-types").NodePath} path - The variable declaration path
   * @returns {boolean} True if the declaration was rewritten
   */
  #upgradeDeclaration(path) {
    if (isAmbientTypeScriptVar(path)) {
      return false
    }

    const reassignments = this.#reassignmentsFor()
    const isSingleDeclarator = path.node.declarations.length === 1

    return isSingleDeclarator
      ? processSingleDeclarator(reassignments, path).modified
      : processMultipleDeclarators(reassignments, path).modified
  }

  /**
   * Provide the reassignment index, creating it on first use.
   *
   * @returns {ReassignmentIndex} Indexed assignments and updates
   */
  #reassignmentsFor() {
    this.#reassignments ??= new ReassignmentIndex(this.#root)

    return this.#reassignments
  }
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
  return new VarDeclarationUpgrader(root).upgrade()
}
varToLetOrConst.baselineDate = new Date(Date.UTC(2016, 8, 20))
