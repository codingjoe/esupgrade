import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform arguments object usage to rest parameters.
 * Converts patterns like:
 * - const args = Array.from(arguments) → function fn(...args) {}
 * - const args = [].slice.call(arguments) → function fn(...args) {}
 *
 * Only transforms when:
 * - Function is a regular function (not arrow function)
 * - Function doesn't already have rest parameters
 * - arguments is only used in the variable declaration being converted
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters
 */
export function argumentsToRestParameters(root) {
  let modified = false

  const functionNodes = [
    ...root.find(j.FunctionDeclaration).paths(),
    ...root.find(j.FunctionExpression).paths(),
  ]

  functionNodes.forEach((path) => {
    const func = path.node
    if (
      (func.params.length > 0 &&
        j.RestElement.check(func.params[func.params.length - 1])) ||
      !j.BlockStatement.check(func.body)
    ) {
      return
    }

    const body = func.body
    const declaratorsToRemove = []
    let accountedUsages = 0

    body.body.forEach((statement, statementIndex) => {
      if (!j.VariableDeclaration.check(statement)) return

      statement.declarations.forEach((declarator, declaratorIndex) => {
        if (!j.Identifier.check(declarator.id)) return

        const varName = declarator.id.name
        const initTest = new NodeTest(declarator.init)

        if (initTest.isArrayFromArguments() || initTest.isArraySliceCallArguments()) {
          accountedUsages++
          declaratorsToRemove.push({ statementIndex, declaratorIndex, varName })
        }
      })
    })

    if (declaratorsToRemove.length > 0) {
      const bodyTest = new NodeTest(body)
      const totalUsages = bodyTest.countIdentifierUsages("arguments")

      if (totalUsages > accountedUsages) {
        return
      }

      declaratorsToRemove.forEach(({ varName }) => {
        func.params.push(j.restElement(j.identifier(varName)))
      })

      modified = true

      // Remove the declarators (in reverse order to maintain indices)
      declaratorsToRemove
        .slice()
        .reverse()
        .forEach(({ statementIndex, declaratorIndex }) => {
          const statement = body.body[statementIndex]
          // Remove the specific declarator
          statement.declarations.splice(declaratorIndex, 1)

          // If the statement has no more declarators, remove the entire statement
          if (statement.declarations.length === 0) {
            body.body.splice(statementIndex, 1)
          }
        })
    }
  })

  return modified
}
