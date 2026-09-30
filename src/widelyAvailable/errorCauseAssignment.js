import { default as j } from "jscodeshift"
import { NodeTest, findEnclosingFunction, isShadowed } from "../types.js"

const ERROR_CONSTRUCTOR_TO_OPTIONS_INDEX = new Map([
  ["AggregateError", 2],
  ["Error", 1],
  ["EvalError", 1],
  ["RangeError", 1],
  ["ReferenceError", 1],
  ["SyntaxError", 1],
  ["TypeError", 1],
  ["URIError", 1],
])

/**
 * Return the statement array that contains a declaration, or null when the
 * parent is not a statement container. Statements are either a `SwitchCase`
 * `consequent` or an array `body`; a non-array `body` holds no statements.
 *
 * @param {import("ast-types").NodePath} path - The variable declaration path
 * @returns {import("ast-types").ASTNode[] | null} The statement list, or null
 */
function getStatementList({ parent }) {
  const { node } = parent
  const list = j.SwitchCase.check(node) ? node.consequent : node.body
  return Array.isArray(list) ? list : null
}

/**
 * Return the bound name and constructor call of a declaration, or null when it does not qualify.
 *
 * @param {import("ast-types").NodePath} path - The variable declaration path
 * @returns {{ name: string, newExpression: import("ast-types").ASTNode } | null} The
 *   declared identifier name and constructor call, or null when unsupported
 */
function getErrorConstruction(path) {
  const { declarations } = path.node
  if (declarations.length !== 1) return null
  const { id, init } = declarations[0]
  if (!j.Identifier.check(id) || !j.NewExpression.check(init)) return null
  if (!j.Identifier.check(init.callee)) return null
  const optionsIndex = ERROR_CONSTRUCTOR_TO_OPTIONS_INDEX.get(init.callee.name)
  if (optionsIndex === undefined || init.arguments.length !== optionsIndex) return null
  if (init.arguments.some((argument) => j.SpreadElement.check(argument))) return null
  if (isShadowed(path.get("declarations", 0, "init"), init.callee.name)) return null
  return { name: id.name, newExpression: init }
}

/**
 * Detect a plain `cause` write on the named binding, ignoring computed and compound forms.
 *
 * @param {import("ast-types").ASTNode} statement - The statement to check
 * @param {string} name - The identifier name of the constructed error
 * @returns {boolean} True when the statement is `<name>.cause = ...`
 */
function isCauseAssignment(statement, name) {
  if (!j.ExpressionStatement.check(statement)) return false
  const { expression } = statement
  if (!j.AssignmentExpression.check(expression)) return false
  if (expression.operator !== "=") return false
  const { left } = expression
  if (!j.MemberExpression.check(left) || left.computed) return false
  return (
    j.Identifier.check(left.object) &&
    left.object.name === name &&
    j.Identifier.check(left.property) &&
    left.property.name === "cause"
  )
}

/**
 * Return how many times a name occurs inside a node, including nested functions.
 *
 * @param {import("ast-types").ASTNode} node - The node to search
 * @param {string} name - The identifier name to count
 * @returns {number} The number of matching identifiers
 */
function countIdentifiers(node, name) {
  let count = 0
  j.types.visit(node, {
    visitIdentifier(path) {
      if (path.node.name === name) count++
      this.traverse(path)
    },
  })
  return count
}

/**
 * Preserve the attached `comments` of removed nodes on the node that remains.
 *
 * @param {import("ast-types").ASTNode} target - The statement that remains
 * @param {import("ast-types").ASTNode[]} sources - The removed statements
 * @returns {void}
 */
function transferComments(target, sources) {
  const comments = sources.flatMap((node) => node.comments ?? [])
  target.comments = [...(target.comments ?? []), ...comments]
}

/**
 * Transform `error.cause = cause` assignments into the Error cause option.
 *
 * Transforms:
 * - `const error = new Error("msg"); error.cause = cause; throw error;`
 *   → `throw new Error("msg", { cause });`
 * - `const error = new Error("msg"); error.cause = cause;`
 *   → `const error = new Error("msg", { cause });`
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
 */
export function errorCauseAssignment(root) {
  let modified = false

  root.find(j.VariableDeclaration).forEach((declarationPath) => {
    if (!new NodeTest(declarationPath.node).isVarLetOrConstDeclaration()) {
      return
    }

    const construction = getErrorConstruction(declarationPath)
    if (!construction) return
    const { name, newExpression } = construction

    const statements = getStatementList(declarationPath)
    if (!statements) return
    const index = statements.indexOf(declarationPath.node)
    const assignment = statements[index + 1]
    if (!isCauseAssignment(assignment, name)) return

    // Merging evaluates the cause during construction, so any reference to the
    // declared binding would read it from the temporal dead zone. Nested
    // closures that capture the binding count as references too.
    const cause = assignment.expression.right
    if (countIdentifiers(cause, name) > 0) return

    const causeProperty = j.objectProperty(j.identifier("cause"), cause)
    causeProperty.shorthand = j.Identifier.check(cause)
    newExpression.arguments.push(j.objectExpression([causeProperty]))

    const throwStatement = statements[index + 2]
    const scopePath =
      findEnclosingFunction(declarationPath) ?? root.find(j.Program).paths()[0]
    const canInline =
      j.ThrowStatement.check(throwStatement) &&
      j.Identifier.check(throwStatement.argument) &&
      throwStatement.argument.name === name &&
      countIdentifiers(scopePath.node, name) === 3

    if (canInline) {
      transferComments(throwStatement, [declarationPath.node, assignment])
      throwStatement.argument = newExpression
      statements.splice(index, 2)
    } else {
      transferComments(declarationPath.node, [assignment])
      statements.splice(index + 1, 1)
    }

    modified = true
  })

  return modified
}

errorCauseAssignment.baselineDate = new Date(Date.UTC(2021, 8, 20))
