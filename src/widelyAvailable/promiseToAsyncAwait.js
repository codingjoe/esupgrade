import { default as j } from "jscodeshift"
import { findEnclosingFunction, NodeTest } from "../types.js"

/**
 * Extract the parts of a `.then().catch()` chain of inline callbacks.
 *
 * @param {import("jscodeshift").NodePath} path - Path of the candidate catch call
 * @returns {{
 *   promiseExpr: import("ast-types").ASTNode;
 *   thenCallback: import("ast-types").ASTNode;
 *   catchCallback: import("ast-types").ASTNode;
 * } | null} The chain parts, or null when the node is no such chain
 */
function extractThenCatch({ node }) {
  if (!new NodeTest(node).isMethodCall(["catch"])) {
    return null
  }

  const thenCall = node.callee.object

  if (
    !new NodeTest(thenCall).isMethodCall(["then"]) ||
    thenCall.arguments.length !== 1 ||
    node.arguments.length !== 1
  ) {
    return null
  }

  const thenCallback = thenCall.arguments[0]
  const catchCallback = node.arguments[0]

  if (
    !new NodeTest(thenCallback).isFunctionExpression() ||
    !new NodeTest(catchCallback).isFunctionExpression() ||
    thenCallback.params.length !== 1 ||
    catchCallback.params.length !== 1 ||
    !j.Identifier.check(thenCallback.params[0]) ||
    !j.Identifier.check(catchCallback.params[0]) ||
    !j.BlockStatement.check(thenCallback.body) ||
    !j.BlockStatement.check(catchCallback.body) ||
    !new NodeTest(thenCall.callee.object).isKnownPromise()
  ) {
    return null
  }

  return { promiseExpr: thenCall.callee.object, thenCallback, catchCallback }
}

/**
 * Make a function async and transform its promise returns.
 *
 * @param {import("jscodeshift").NodePath} funcPath - The function path
 * @returns {boolean} True if the function was modified
 */
function _transformFunctionToAsync(funcPath) {
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
  transformPromiseReturns(promiseReturns)
  return true
}

/**
 * Transform promise returns: unwrap Promise.resolve/reject, await everything else.
 *
 * @param {Array<import("jscodeshift").NodePath>} promiseReturns - The return paths
 */
function transformPromiseReturns(promiseReturns) {
  promiseReturns.forEach((retPath) => {
    const unwrapped = new NodeTest(retPath.node.argument).unwrapPromiseResolveReject()

    if (unwrapped?.kind === "reject") {
      j(retPath).replaceWith(j.throwStatement(unwrapped.argument))
    } else if (unwrapped) {
      retPath.node.argument = unwrapped.argument
    } else {
      retPath.node.argument = j.awaitExpression(retPath.node.argument)
    }
  })
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
      if (!extractThenCatch(path)) {
        return false
      }

      const parent = path.parent.node

      return (
        j.ReturnStatement.check(parent) ||
        (j.ExpressionStatement.check(parent) && findEnclosingFunction(path)?.node.async)
      )
    })
    .forEach((path) => {
      const { promiseExpr, thenCallback, catchCallback } = extractThenCatch(path)

      const tryStatement = j.tryStatement(
        j.blockStatement([
          j.variableDeclaration("const", [
            j.variableDeclarator(
              j.identifier(thenCallback.params[0].name),
              j.awaitExpression(promiseExpr),
            ),
          ]),
          ...thenCallback.body.body,
        ]),
        j.catchClause(
          j.identifier(catchCallback.params[0].name),
          null,
          catchCallback.body,
        ),
      )

      j(path.parent).replaceWith(tryStatement)

      const enclosingFunction = findEnclosingFunction(path)
      if (enclosingFunction && !enclosingFunction.node.async) {
        enclosingFunction.node.async = true
      }

      modified = true
    })

  ;[j.FunctionDeclaration, j.FunctionExpression, j.ArrowFunctionExpression].forEach(
    (FunctionType) => {
      root.find(FunctionType).forEach((funcPath) => {
        if (_transformFunctionToAsync(funcPath)) {
          modified = true
        }
      })
    },
  )

  return modified
}
promiseToAsyncAwait.baselineDate = new Date(Date.UTC(2017, 3, 5))
