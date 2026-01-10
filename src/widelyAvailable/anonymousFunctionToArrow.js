import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform anonymous function expressions to arrow functions. Does not transform if
 * the function:
 *
 * - Is a named function expression (useful for stack traces and recursion)
 * - Uses 'this' (arrow functions don't have their own 'this')
 * - Uses 'arguments' (arrow functions don't have 'arguments' object)
 * - Uses 'super' (defensive check, though this would be a syntax error in function
 *   expressions)
 * - Is a generator function (arrow functions cannot be generators)
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
 */
export function anonymousFunctionToArrow(root) {
  let modified = false

  root
    .find(j.FunctionExpression)
    .filter((path) => {
      const node = path.node

      // Skip if it's a named function expression
      // Named functions are useful for stack traces and recursion
      if (node.id) {
        return false
      }

      // Skip if it's a generator function
      if (node.generator) {
        return false
      }

      // Skip if it uses 'this'
      if (new NodeTest(node.body).usesThis()) {
        return false
      }

      // Skip if it uses 'arguments'
      if (new NodeTest(node.body).usesArguments()) {
        return false
      }

      // Skip if this function expression is the init of a variable declarator
      // because namedArrowFunctionToNamedFunction will handle those
      const parent = path.parent.node
      if (j.VariableDeclarator.check(parent) && parent.init === node) {
        return false
      }

      // Note: We don't need to check for 'super' because using super in a
      // function expression is a syntax error and will never parse successfully

      return true
    })
    .forEach((path) => {
      const node = path.node

      // Create arrow function with same params and body
      const arrowFunction = j.arrowFunctionExpression(node.params, node.body, false)

      // Preserve async property
      if (node.async) {
        arrowFunction.async = true
      }

      j(path).replaceWith(arrowFunction)

      modified = true
    })

  return modified
}
