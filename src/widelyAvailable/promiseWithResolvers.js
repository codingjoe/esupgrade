import { default as j } from "jscodeshift"
import { isShadowed, ReassignmentIndex } from "../types.js"

/**
 * Transform deferred promise resolve/reject capture to Promise.withResolvers().
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
 */
export function promiseWithResolvers(root) {
  const statementLists = [
    ...root.find(j.Program).paths(),
    ...root.find(j.BlockStatement).paths(),
  ]
  let reassignments = null
  let modified = false

  for (const listPath of statementLists) {
    const statements = listPath.node.body

    for (let index = statements.length - 1; index >= 0; index--) {
      const match = matchDeferredPromise(listPath, index)

      if (!match) {
        continue
      }

      reassignments ??= new ReassignmentIndex(root)

      if (!isVerifiableMatch(root, reassignments, match)) {
        continue
      }

      applyDeferredPromise(statements, index, match)
      modified = true
    }
  }

  return modified
}

/**
 * Verify a matched pattern against the writes and references of the root.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @param {ReassignmentIndex} reassignments - Indexed writes of the root
 * @param {{ promiseName: string, bindingNames: string[], identifier: import("ast-types").namedTypes.Identifier }} match - The matched pattern
 * @returns {boolean} True when the pattern can be rewritten without changing behaviour
 */
function isVerifiableMatch(root, reassignments, match) {
  if (match.bindingNames.some((name) => reassignments.getPathsFor(name).length !== 1)) {
    return false
  }

  if (reassignments.getPathsFor(match.promiseName).length > 0) {
    return false
  }

  return isReferencedBesidesDeclarator(root, match.identifier)
}

/**
 * Replace a matched deferred promise pattern with a withResolvers declaration.
 *
 * @param {import("ast-types").ASTNode[]} statements - The statements of the list
 * @param {number} index - The index of the first binding declaration
 * @param {{ statementCount: number, promiseName: string, bindingNames: string[] }} match - The matched pattern
 */
function applyDeferredPromise(statements, index, match) {
  const replaced = statements.slice(index, index + match.statementCount + 1)
  const declaration = createWithResolversDeclaration(
    match.promiseName,
    match.bindingNames,
  )

  declaration.comments = replaced.flatMap((statement) => statement.comments ?? [])
  statements.splice(index, replaced.length, declaration)
}

/**
 * Match a deferred promise pattern at a statement index.
 *
 * @param {import("ast-types").NodePath} listPath - The path of the statement list
 * @param {number} index - The index of the first binding declaration
 * @returns {{ statementCount: number, promiseName: string, bindingNames: string[], identifier: import("ast-types").namedTypes.Identifier } | null} The matched pattern
 */
function matchDeferredPromise(listPath, index) {
  const bindings = collectBindingIdentifiers(listPath.node.body, index)

  if (!bindings) {
    return null
  }

  const bindingNames = bindings.identifiers.map((identifier) => identifier.name)

  const promisePath = listPath.get("body", index + bindings.statementCount)
  const promise = matchPromiseDeclaration(promisePath.node)

  if (!promise) {
    return null
  }

  const assignsBindings = isExecutorAssigningBindings(promise.executor, bindingNames)

  if (!assignsBindings || isShadowed(promisePath, "Promise")) {
    return null
  }

  return {
    statementCount: bindings.statementCount,
    promiseName: promise.identifier.name,
    bindingNames,
    identifier: promise.identifier,
  }
}

/**
 * Collect the two deferred binding identifiers of a candidate pattern.
 *
 * @param {import("ast-types").ASTNode[]} body - The statements of the list
 * @param {number} index - The index of the first binding declaration
 * @returns {{ identifiers: import("ast-types").namedTypes.Identifier[], statementCount: number } | null} The binding identifiers and the number of declarations
 */
function collectBindingIdentifiers(body, index) {
  const first = matchBindingDeclaration(body[index])

  if (!first) {
    return null
  }

  if (first.length === 2) {
    return { identifiers: first, statementCount: 1 }
  }

  const second = matchBindingDeclaration(body[index + 1])

  if (first.length === 1 && second && second.length === 1) {
    return { identifiers: [...first, ...second], statementCount: 2 }
  }

  return null
}

/**
 * Match a `let` declaration of uninitialized bindings.
 *
 * @param {import("ast-types").ASTNode} statement - The statement to match
 * @returns {import("ast-types").namedTypes.Identifier[] | null} The declared identifiers, or null
 */
function matchBindingDeclaration(statement) {
  if (
    !j.VariableDeclaration.check(statement) ||
    statement.kind !== "let" ||
    // joe: own flag only; an ambient declare module/global body needs a walk
    statement.declare === true
  ) {
    return null
  }

  const declarators = statement.declarations

  if (!declarators.every(isUninitializedIdentifier)) {
    return null
  }

  return declarators.map((declarator) => declarator.id)
}

/**
 * Check if a declarator declares a bare identifier without initializer.
 *
 * @param {import("ast-types").namedTypes.VariableDeclarator} declarator - The declarator to check
 * @returns {boolean} True if the declarator declares an uninitialized, untyped identifier
 */
