import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Check if a callback expression body returns `targetObject[keyName]`.
 *
 * @param {import("ast-types").ASTNode} body - The callback body
 * @param {string} keyName - The key parameter name
 * @param {import("ast-types").ASTNode} targetObject - The object to compare against
 * @returns {boolean} True if the body returns the expected member expression
 */
function isValueAccess(body, keyName, targetObject) {
  switch (body.type) {
    case "MemberExpression":
      return (
        body.computed === true &&
        j.Identifier.check(body.property) &&
        body.property.name === keyName &&
        new NodeTest(body.object).isEqual(targetObject)
      )
    case "BlockStatement": {
      if (body.body.length !== 1) {
        return false
      }
      const stmt = body.body[0]
      return (
        j.ReturnStatement.check(stmt) &&
        stmt.argument !== null &&
        isValueAccess(stmt.argument, keyName, targetObject)
      )
    }
    default:
      return false
  }
}

/**
 * Transform Object.keys(obj).map(key => obj[key]) to Object.values(obj).
 * Converts patterns where Object.keys() is mapped to retrieve values from the same object
 * to use Object.values() directly.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/values
 */
export function objectKeysMapToValues(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "map"
      ) {
        return false
      }

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

      if (object.arguments.length !== 1) {
        return false
      }

      if (node.arguments.length !== 1) {
        return false
      }

      const callback = node.arguments[0]
      if (
        !j.ArrowFunctionExpression.check(callback) &&
        !j.FunctionExpression.check(callback)
      ) {
        return false
      }

      if (callback.params.length !== 1 || !j.Identifier.check(callback.params[0])) {
        return false
      }

      const keyName = callback.params[0].name
      return isValueAccess(callback.body, keyName, object.arguments[0])
    })
    .forEach((path) => {
      const targetObject = path.node.callee.object.arguments[0]

      j(path).replaceWith(
        j.callExpression(
          j.memberExpression(j.identifier("Object"), j.identifier("values"), false),
          [targetObject],
        ),
      )

      modified = true
    })

  return modified
}
