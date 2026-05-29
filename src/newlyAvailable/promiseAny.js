import { default as j } from "jscodeshift"

/**
 * Return the Promise executor when it matches the supported shape.
 *
 * @param {import("jscodeshift").NewExpression} node - The AST node to inspect.
 * @returns {import("ast-types").namedTypes.FunctionExpression | import("ast-types").namedTypes.ArrowFunctionExpression | null} The supported executor.
 */
function getExecutor(node) {
  if (!j.Identifier.check(node.callee) || node.callee.name !== "Promise") {
    return null
  }

  if (node.arguments.length !== 1) {
    return null
  }

  const executor = node.arguments[0]

  if (
    !j.ArrowFunctionExpression.check(executor) &&
    !j.FunctionExpression.check(executor)
  ) {
    return null
  }

  if (
    executor.params.length !== 2 ||
    !j.Identifier.check(executor.params[0]) ||
    !j.Identifier.check(executor.params[1]) ||
    !j.BlockStatement.check(executor.body)
  ) {
    return null
  }

  return executor
}

/**
 * Return the counter name from the supported rejection counter declaration.
 *
 * @param {import("ast-types").namedTypes.Statement} statement - The statement to inspect.
 * @returns {string | null} The counter name.
 */
function getCounterName(statement) {
  if (
    !j.VariableDeclaration.check(statement) ||
    statement.declarations.length !== 1 ||
    !j.VariableDeclarator.check(statement.declarations[0]) ||
    !j.Identifier.check(statement.declarations[0].id) ||
    !j.Literal.check(statement.declarations[0].init) ||
    statement.declarations[0].init.value !== 0
  ) {
    return null
  }

  return statement.declarations[0].id.name
}

/**
 * Return the call expression from a callback body.
 *
 * @param {import("ast-types").namedTypes.ArrowFunctionExpression | import("ast-types").namedTypes.FunctionExpression} callback - The callback to inspect.
 * @returns {import("ast-types").namedTypes.CallExpression | null} The contained call expression.
 */
function getCallExpression(callback) {
  if (j.CallExpression.check(callback.body)) {
    return callback.body
  }

  if (
    j.BlockStatement.check(callback.body) &&
    callback.body.body.length === 1 &&
    j.ExpressionStatement.check(callback.body.body[0]) &&
    j.CallExpression.check(callback.body.body[0].expression)
  ) {
    return callback.body.body[0].expression
  }

  return null
}

/**
 * Return whether the expression calls Promise.resolve(promise).
 *
 * @param {import("ast-types").namedTypes.Expression} expression - The expression to inspect.
 * @param {string} promiseName - The promise parameter name.
 * @returns {boolean} Whether the expression matches Promise.resolve(promise).
 */
function isPromiseResolveCall(expression, promiseName) {
  return (
    j.CallExpression.check(expression) &&
    j.MemberExpression.check(expression.callee) &&
    !expression.callee.computed &&
    j.Identifier.check(expression.callee.object) &&
    expression.callee.object.name === "Promise" &&
    j.Identifier.check(expression.callee.property) &&
    expression.callee.property.name === "resolve" &&
    expression.arguments.length === 1 &&
    j.Identifier.check(expression.arguments[0]) &&
    expression.arguments[0].name === promiseName
  )
}

/**
 * Return whether the statement increments the rejection counter.
 *
 * @param {import("ast-types").namedTypes.Statement} statement - The statement to inspect.
 * @param {string} counterName - The counter variable name.
 * @returns {boolean} Whether the statement increments the counter.
 */
function isCounterIncrement(statement, counterName) {
  if (!j.ExpressionStatement.check(statement)) {
    return false
  }

  const { expression } = statement

  if (
    j.UpdateExpression.check(expression) &&
    expression.operator === "++" &&
    j.Identifier.check(expression.argument) &&
    expression.argument.name === counterName
  ) {
    return true
  }

  return (
    j.AssignmentExpression.check(expression) &&
    expression.operator === "+=" &&
    j.Identifier.check(expression.left) &&
    expression.left.name === counterName &&
    j.Literal.check(expression.right) &&
    expression.right.value === 1
  )
}

/**
 * Return whether the expression compares the rejection counter with promises.length.
 *
 * @param {import("ast-types").namedTypes.Expression} expression - The expression to inspect.
 * @param {string} counterName - The counter variable name.
 * @param {string} promisesName - The promises variable name.
 * @returns {boolean} Whether the comparison matches the supported shape.
 */
function isRejectedAllComparison(expression, counterName, promisesName) {
  function isCounter(node) {
    return j.Identifier.check(node) && node.name === counterName
  }

  function isPromisesLength(node) {
    return (
      j.MemberExpression.check(node) &&
      !node.computed &&
      j.Identifier.check(node.object) &&
      node.object.name === promisesName &&
      j.Identifier.check(node.property) &&
      node.property.name === "length"
    )
  }

  return (
    j.BinaryExpression.check(expression) &&
    expression.operator === "===" &&
    ((isCounter(expression.left) && isPromisesLength(expression.right)) ||
      (isCounter(expression.right) && isPromisesLength(expression.left)))
  )
}

