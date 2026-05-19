import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform manual property extraction to destructuring in function parameters.
 * Converts patterns where a function body begins with property extractions from a
 * parameter into an object destructuring pattern in the parameter list.
 *
 * Only transforms when:
 * - The parameter is a simple identifier (not already destructured or rest)
 * - Leading statements are `const`/`let`/`var` declarations extracting non-computed
 *   properties from that parameter
 * - The original parameter identifier is not referenced after the extraction zone
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
 */
export function objectPropertyExtractionToDestructuring(root) {
  let modified = false

  const functionNodes = [
    ...root.find(j.FunctionDeclaration).paths(),
    ...root.find(j.FunctionExpression).paths(),
    ...root.find(j.ArrowFunctionExpression).paths(),
  ]

  functionNodes.forEach((path) => {
    const func = path.node

    if (!j.BlockStatement.check(func.body)) {
      return
    }

    const body = func.body

    func.params.forEach((param, paramIndex) => {
      if (!j.Identifier.check(param)) {
        return
      }

      const paramName = param.name
      const result = findExtractions(body, paramName)

      if (result.extractions.length === 0) {
        return
      }

      if (isParamUsedAfterExtractions(body, paramName, result)) {
        return
      }

      func.params[paramIndex] = buildObjectPattern(result.extractions, param)
      removeExtractionDeclarators(body, result.extractions)
      modified = true
    })
  })

  return modified
}

/**
 * Find leading property extractions from a named parameter in a function body.
 *
 * @param {import("ast-types").namedTypes.BlockStatement} body - The function body
 * @param {string} paramName - The parameter identifier name to extract from
 * @returns {{ extractions: Array<{localName: string, propertyName: string, statementIndex: number, declaratorIndex: number}>, boundary: number }}
 */
function findExtractions(body, paramName) {
  const extractions = []
  let boundary = 0

  for (let i = 0; i < body.body.length; i++) {
    const statement = body.body[i]

    if (!j.VariableDeclaration.check(statement)) {
      break
    }

    let hasExtractionInStatement = false

    statement.declarations.forEach((declarator, declaratorIndex) => {
      if (isPropertyExtractionFrom(declarator, paramName)) {
        extractions.push({
          localName: declarator.id.name,
          propertyName: declarator.init.property.name,
          statementIndex: i,
          declaratorIndex,
        })
        hasExtractionInStatement = true
      }
    })

    if (!hasExtractionInStatement) {
      break
    }

    boundary = i + 1
  }

  return { extractions, boundary }
}

/**
 * Check if a variable declarator is a non-computed property access from a named identifier.
 *
 * @param {import("ast-types").namedTypes.VariableDeclarator} declarator - The declarator to check
 * @param {string} paramName - The identifier name to check against
 * @returns {boolean} True if the declarator extracts a property from paramName
 */
function isPropertyExtractionFrom(declarator, paramName) {
  return (
    j.Identifier.check(declarator.id) &&
    j.MemberExpression.check(declarator.init) &&
    !declarator.init.computed &&
    j.Identifier.check(declarator.init.object) &&
    declarator.init.object.name === paramName &&
    j.Identifier.check(declarator.init.property)
  )
}

/**
 * Check if the original parameter identifier is still referenced after the extraction zone.
 *
 * @param {import("ast-types").namedTypes.BlockStatement} body - The function body
 * @param {string} paramName - The parameter identifier name
 * @param {{ extractions: Array, boundary: number }} result - Result from findExtractions
 * @returns {boolean} True if the parameter is used after the extractions
 */
function isParamUsedAfterExtractions(body, paramName, result) {
  const remainingStatements = body.body.slice(result.boundary)
  const remainingBlock = j.blockStatement(remainingStatements)

  if (new NodeTest(remainingBlock).usesIdentifier(paramName)) {
    return true
  }

  return isMixedDeclaratorUsingParam(body, paramName, result.extractions)
}

/**
 * Check if any non-extraction declarator in the extraction zone references the parameter.
 *
 * @param {import("ast-types").namedTypes.BlockStatement} body - The function body
 * @param {string} paramName - The parameter identifier name
 * @param {Array<{statementIndex: number, declaratorIndex: number}>} extractions - The found extractions
 * @returns {boolean} True if the parameter is used in a non-extraction declarator
 */
function isMixedDeclaratorUsingParam(body, paramName, extractions) {
  const extractionSet = new Set(
    extractions.map(
      ({ statementIndex, declaratorIndex }) => `${statementIndex}:${declaratorIndex}`,
    ),
  )

  return body.body.some((statement, statementIndex) => {
    if (!j.VariableDeclaration.check(statement)) {
      return false
    }

    return statement.declarations.some((declarator, declaratorIndex) => {
      if (extractionSet.has(`${statementIndex}:${declaratorIndex}`)) {
        return false
      }

      return new NodeTest(declarator.init).usesIdentifier(paramName)
    })
  })
}

/**
 * Build an ObjectPattern AST node from a list of property extractions.
 * Preserves TypeScript type annotations from the original parameter.
 *
 * @param {Array<{localName: string, propertyName: string}>} extractions - The extractions to build from
 * @param {import("ast-types").namedTypes.Identifier} originalParam - The original parameter node
 * @returns {import("ast-types").namedTypes.ObjectPattern} The destructuring pattern
 */
function buildObjectPattern(extractions, originalParam) {
  const properties = extractions.map(({ localName, propertyName }) => {
    const key = j.identifier(propertyName)
    const value = j.identifier(localName)
    const isShorthand = localName === propertyName
    const prop = j.objectProperty(key, value)
    prop.shorthand = isShorthand
    return prop
  })

  const pattern = j.objectPattern(properties)

  if (originalParam.typeAnnotation) {
    pattern.typeAnnotation = originalParam.typeAnnotation
  }

  return pattern
}

/**
 * Remove extraction declarators from the function body, removing empty statements.
 *
 * @param {import("ast-types").namedTypes.BlockStatement} body - The function body to modify
 * @param {Array<{statementIndex: number, declaratorIndex: number}>} extractions - The extractions to remove
 */
function removeExtractionDeclarators(body, extractions) {
  const statementMap = new Map()

  extractions.forEach(({ statementIndex, declaratorIndex }) => {
    if (!statementMap.has(statementIndex)) {
      statementMap.set(statementIndex, [])
    }
    statementMap.get(statementIndex).push(declaratorIndex)
  })

  Array.from(statementMap.entries())
    .sort(([a], [b]) => b - a)
    .forEach(([statementIndex, declaratorIndices]) => {
      const statement = body.body[statementIndex]

      declaratorIndices
        .slice()
        .sort((a, b) => b - a)
        .forEach((di) => {
          statement.declarations.splice(di, 1)
        })

      if (statement.declarations.length === 0) {
        body.body.splice(statementIndex, 1)
      }
    })
}
