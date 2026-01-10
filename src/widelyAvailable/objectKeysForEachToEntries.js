import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform Object.keys().forEach() to Object.entries().
 * Converts patterns where Object.keys() is used to iterate and access values from the same object
 * to use Object.entries() with destructuring.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
 */
export function objectKeysForEachToEntries(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      // Check if this is a forEach call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "forEach"
      ) {
        return false
      }

      // Check if the object is Object.keys()
      const object = node.callee.object
      if (
        !j.CallExpression.check(object) ||
        !j.MemberExpression.check(object.callee) ||
        !j.Identifier.check(object.callee.object) ||
        object.callee.object.name !== "Object" ||
        !j.Identifier.check(object.callee.property) ||
        object.callee.property.name !== "keys"
      ) {
        return false
      }

      // Object.keys() must have exactly one argument (the object)
      if (object.arguments.length !== 1) {
        return false
      }

      // Check that forEach has a callback argument
      if (node.arguments.length === 0) {
        return false
      }

      const callback = node.arguments[0]
      // Only transform if callback is an inline function (arrow or function expression)
      if (
        !j.ArrowFunctionExpression.check(callback) &&
        !j.FunctionExpression.check(callback)
      ) {
        return false
      }

      // Only transform if callback uses only the first parameter (key)
      // Don't transform if it uses index or array parameters
      const params = callback.params
      if (params.length !== 1) {
        return false
      }

      // The callback must have at least one parameter (the key)
      if (!j.Identifier.check(params[0])) {
        return false
      }

      return true
    })
    .forEach((path) => {
      const node = path.node
      const objectKeysCall = node.callee.object
      const targetObject = objectKeysCall.arguments[0]
      const callback = node.arguments[0]
      const keyParam = callback.params[0]
      const keyName = keyParam.name

      // Check if the callback body has a pattern like:
      // const value = obj[key];
      // We need to find this pattern and convert to destructuring
      let valueVariable = null
      let bodyStatements = []

      if (j.BlockStatement.check(callback.body)) {
        bodyStatements = callback.body.body
      } else {
        // Expression body - don't transform
        return
      }

      // Look for first statement that assigns targetObject[keyName] to a variable
      if (bodyStatements.length > 0) {
        const firstStmt = bodyStatements[0]
        if (j.VariableDeclaration.check(firstStmt)) {
          if (firstStmt.declarations.length === 1) {
            const varDeclarator = firstStmt.declarations[0]
            if (j.Identifier.check(varDeclarator.id)) {
              // Check if init is targetObject[keyName]
              if (
                j.MemberExpression.check(varDeclarator.init) &&
                varDeclarator.init.computed === true &&
                j.Identifier.check(varDeclarator.init.property) &&
                varDeclarator.init.property.name === keyName &&
                new NodeTest(varDeclarator.init.object).isEqual(targetObject)
              ) {
                valueVariable = {
                  name: varDeclarator.id.name,
                }
              }
            }
          }
        }
      }

      // Only transform if we found the value variable pattern
      if (!valueVariable) {
        return
      }

      // Create new callback with destructuring parameter
      const newParam = j.arrayPattern([
        j.identifier(keyName),
        j.identifier(valueVariable.name),
      ])

      // Create new body without the first declaration
      const newBody = j.blockStatement(bodyStatements.slice(1))

      // Create new callback function with destructuring
      const newCallback = j.ArrowFunctionExpression.check(callback)
        ? j.arrowFunctionExpression([newParam], newBody, false)
        : j.functionExpression(null, [newParam], newBody, false, false)

      // Preserve async property
      if (callback.async) {
        newCallback.async = true
      }

      // Create Object.entries() call
      const objectEntriesCall = j.callExpression(
        j.memberExpression(j.identifier("Object"), j.identifier("entries"), false),
        [targetObject],
      )

      // Create new forEach call
      const newForEachCall = j.callExpression(
        j.memberExpression(objectEntriesCall, j.identifier("forEach"), false),
        [newCallback],
      )

      j(path).replaceWith(newForEachCall)

      modified = true
    })

  return modified
}