/**
 * Return whether the statement rejects the outer Promise.
 *
 * @param {import("ast-types").namedTypes.Statement} statement - The statement to inspect.
 * @param {string} rejectName - The reject parameter name.
 * @returns {boolean} Whether the statement calls reject(...).
 */
function isRejectCall(statement, rejectName) {
  if (!j.ExpressionStatement.check(statement)) {
    return false
  }

  return (
    j.CallExpression.check(statement.expression) &&
    j.Identifier.check(statement.expression.callee) &&
    statement.expression.callee.name === rejectName
  )
}

/**
 * Return whether the rejection handler matches the supported shape.
 *
 * @param {import("ast-types").namedTypes.Expression} handler - The rejection handler.
 * @param {string} counterName - The counter variable name.
 * @param {string} promisesName - The promises variable name.
 * @param {string} rejectName - The reject parameter name.
 * @returns {boolean} Whether the handler matches.
 */
function isRejectHandler(handler, counterName, promisesName, rejectName) {
  if (
    !j.ArrowFunctionExpression.check(handler) &&
    !j.FunctionExpression.check(handler)
  ) {
    return false
  }

  if (!j.BlockStatement.check(handler.body) || handler.body.body.length !== 2) {
    return false
  }

  const [incrementStatement, ifStatement] = handler.body.body

  if (
    !isCounterIncrement(incrementStatement, counterName) ||
    !j.IfStatement.check(ifStatement) ||
    !isRejectedAllComparison(ifStatement.test, counterName, promisesName)
  ) {
    return false
  }

  const rejectStatement =
    j.BlockStatement.check(ifStatement.consequent) &&
    ifStatement.consequent.body.length === 1
      ? ifStatement.consequent.body[0]
      : ifStatement.consequent

  return !ifStatement.alternate && isRejectCall(rejectStatement, rejectName)
}

/**
 * Return the promises identifier from the supported forEach call.
 *
 * @param {import("ast-types").namedTypes.Statement} statement - The statement to inspect.
 * @param {string} resolveName - The resolve parameter name.
 * @param {string} rejectName - The reject parameter name.
 * @param {string} counterName - The counter variable name.
 * @returns {import("ast-types").namedTypes.Identifier | null} The promises identifier.
 */
function getPromisesIdentifier(statement, resolveName, rejectName, counterName) {
  if (!j.ExpressionStatement.check(statement)) {
    return null
  }

  const { expression } = statement

  if (
    !j.CallExpression.check(expression) ||
    !j.MemberExpression.check(expression.callee) ||
    expression.callee.computed ||
    !j.Identifier.check(expression.callee.object) ||
    !j.Identifier.check(expression.callee.property) ||
    expression.callee.property.name !== "forEach" ||
    expression.arguments.length !== 1
  ) {
    return null
  }

  const callback = expression.arguments[0]
  const promisesIdentifier = expression.callee.object

  if (
    !j.ArrowFunctionExpression.check(callback) &&
    !j.FunctionExpression.check(callback)
  ) {
    return null
  }

  if (callback.params.length !== 1 || !j.Identifier.check(callback.params[0])) {
    return null
  }

  const thenCall = getCallExpression(callback)

  if (
    !thenCall ||
    !j.MemberExpression.check(thenCall.callee) ||
    thenCall.callee.computed ||
    !j.Identifier.check(thenCall.callee.property) ||
    thenCall.callee.property.name !== "then" ||
    thenCall.arguments.length !== 2 ||
    !j.Identifier.check(thenCall.arguments[0]) ||
    thenCall.arguments[0].name !== resolveName ||
    !isRejectHandler(
      thenCall.arguments[1],
      counterName,
      promisesIdentifier.name,
      rejectName,
    )
  ) {
    return null
  }

  const promiseName = callback.params[0].name

  if (
    (j.Identifier.check(thenCall.callee.object) &&
      thenCall.callee.object.name === promiseName) ||
    isPromiseResolveCall(thenCall.callee.object, promiseName)
  ) {
    return promisesIdentifier
  }

  return null
}

/**
 * Return the promises identifier when the manual Promise.any pattern is supported.
 *
 * @param {import("jscodeshift").NewExpression} node - The AST node to inspect.
 * @returns {import("ast-types").namedTypes.Identifier | null} The promises identifier.
 */
function getPromisesForManualAny(node) {
  const executor = getExecutor(node)

  if (!executor || executor.body.body.length !== 2) {
    return null
  }

  const counterName = getCounterName(executor.body.body[0])

  if (!counterName) {
    return null
  }

  return getPromisesIdentifier(
    executor.body.body[1],
    executor.params[0].name,
    executor.params[1].name,
    counterName,
  )
}

/**
 * Transform a manual Promise.any pattern to Promise.any(promises).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any
 */
export function promiseAny(root) {
  let modified = false

  root.find(j.NewExpression).forEach((path) => {
    const promisesIdentifier = getPromisesForManualAny(path.node)

    if (!promisesIdentifier) {
      return
    }

    j(path).replaceWith(
      j.callExpression(
        j.memberExpression(j.identifier("Promise"), j.identifier("any")),
        [promisesIdentifier],
      ),
    )

    modified = true
  })

  return modified
}
promiseAny.baselineDate = new Date(Date.UTC(2023, 8, 18))
