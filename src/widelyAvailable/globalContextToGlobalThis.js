import { default as j } from "jscodeshift"
import { isShadowed } from "../types.js"

/**
 * Replace global context references (window, self, Function("return this")()) with
 * globalThis.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
 */
export function globalContextToGlobalThis(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node
      // Check if this is a call to Function constructor
      if (
        !j.Identifier.check(node.callee) ||
        node.callee.name !== "Function" ||
        node.arguments.length !== 1
      ) {
        return false
      }

      // Check if the argument is "return this" (either single or double quotes)
      const arg = node.arguments[0]
      if (!j.StringLiteral.check(arg) && !j.Literal.check(arg)) {
        return false
      }

      const value = arg.value
      return typeof value === "string" && value === "return this"
    })
    .forEach((path) => {
      // Check if the Function call result is immediately invoked
      const parent = path.parent
      if (j.CallExpression.check(parent.node) && parent.node.callee === path.node) {
        // Replace the entire call expression with globalThis
        j(parent).replaceWith(j.identifier("globalThis"))
        modified = true
      }
    })

  // Transform window and self identifiers to globalThis
  const globalIdentifiers = ["window", "self"]

  for (const globalName of globalIdentifiers) {
    root
      .find(j.Identifier)
      .filter((path) => {
        const node = path.node
        if (node.name !== globalName) {
          return false
        }

        // Don't transform if it's a property name (e.g., obj.window)
        const parent = path.parent.node
        if (
          j.MemberExpression.check(parent) &&
          parent.property === node &&
          !parent.computed
        ) {
          return false
        }

        // Don't transform if it's an object property key or shorthand property
        if (j.Property.check(parent) || j.ObjectProperty.check(parent)) {
          if (parent.key === node && !parent.computed) {
            return false
          }
          if (parent.shorthand === true && parent.value === node) {
            return false
          }
        }

        // Don't transform if it's an object method key (method shorthand syntax)
        if (j.ObjectMethod.check(parent) && parent.key === node) {
          return false
        }

        // Don't transform if it's a class property key
        if (j.ClassProperty.check(parent) && parent.key === node) {
          return false
        }

        // Don't transform if it's a variable declarator id (e.g., var window = ...)
        if (j.VariableDeclarator.check(parent) && parent.id === node) {
          return false
        }

        // Don't transform if it's a function parameter
        if (
          (j.FunctionDeclaration.check(parent) ||
            j.FunctionExpression.check(parent) ||
            j.ArrowFunctionExpression.check(parent)) &&
          parent.params.includes(node)
        ) {
          return false
        }

        // Check if the identifier is shadowed by a local variable or parameter
        if (isShadowed(path, globalName)) {
          return false
        }

        return true
      })
      .forEach((path) => {
        path.node.name = "globalThis"
        modified = true
      })
  }

  return modified
}
