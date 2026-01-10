import { default as j } from "jscodeshift"
import { findEnclosingFunction, NodeTest } from "../types.js"

/**
 * Unwrap Promise.resolve() and Promise.reject() calls.
 * - Promise.resolve(value) -> value
 * - Promise.reject(error) -> marker object { _isReject: true, argument: error } for special handling
 *
 * @param {*} node - The AST node to potentially unwrap
 * @returns {*} The unwrapped value, a reject marker object, or the original node
 */
function unwrapPromiseResolveReject(node) {
  if (
    j.CallExpression.check(node) &&
    j.MemberExpression.check(node.callee) &&
    j.Identifier.check(node.callee.object) &&
    node.callee.object.name === "Promise" &&
    j.Identifier.check(node.callee.property)
  ) {
    if (node.callee.property.name === "resolve") {
      return node.arguments.length === 1 ? node.arguments[0] : j.identifier("undefined")
    }
    if (node.callee.property.name === "reject") {
      return {
        _isReject: true,
        argument:
          node.arguments.length === 1 ? node.arguments[0] : j.identifier("undefined"),
      }
    }
  }
  return node
}

/**
 * Make a function async and transform its promise returns.
 *
 * @param {import("jscodeshift").NodePath} funcPath - The function path
 * @param {Function} callback - Callback to transform return paths
 * @returns {boolean} True if the function was modified
 */
function _transformFunctionToAsync(funcPath, callback) {
  const func = funcPath.node

  if (func.async || !j.BlockStatement.check(func.body)) {
    return false
  }

  let hasPromiseReturn = false
  const promiseReturns = []

  j(funcPath)
    .find(j.ReturnStatement)
    .forEach((retPath) => {
      const enclosing = findEnclosingFunction(retPath)
      if (enclosing !== funcPath) {
        return
      }

      if (
        retPath.node.argument &&
        new NodeTest(retPath.node.argument).isKnownPromise()
      ) {
        hasPromiseReturn = true
        promiseReturns.push(retPath)
      }
    })

  if (!hasPromiseReturn) {
    return false
  }

  func.async = true
  callback(promiseReturns)
  return true
}

/**
 * Transform Promise-returning functions to async/await.
 * Makes functions async if they return a known promise, and converts
 * .then().catch() chains to try/catch with await.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
 */
export function promiseToAsyncAwait(root) {
  let modified = false

  // First, transform .then().catch() chains to try/catch with await
  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "catch"
      ) {
        return false
      }

      const thenCall = node.callee.object
      if (
        !j.CallExpression.check(thenCall) ||
        !j.MemberExpression.check(thenCall.callee) ||
        !j.Identifier.check(thenCall.callee.property) ||
        thenCall.callee.property.name !== "then"
      ) {
        return false
      }

      if (thenCall.arguments.length !== 1 || node.arguments.length !== 1) {
        return false
      }

      const thenCallback = thenCall.arguments[0]
      const catchCallback = node.arguments[0]

      if (
        (!j.ArrowFunctionExpression.check(thenCallback) &&
          !j.FunctionExpression.check(thenCallback)) ||
        (!j.ArrowFunctionExpression.check(catchCallback) &&
          !j.FunctionExpression.check(catchCallback))
      ) {
        return false
      }

      if (
        thenCallback.params.length !== 1 ||
        catchCallback.params.length !== 1 ||
        !j.Identifier.check(thenCallback.params[0]) ||
        !j.Identifier.check(catchCallback.params[0])
      ) {
        return false
      }

      if (
        !j.BlockStatement.check(thenCallback.body) ||
        !j.BlockStatement.check(catchCallback.body)
      ) {
        return false
      }

      const promiseExpr = thenCall.callee.object

      if (!new NodeTest(promiseExpr).isKnownPromise()) {
        return false
      }

      const enclosingFunction = findEnclosingFunction(path)

      const parent = path.parent.node

      if (j.ReturnStatement.check(parent)) {
        return true
      }

      if (
        j.ExpressionStatement.check(parent) &&
        enclosingFunction &&
        enclosingFunction.node.async
      ) {
        return true
      }

      return false
    })
    .forEach((path) => {
      const node = path.node
      const thenCall = node.callee.object
      const promiseExpr = thenCall.callee.object

      const thenCallback = thenCall.arguments[0]
      const catchCallback = node.arguments[0]

      const resultParam = thenCallback.params[0].name
      const errorParam = catchCallback.params[0].name

      const awaitExpr = j.awaitExpression(promiseExpr)

      const tryBody = j.blockStatement([
        j.variableDeclaration("const", [
          j.variableDeclarator(j.identifier(resultParam), awaitExpr),
        ]),
        ...thenCallback.body.body,
      ])

      const tryStatement = j.tryStatement(
        tryBody,
        j.catchClause(j.identifier(errorParam), null, catchCallback.body),
      )

      j(path.parent).replaceWith(tryStatement)

      const enclosingFunction = findEnclosingFunction(path)
      if (enclosingFunction && !enclosingFunction.node.async) {
        enclosingFunction.node.async = true
      }

      modified = true
    })

  // Helper to transform promise returns.
  function transformPromiseReturns(promiseReturns) {
    promiseReturns.forEach((retPath) => {
      const unwrapped = unwrapPromiseResolveReject(retPath.node.argument)
      if (unwrapped && typeof unwrapped === "object" && unwrapped._isReject) {
        j(retPath).replaceWith(j.throwStatement(unwrapped.argument))
      } else if (unwrapped !== retPath.node.argument) {
        retPath.node.argument = unwrapped
      } else {
        retPath.node.argument = j.awaitExpression(retPath.node.argument)
      }
    })
  }

  ;[j.FunctionDeclaration, j.FunctionExpression, j.ArrowFunctionExpression].forEach(
    (FunctionType) => {
      root.find(FunctionType).forEach((funcPath) => {
        if (_transformFunctionToAsync(funcPath, transformPromiseReturns)) {
          modified = true
        }
      })
    },
  )

  return modified
}
