import { default as j } from "jscodeshift"

/**
 * Transform manual default value assignment to default parameters.
 * Converts patterns like:
 * - function fn(x) { if (x === undefined) x = defaultValue; ... } → function fn(x = defaultValue) { ... }
 * - function fn(x) { if (x === undefined) { x = defaultValue; } ... } → function fn(x = defaultValue) { ... }
 *
 * Only transforms when:
 * - The assignment is at the beginning of the function body (stops at first non-default statement)
 * - The parameter is not destructured or rest parameter
 * - The check uses strict equality (===) with undefined
 *
 * Note: The `x = x || defaultValue` pattern is NOT transformed because it has different
 * semantics (triggers on any falsy value) and the transformation would be unsafe.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters
 */
export function defaultParameterValues(root) {
  let modified = false

  const functionNodes = [
    ...root.find(j.FunctionDeclaration).paths(),
    ...root.find(j.FunctionExpression).paths(),
    ...root.find(j.ArrowFunctionExpression).paths(),
  ]

  functionNodes.forEach((path) => {
    const func = path.node

    // Skip if function body is not a block statement
    if (!j.BlockStatement.check(func.body)) {
      return
    }

    const body = func.body
    if (body.body.length === 0) {
      return
    }

    /**
     * Generator that yields default parameter patterns from function body.
     *
     * @generator
     * @yields {{ paramName: string, defaultValue: any, statementIndex: number }}
     */
    function* findDefaultPatterns() {
      for (let i = 0; i < body.body.length; i++) {
        const statement = body.body[i]
        let paramName = null
        let defaultValue = null

        // Check for: if (x === undefined) x = defaultValue
        if (
          j.IfStatement.check(statement) &&
          !statement.alternate &&
          j.ExpressionStatement.check(statement.consequent) &&
          j.AssignmentExpression.check(statement.consequent.expression) &&
          statement.consequent.expression.operator === "=" &&
          j.Identifier.check(statement.consequent.expression.left)
        ) {
          const test = statement.test
          const assignment = statement.consequent.expression
          const assignedVar = assignment.left.name

          // Check if test is: x === undefined
          if (
            j.BinaryExpression.check(test) &&
            test.operator === "===" &&
            j.Identifier.check(test.left) &&
            test.left.name === assignedVar &&
            j.Identifier.check(test.right) &&
            test.right.name === "undefined"
          ) {
            paramName = assignedVar
            defaultValue = assignment.right
          }
        }

        // Check for: if (x === undefined) { x = defaultValue; }
        if (
          j.IfStatement.check(statement) &&
          !statement.alternate &&
          j.BlockStatement.check(statement.consequent) &&
          statement.consequent.body.length === 1 &&
          j.ExpressionStatement.check(statement.consequent.body[0]) &&
          j.AssignmentExpression.check(statement.consequent.body[0].expression) &&
          statement.consequent.body[0].expression.operator === "=" &&
          j.Identifier.check(statement.consequent.body[0].expression.left)
        ) {
          const test = statement.test
          const assignment = statement.consequent.body[0].expression
          const assignedVar = assignment.left.name

          // Check if test is: x === undefined
          if (
            j.BinaryExpression.check(test) &&
            test.operator === "===" &&
            j.Identifier.check(test.left) &&
            test.left.name === assignedVar &&
            j.Identifier.check(test.right) &&
            test.right.name === "undefined"
          ) {
            paramName = assignedVar
            defaultValue = assignment.right
          }
        }

        if (paramName) {
          yield { paramName, defaultValue, statementIndex: i }
        } else {
          // Stop looking for default value patterns once we hit a different statement
          break
        }
      }
    }

    // Track parameters that have been assigned defaults
    const paramsWithDefaults = new Map()
    const statementsToRemove = []

    for (const { paramName, defaultValue, statementIndex } of findDefaultPatterns()) {
      // Check if this is a parameter
      const paramIndex = func.params.findIndex(
        (param) => j.Identifier.check(param) && param.name === paramName,
      )

      if (paramIndex !== -1) {
        // Check if parameter doesn't already have a default
        const param = func.params[paramIndex]
        if (!j.AssignmentPattern.check(param)) {
          paramsWithDefaults.set(paramName, {
            paramIndex,
            defaultValue,
            statementIndex,
          })
          statementsToRemove.push(statementIndex)
        }
      }
    }

    // Apply the transformations
    if (paramsWithDefaults.size > 0) {
      // Update parameters with defaults
      paramsWithDefaults.forEach(({ paramIndex, defaultValue }) => {
        const param = func.params[paramIndex]
        func.params[paramIndex] = j.assignmentPattern(param, defaultValue)
      })

      // Remove the statements (in reverse order to maintain indices)
      statementsToRemove.reverse().forEach((index) => {
        body.body.splice(index, 1)
      })

      modified = true
    }
  })

  return modified
}
