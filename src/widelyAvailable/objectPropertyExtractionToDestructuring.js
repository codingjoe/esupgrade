import { default as j } from "jscodeshift"

const SKIP_KEYS = new Set(["loc", "start", "end", "tokens", "comments"])

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

  functionNodes.forEach(({ node: func }) => {
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

      if (isParamReferencedInOtherParams(func.params, paramIndex, paramName)) {
        return
      }

      if (wouldPromoteDirective(body, result)) {
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
 * Uses deep traversal that crosses nested function boundaries, since the parameter
 * name is in the outer scope and closures may reference it.
 *
 * @param {import("ast-types").namedTypes.BlockStatement} body - The function body
 * @param {string} paramName - The parameter identifier name
 * @param {{ extractions: Array, boundary: number }} result - Result from findExtractions
 * @returns {boolean} True if the parameter is used after the extractions
 */
function isParamUsedAfterExtractions(body, paramName, result) {
  const remainingStatements = body.body.slice(result.boundary)

  if (remainingStatements.some((stmt) => deepContainsIdentifier(stmt, paramName))) {
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

      if (!declarator.init) {
        return false
      }

      return deepContainsIdentifier(declarator.init, paramName)
    })
  })
}

/**
 * Check if removing extraction statements would promote a "use strict" string literal
 * to a function directive. Non-simple parameter lists (destructuring) cannot have a
 * "use strict" directive.
 *
 * @param {import("ast-types").namedTypes.BlockStatement} body - The function body
 * @param {{ extractions: Array<{statementIndex: number, declaratorIndex: number}>, boundary: number }} result - Result from findExtractions
 * @returns {boolean} True if the transformation would produce an illegal directive
 */
function wouldPromoteDirective(body, result) {
  const extractionSet = new Set(
    result.extractions.map(
      ({ statementIndex, declaratorIndex }) => `${statementIndex}:${declaratorIndex}`,
    ),
  )

  for (let i = 0; i < result.boundary; i++) {
    const statement = body.body[i]
    const hasRemainingDeclarators = statement.declarations.some(
      (_, di) => !extractionSet.has(`${i}:${di}`),
    )

    if (hasRemainingDeclarators) {
      return false
    }
  }

  const nextStatement = body.body[result.boundary]

  return (
    nextStatement !== undefined &&
    j.ExpressionStatement.check(nextStatement) &&
    isStringLiteralNode(nextStatement.expression) &&
    nextStatement.expression.value === "use strict"
  )
}

/**
 * Check if the parameter identifier is referenced in any other parameter in the list.
 * Covers default values such as `function fn(obj, y = obj.x)`.
 *
 * @param {Array<import("ast-types").ASTNode>} params - The full parameter list
 * @param {number} paramIndex - Index of the parameter being transformed
 * @param {string} paramName - The parameter identifier name
 * @returns {boolean} True if the identifier appears in another parameter
 */
function isParamReferencedInOtherParams(params, paramIndex, paramName) {
  return params.some(
    (param, i) => i !== paramIndex && deepContainsIdentifier(param, paramName),
  )
}

/**
 * Deeply check if an identifier name appears anywhere in an AST subtree,
 * including inside nested functions and arrow functions.
 *
 * @param {import("ast-types").ASTNode | null | undefined} node - The node to search
 * @param {string} name - The identifier name to search for
 * @returns {boolean} True if the identifier is found anywhere in the subtree
 */
function deepContainsIdentifier(node, name) {
  if (!node || typeof node !== "object") {
    return false
  }

  if (node.type === "Identifier" && node.name === name) {
    return true
  }

  for (const key in node) {
    if (SKIP_KEYS.has(key)) {
      continue
    }

    const value = node[key]

    if (Array.isArray(value)) {
      if (value.some((item) => deepContainsIdentifier(item, name))) {
        return true
      }
    } else if (value && typeof value === "object") {
      if (deepContainsIdentifier(value, name)) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if a node is a string literal.
 *
 * @param {import("ast-types").ASTNode} node - The node to check
 * @returns {boolean} True if the node is a string literal
 */
function isStringLiteralNode(node) {
  return j.StringLiteral.check(node)
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

  for (const [statementIndex, declaratorIndices] of [...statementMap.entries()].sort(
    (a, b) => b[0] - a[0],
  )) {
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
  }
}
objectPropertyExtractionToDestructuring.baselineDate = "2020-01-15"