function isUninitializedIdentifier(declarator) {
  return (
    j.Identifier.check(declarator.id) &&
    !declarator.init &&
    !declarator.id.typeAnnotation
  )
}

/**
 * Match a promise declaration initialized with `new Promise(executor)`.
 *
 * @param {import("ast-types").ASTNode} statement - The statement to match
 * @returns {{ identifier: import("ast-types").namedTypes.Identifier, executor: import("ast-types").ASTNode } | null} The promise binding and executor, or null
 */
function matchPromiseDeclaration(statement) {
  if (!j.VariableDeclaration.check(statement)) {
    return null
  }

  if (statement.kind !== "const" && statement.kind !== "let") {
    return null
  }

  if (statement.declarations.length !== 1) {
    return null
  }

  const [declarator] = statement.declarations

  if (!j.Identifier.check(declarator.id) || declarator.id.typeAnnotation) {
    return null
  }

  const executor = getPromiseExecutor(declarator.init)

  if (!executor) {
    return null
  }

  return { identifier: declarator.id, executor }
}

/**
 * Get the executor argument of a `new Promise()` initializer.
 *
 * @param {import("ast-types").ASTNode} node - The initializer to match
 * @returns {import("ast-types").ASTNode | null} The promise executor, or null
 */
function getPromiseExecutor(node) {
  if (!j.NewExpression.check(node) || !j.Identifier.check(node.callee)) {
    return null
  }

  if (node.callee.name !== "Promise" || node.typeParameters) {
    return null
  }

  return node.arguments.length === 1 ? node.arguments[0] : null
}

/**
 * Check if an executor assigns both deferred bindings.
 *
 * @param {import("ast-types").ASTNode} executor - The promise executor
 * @param {string[]} bindingNames - The deferred binding names
 * @returns {boolean} True if the executor assigns each binding exactly once
 */
function isExecutorAssigningBindings(executor, bindingNames) {
  if (
    !j.FunctionExpression.check(executor) &&
    !j.ArrowFunctionExpression.check(executor)
  ) {
    return false
  }

  // A generator body never runs, and a function name binds its own identifier
  // inside the body, where the assignments would target it instead.
  if (executor.generator || bindingNames.includes(executor.id?.name)) {
    return false
  }

  const { params, body } = executor

  if (!j.BlockStatement.check(body) || params.length !== 2) {
    return false
  }

  if (!params.every((param) => j.Identifier.check(param))) {
    return false
  }

  if (params.some((param) => bindingNames.includes(param.name))) {
    return false
  }

  if (body.body.length !== 2) {
    return false
  }

  const assignmentNames = body.body.map((statement) =>
    matchExecutorAssignment(statement, params, bindingNames),
  )

  return !assignmentNames.includes(null) && new Set(assignmentNames).size === 2
}

/**
 * Match an assignment of an executor parameter to a deferred binding.
 *
 * @param {import("ast-types").ASTNode} statement - The assignment statement
 * @param {import("ast-types").namedTypes.Identifier[]} params - The executor parameters
 * @param {string[]} bindingNames - The deferred binding names
 * @returns {string | null} The assigned binding name, or null
 */
function matchExecutorAssignment(statement, params, bindingNames) {
  if (!j.ExpressionStatement.check(statement)) {
    return null
  }

  const { expression } = statement

  if (!j.AssignmentExpression.check(expression) || expression.operator !== "=") {
    return null
  }

  const { left, right } = expression

  if (!j.Identifier.check(left) || !j.Identifier.check(right)) {
    return null
  }

  const bindingIndex = bindingNames.indexOf(left.name)

  if (bindingIndex === -1 || right.name !== params[bindingIndex].name) {
    return null
  }

  return left.name
}

/**
 * Check if the promise binding is referenced besides its declarator.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @param {import("ast-types").namedTypes.Identifier} identifier - The declared identifier
 * @returns {boolean} True if the name occurs outside the declarator
 */
function isReferencedBesidesDeclarator(root, identifier) {
  return root
    .find(j.Identifier, { name: identifier.name })
    .some((path) => path.node !== identifier)
}

/**
 * Create a `Promise.withResolvers()` destructuring declaration.
 *
 * @param {string} promiseName - The name of the promise binding
 * @param {string[]} bindingNames - The deferred binding names
 * @returns {import("ast-types").namedTypes.VariableDeclaration} The replacement declaration
 */
function createWithResolversDeclaration(promiseName, bindingNames) {
  const properties = [
    ["promise", promiseName],
    ["resolve", bindingNames[0]],
    ["reject", bindingNames[1]],
  ].map(([propertyName, localName]) => {
    const property = j.objectProperty(
      j.identifier(propertyName),
      j.identifier(localName),
    )
    property.shorthand = propertyName === localName
    return property
  })

  return j.variableDeclaration("const", [
    j.variableDeclarator(
      j.objectPattern(properties),
      j.callExpression(
        j.memberExpression(
          j.identifier("Promise"),
          j.identifier("withResolvers"),
          false,
        ),
        [],
      ),
    ),
  ])
}
promiseWithResolvers.baselineDate = new Date(Date.UTC(2024, 2, 5))
