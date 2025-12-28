/**
 * Transform new Promise((resolve, reject) => { resolve(fn()) }) to Promise.try(fn)
 */
export function promiseTry(j, root) {
  let modified = false
  const changes = []

  root
    .find(j.NewExpression)
    .filter((path) => {
      const node = path.node
      // Check if this is new Promise(...)
      if (!j.Identifier.check(node.callee) || node.callee.name !== "Promise") {
        return false
      }

      // Skip if this Promise is being awaited
      // Check if parent is an AwaitExpression
      if (path.parent && j.AwaitExpression.check(path.parent.node)) {
        return false
      }

      // Check if there's one argument that's a function
      if (node.arguments.length !== 1) {
        return false
      }

      const executor = node.arguments[0]
      if (
        !j.ArrowFunctionExpression.check(executor) &&
        !j.FunctionExpression.check(executor)
      ) {
        return false
      }

      // Check if function has 1-2 params (resolve, reject)
      if (executor.params.length < 1 || executor.params.length > 2) {
        return false
      }

      // Check if body is a block with single resolve() call or expression body
      const body = executor.body

      // For arrow functions with expression body: (resolve) => expr
      if (!j.BlockStatement.check(body)) {
        // Check if expression is resolve(something) or func(resolve)
        if (j.CallExpression.check(body)) {
          const callExpr = body
          // Pattern: (resolve) => resolve(expr)
          if (
            j.Identifier.check(callExpr.callee) &&
            j.Identifier.check(executor.params[0]) &&
            callExpr.callee.name === executor.params[0].name &&
            callExpr.arguments.length > 0
          ) {
            return true
          }
          // Pattern: (resolve) => func(resolve) - resolve must be the ONLY argument
          if (
            callExpr.arguments.length === 1 &&
            j.Identifier.check(callExpr.arguments[0]) &&
            j.Identifier.check(executor.params[0]) &&
            callExpr.arguments[0].name === executor.params[0].name
          ) {
            return true
          }
        }
        return false
      }

      // For functions with block body containing single resolve(expr) call
      if (body.body.length === 1 && j.ExpressionStatement.check(body.body[0])) {
        const expr = body.body[0].expression
        if (
          j.CallExpression.check(expr) &&
          j.Identifier.check(expr.callee) &&
          expr.callee.name === executor.params[0].name
        ) {
          return true
        }
      }

      return false
    })
    .forEach((path) => {
      const node = path.node
      const executor = node.arguments[0]
      const body = executor.body
      const resolveParam = executor.params[0]

      let expression
      let tryArg

      // Extract the expression
      if (!j.BlockStatement.check(body)) {
        // Arrow function with expression body: (resolve) => expr
        expression = body

        // Check if expression is a call where resolve is passed as the only argument
        // e.g., (resolve) => setTimeout(resolve) should become Promise.try(setTimeout)
        if (
          j.CallExpression.check(expression) &&
          expression.arguments.length === 1 &&
          j.Identifier.check(expression.arguments[0]) &&
          j.Identifier.check(resolveParam) &&
          expression.arguments[0].name === resolveParam.name
        ) {
          // Use the callee directly (e.g., setTimeout)
          tryArg = expression.callee
        }
        // Check if expression is resolve(something)
        else if (
          j.CallExpression.check(expression) &&
          j.Identifier.check(expression.callee) &&
          j.Identifier.check(resolveParam) &&
          expression.callee.name === resolveParam.name &&
          expression.arguments.length > 0
        ) {
          // Extract the argument from resolve(arg) and wrap in arrow function
          expression = expression.arguments[0]
          tryArg = j.arrowFunctionExpression([], expression)
        }
        // Note: No else needed - filter ensures only the above patterns reach here
      } else if (body.body.length === 1 && j.ExpressionStatement.check(body.body[0])) {
        // Block with resolve(expr) call
        const callExpr = body.body[0].expression
        if (j.CallExpression.check(callExpr) && callExpr.arguments.length > 0) {
          expression = callExpr.arguments[0]
          // Wrap expression in arrow function for Promise.try
          tryArg = j.arrowFunctionExpression([], expression)
        }
      }

      if (tryArg) {
        // Create Promise.try(fn)
        const promiseTryCall = j.callExpression(
          j.memberExpression(j.identifier("Promise"), j.identifier("try")),
          [tryArg],
        )

        j(path).replaceWith(promiseTryCall)

        modified = true
        if (node.loc) {
          changes.push({
            type: "promiseTry",
            line: node.loc.start.line,
          })
        }
      }
    })

  return { modified, changes }
}
