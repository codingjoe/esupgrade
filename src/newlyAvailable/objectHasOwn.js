import { default as j } from "jscodeshift"

/**
 * Check whether a node is `Object.prototype`.
 *
 * @param {import("ast-types").ASTNode} node - The node to check
 * @returns {boolean} True when the node is `Object.prototype`
 */
function isObjectPrototype(node) {
  return (
    j.MemberExpression.check(node) &&
    j.Identifier.check(node.object) &&
    node.object.name === "Object" &&
    j.Identifier.check(node.property) &&
    node.property.name === "prototype"
  )
}

/**
 * Check whether a node is a `hasOwnProperty` reference supported by Object.hasOwn().
 *
 * @param {import("ast-types").ASTNode} node - The node to check
 * @returns {boolean} True when the node matches a supported `hasOwnProperty` reference
 */
function isSupportedHasOwnProperty(node) {
  return (
    j.MemberExpression.check(node) &&
    j.Identifier.check(node.property) &&
    node.property.name === "hasOwnProperty" &&
    (isObjectPrototype(node.object) ||
      (j.ObjectExpression.check(node.object) && node.object.properties.length === 0))
  )
}

/**
 * Transform Object.prototype.hasOwnProperty.call(obj, prop) to Object.hasOwn(obj, prop).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn
 */
export function objectHasOwn(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter(({ node }) => {
      return (
        node.arguments.length === 2 &&
        j.MemberExpression.check(node.callee) &&
        j.Identifier.check(node.callee.property) &&
        node.callee.property.name === "call" &&
        isSupportedHasOwnProperty(node.callee.object)
      )
    })
    .forEach((path) => {
      j(path).replaceWith(
        j.callExpression(
          j.memberExpression(j.identifier("Object"), j.identifier("hasOwn"), false),
          path.node.arguments,
        ),
      )

      modified = true
    })

  return modified
}
objectHasOwn.baselineDate = new Date(Date.UTC(2025, 0, 1))
