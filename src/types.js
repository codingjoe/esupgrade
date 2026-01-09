import { default as j } from "jscodeshift"

const SKIP_KEYS = new Set(["loc", "start", "end", "tokens", "comments", "type"])
const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
])

/**
 * Wrapper class for AST nodes providing utility methods.
 *
 * @property {import("ast-types").ASTNode} node - The underlying AST node
 */
export class NodeTest {
  constructor(node) {
    this.node = node
  }

  /**
   * Check if node is an array literal.
   *
   * @returns {boolean} True if node is an ArrayExpression
   */
  isArrayLiteral() {
    return j.ArrayExpression.check(this.node)
  }

  /**
   * Check if node is a new Array() expression.
   *
   * @returns {boolean} True if node is new Array()
   */
  isNewArray() {
    return (
      j.NewExpression.check(this.node) &&
      j.Identifier.check(this.node.callee) &&
      this.node.callee.name === "Array"
    )
  }

  /**
   * Check if node is an Array.method() static call.
   *
   * @param {string} [methodName] - Optional specific method name to check for
   * @returns {boolean} True if node is Array.from(), Array.of(), etc.
   */
  isArrayStaticCall(methodName) {
    if (
      j.CallExpression.check(this.node) &&
      j.MemberExpression.check(this.node.callee) &&
      j.Identifier.check(this.node.callee.object) &&
      this.node.callee.object.name === "Array"
    ) {
      if (methodName) {
        return (
          j.Identifier.check(this.node.callee.property) &&
          this.node.callee.property.name === methodName
        )
      }
      return true
    }
    return false
  }

  /**
   * Check if node is a method call on a string literal returning one of the specified types.
   *
   * @param {string[]} methodNames - Method names to check for
   * @returns {boolean} True if node matches the pattern
   */
  isStringLiteralMethodCall(methodNames) {
    return (
      j.CallExpression.check(this.node) &&
      j.MemberExpression.check(this.node.callee) &&
      j.Identifier.check(this.node.callee.property) &&
      j.StringLiteral.check(this.node.callee.object) &&
      methodNames.includes(this.node.callee.property.name)
    )
  }

  /**
   * Check if node is an array method call returning an array, recursively checking the object.
   *
   * @param {string[]} methodNames - Array method names that return arrays
   * @returns {boolean} True if node is an array method call on a known array/string
   */
  isArrayMethodChain(methodNames) {
    if (
      j.CallExpression.check(this.node) &&
      j.MemberExpression.check(this.node.callee) &&
      j.Identifier.check(this.node.callee.property) &&
      methodNames.includes(this.node.callee.property.name)
    ) {
      return new NodeTest(this.node.callee.object).hasIndexOfAndIncludes()
    }
    return false
  }

  /**
   * Check if an expression is statically verifiable as iterable. Used by transformers
   * to ensure they only transform known iterable types.
   *
   * @returns {boolean} True if the node can be verified as iterable
   */
  isIterable() {
    if (this.isArrayLiteral()) {
      return true
    }

    if (this.isArrayStaticCall()) {
      return true
    }

    if (this.isNewArray()) {
      return true
    }

    const STRING_METHODS_RETURNING_ITERABLE = [
      "matchAll",
      "split",
      "slice",
      "substr",
      "substring",
      "toLowerCase",
      "toUpperCase",
      "trim",
      "trimStart",
      "trimEnd",
    ]

    return this.isStringLiteralMethodCall(STRING_METHODS_RETURNING_ITERABLE)
  }

  /**
   * Check if an expression is statically verifiable as an array or string.
   * Used by transformers to ensure they only transform known types that support
   * both indexOf and includes methods.
   *
   * @returns {boolean} True if the node can be verified as an array or string
   */
  hasIndexOfAndIncludes() {
    if (this.isArrayLiteral()) {
      return true
    }

    if (this.isNewArray()) {
      return true
    }

    // String literal: "hello"
    if (j.StringLiteral.check(this.node) || j.Literal.check(this.node)) {
      return typeof this.node.value === "string"
    }

    // Template literal: `hello`
    if (j.TemplateLiteral.check(this.node)) {
      return true
    }

    const STRING_METHODS_RETURNING_STRING = [
      "slice",
      "substr",
      "substring",
      "toLowerCase",
      "toUpperCase",
      "trim",
      "trimStart",
      "trimEnd",
      "trimLeft",
      "trimRight",
      "repeat",
      "padStart",
      "padEnd",
      "concat",
      "replace",
      "replaceAll",
    ]

    if (this.isStringLiteralMethodCall(STRING_METHODS_RETURNING_STRING)) {
      return true
    }

    const ARRAY_METHODS_RETURNING_ARRAY = [
      "slice",
      "concat",
      "map",
      "filter",
      "flat",
      "flatMap",
      "reverse",
      "sort",
      "splice",
    ]

    return this.isArrayMethodChain(ARRAY_METHODS_RETURNING_ARRAY)
  }

  /**
   * Check if two AST nodes are structurally equivalent. Compares identifiers, literals,
   * member expressions, and call expressions recursively.
   *
   * @param {import("ast-types").ASTNode} other - Second node to
   *   compare
   * @returns {boolean} True if nodes are structurally equivalent
   */
  isEqual(other) {
    // Both are identifiers with same name
    if (j.Identifier.check(this.node) && j.Identifier.check(other)) {
      return this.node.name === other.name
    }

    // Both are literals with same value
    if (j.Literal.check(this.node) && j.Literal.check(other)) {
      return this.node.value === other.value
    }

    // Both are member expressions
    if (j.MemberExpression.check(this.node) && j.MemberExpression.check(other)) {
      return (
        new NodeTest(this.node.object).isEqual(other.object) &&
        new NodeTest(this.node.property).isEqual(other.property) &&
        this.node.computed === other.computed
      )
    }

    // Both are call expressions
    if (j.CallExpression.check(this.node) && j.CallExpression.check(other)) {
      // Check if callees are equivalent
      if (!new NodeTest(this.node.callee).isEqual(other.callee)) {
        return false
      }
      // Check if argument counts match
      if (this.node.arguments.length !== other.arguments.length) {
        return false
      }
      // Check if all arguments are equivalent
      for (let i = 0; i < this.node.arguments.length; i++) {
        if (!new NodeTest(this.node.arguments[i]).isEqual(other.arguments[i])) {
          return false
        }
      }
      return true
    }

    return false
  }

  /**
   * Get the raw value of a string literal, preserving escape sequences.
   *
   * @returns {string} The raw string content with template literal characters escaped
   */
  getRawStringValue() {
    // node.extra.raw contains the original source code including quotes.
    // For example, for source "foo\r\n", extra.raw is the literal text "\"foo\\r\\n\"", where "\r" and "\n"
    // are the two-character escape sequences backslash-r and backslash-n from the source, not control characters.
    // We need to strip the quotes and escape template literal-specific characters.
    // Template literals need escaping for:
    // - Backtick ` needs to be escaped as \`
    // - Dollar-brace ${ needs to be escaped as \${ to prevent template expression evaluation
    if (!this.node.extra || !this.node.extra.raw || this.node.extra.raw.length < 2) {
      // Fallback to using the value if extra.raw is not available
      // This should not happen with the tsx parser, but provides a safe fallback
      // When using node.value, we need to escape control characters and backslashes
      return String(this.node.value)
        .replace(/\\/g, "\\\\")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")
        .replace(/`/g, "\\`")
        .replace(/\$\{/g, "\\${")
      // Note: We don't escape \n here because template literals can contain actual newlines
    }
    const rawWithoutQuotes = this.node.extra.raw.slice(1, -1)
    // Note: We intentionally do NOT escape backslashes here because node.extra.raw
    // already contains the escape sequences as they appear in the source code.
    // We replace \n escape sequences (backslash-n, not actual newline characters) with actual newlines
    // to leverage template literal multiline capability.
    // However, we keep \r as an escape sequence since carriage returns are not typically used in source.
    // We only need to escape template literal-specific characters that would break the template literal syntax.
    return rawWithoutQuotes
      .replace(/\\n/g, "\n")
      .replace(/`/g, "\\`")
      .replace(/\$\{/g, "\\${")
  }

  /**
   * Traverse an AST node recursively, calling a predicate on each node.
   * Stop traversal into nested functions as they have their own scope.
   *
   * @param {import("ast-types").ASTNode} astNode - The node to traverse
   * @param {function(import("ast-types").ASTNode): boolean} predicate - Return true if found
   * @returns {boolean} True if predicate returned true for any node
   */
  #traverseForPredicate(astNode, predicate) {
    if (predicate(astNode)) {
      return true
    }

    if (FUNCTION_TYPES.has(astNode.type)) {
      return false
    }

    for (const key in astNode) {
      if (SKIP_KEYS.has(key)) {
        continue
      }
      const value = astNode[key]
      if (Array.isArray(value)) {
        for (const item of value) {
          if (this.#traverseForPredicate(item, predicate)) {
            return true
          }
        }
      } else if (value && typeof value === "object") {
        if (this.#traverseForPredicate(value, predicate)) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if a node or its descendants use 'this'. Does not traverse into nested
   * functions as they have their own 'this' context.
   *
   * @returns {boolean} True if 'this' is used in the node
   */
  usesThis() {
    return this.#traverseForPredicate(
      this.node,
      (node) => node.type === "ThisExpression",
    )
  }

  /**
   * Check if a node or its descendants use 'arguments'. Does not traverse into nested
   * functions as they have their own 'arguments' binding. Arrow functions also don't
   * have 'arguments', so we skip them too.
   *
   * @returns {boolean} True if 'arguments' is used in the node
   */
  usesArguments() {
    const body = j.BlockStatement.check(this.node) ? this.node.body : [this.node]
    for (const statement of body) {
      if (
        this.#traverseForPredicate(
          statement,
          (node) => node.type === "Identifier" && node.name === "arguments",
        )
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Check if a function can be safely converted to a class method.
   * Function expressions are always safe. Arrow functions are safe only if they don't use 'this'.
   *
   * @returns {boolean} True if the function can be converted to a class method
   */
  canBeClassMethod() {
    if (j.FunctionExpression.check(this.node)) {
      return true
    } else if (j.ArrowFunctionExpression.check(this.node)) {
      return !new NodeTest(this.node.body).usesThis()
    }
    return false
  }

  /**
   * Convert a function's body to a block statement.
   * For arrow functions with expression bodies, wrap the expression in a return statement.
   *
   * @returns {import("ast-types").namedTypes.BlockStatement} The function body as a block statement.
   */
  toBlockStatement() {
    if (j.BlockStatement.check(this.node.body)) {
      return this.node.body
    } else if (j.ArrowFunctionExpression.check(this.node)) {
      return j.blockStatement([j.returnStatement(this.node.body)])
    }
  }

  /**
   * Check if node is a string literal.
   *
   * @returns {boolean} True if node is a StringLiteral or a string-valued Literal
   */
  isStringLiteral() {
    return (
      j.StringLiteral.check(this.node) ||
      (j.Literal.check(this.node) && typeof this.node.value === "string")
    )
  }

  /**
   * Check if node or its binary '+' children contain a string literal.
   *
   * @returns {boolean} True if string literal is found in the expression chain
   */
  containsStringLiteral() {
    if (this.isStringLiteral()) {
      return true
    }
    if (j.BinaryExpression.check(this.node) && this.node.operator === "+") {
      return (
        new NodeTest(this.node.left).containsStringLiteral() ||
        new NodeTest(this.node.right).containsStringLiteral()
      )
    }
    return false
  }

  /**
   * Check if a node is a property access or call on a base.
   *
   * @param {import("ast-types").ASTNode} base - The expected base
   * @returns {boolean} True if node accesses base
   */
  isAccessOnBase(base) {
    if (j.MemberExpression.check(this.node)) {
      return new NodeTest(this.node.object).isEqual(base)
    }
    if (j.CallExpression.check(this.node)) {
      return new NodeTest(this.node.callee).isEqual(base)
    }
    return false
  }

  /**
   * Check if node is a constructor-like name (starts with uppercase).
   *
   * @returns {boolean} True if the identifier name is uppercase
   */
  isConstructorName() {
    return (
      j.Identifier.check(this.node) && this.node.name && /^[A-Z]/.test(this.node.name)
    )
  }

  /**
   * Check if a function body contains only simple constructor statements.
   *
   * @returns {boolean} True if the body contains only allowed statements
   */
  hasSimpleConstructorBody() {
    return (
      j.BlockStatement.check(this.node) &&
      this.node.body.every(
        (statement) =>
          j.VariableDeclaration.check(statement) ||
          j.ExpressionStatement.check(statement) ||
          j.IfStatement.check(statement) ||
          j.ForOfStatement.check(statement) ||
          j.ForInStatement.check(statement) ||
          (j.ReturnStatement.check(statement) && statement.argument == null),
      )
    )
  }

  /**
   * Check if identifier is used in the node, ignoring nested functions.
   *
   * @param {string} name - Identifier name to search for
   * @returns {boolean} True if identifier name is found
   */
  usesIdentifier(name) {
    return this.#traverseForPredicate(
      this.node,
      (node) => node.type === "Identifier" && node.name === name,
    )
  }

  /**
   * Count how many times an identifier is used in the node, ignoring nested functions.
   *
   * @param {string} name - Identifier name to count
   * @returns {number} Number of usages
   */
  countIdentifierUsages(name) {
    let count = 0
    this.#traverseForPredicate(this.node, (node) => {
      if (node.type === "Identifier" && node.name === name) {
        count++
      }
      return false // Continue traversing
    })
    return count
  }

  /**
   * Check if node eventually chains from document.
   *
   * @returns {boolean} True if it is document or a chain from document
   */
  isFromDocument() {
    if (j.Identifier.check(this.node)) {
      return this.node.name === "document"
    }
    if (j.MemberExpression.check(this.node)) {
      return new NodeTest(this.node.object).isFromDocument()
    }
    if (j.CallExpression.check(this.node)) {
      if (j.MemberExpression.check(this.node.callee)) {
        return new NodeTest(this.node.callee.object).isFromDocument()
      }
    }
    return false
  }

  /**
   * Check if node is Array.from(arguments).
   *
   * @returns {boolean} True if matches pattern
   */
  isArrayFromArguments() {
    return (
      this.isArrayStaticCall("from") &&
      this.node.arguments.length === 1 &&
      j.Identifier.check(this.node.arguments[0]) &&
      this.node.arguments[0].name === "arguments"
    )
  }

  /**
   * Check if node is [].slice.call(arguments).
   *
   * @returns {boolean} True if matches pattern
   */
  isArraySliceCallArguments() {
    return (
      j.CallExpression.check(this.node) &&
      j.MemberExpression.check(this.node.callee) &&
      j.MemberExpression.check(this.node.callee.object) &&
      j.ArrayExpression.check(this.node.callee.object.object) &&
      this.node.callee.object.object.elements.length === 0 &&
      j.Identifier.check(this.node.callee.object.property) &&
      this.node.callee.object.property.name === "slice" &&
      j.Identifier.check(this.node.callee.property) &&
      this.node.callee.property.name === "call" &&
      this.node.arguments.length === 1 &&
      j.Identifier.check(this.node.arguments[0]) &&
      this.node.arguments[0].name === "arguments"
    )
  }

  /**
   * Check if a pattern (identifier, destructuring, etc.) contains a specific variable name.
   *
   * @param {string} varName - Variable name to search for
   * @returns {boolean} True if the pattern contains the identifier
   */
  patternContainsIdentifier(varName) {
    if (j.Identifier.check(this.node)) {
      return this.node.name === varName
    }
    if (j.ObjectPattern.check(this.node)) {
      return this.node.properties.some((prop) => {
        if (j.Property.check(prop) || j.ObjectProperty.check(prop)) {
          return new NodeTest(prop.value).patternContainsIdentifier(varName)
        }
        if (j.RestElement.check(prop)) {
          return new NodeTest(prop.argument).patternContainsIdentifier(varName)
        }
      })
    }
    if (j.ArrayPattern.check(this.node)) {
      return this.node.elements.some((element) =>
        new NodeTest(element).patternContainsIdentifier(varName),
      )
    }
    if (j.AssignmentPattern.check(this.node)) {
      return new NodeTest(this.node.left).patternContainsIdentifier(varName)
    }
    if (j.RestElement.check(this.node)) {
      return new NodeTest(this.node.argument).patternContainsIdentifier(varName)
    }
    return false
  }

  /**
   * Extract all identifier names from a pattern (handles destructuring).
   *
   * @yields {string} Identifier names found in the pattern
   * @returns {Generator<string, void, unknown>}
   */
  *extractIdentifiersFromPattern() {
    if (j.Identifier.check(this.node)) {
      yield this.node.name
    } else if (j.ObjectPattern.check(this.node)) {
      for (const prop of this.node.properties) {
        if (j.Property.check(prop) || j.ObjectProperty.check(prop)) {
          yield* new NodeTest(prop.value).extractIdentifiersFromPattern()
        } else if (j.RestElement.check(prop)) {
          yield* new NodeTest(prop.argument).extractIdentifiersFromPattern()
        }
      }
    } else if (j.ArrayPattern.check(this.node)) {
      for (const element of this.node.elements) {
        yield* new NodeTest(element).extractIdentifiersFromPattern()
      }
    } else if (j.AssignmentPattern.check(this.node)) {
      yield* new NodeTest(this.node.left).extractIdentifiersFromPattern()
    } else if (j.RestElement.check(this.node)) {
      yield* new NodeTest(this.node.argument).extractIdentifiersFromPattern()
    }
  }

  /**
   * Get numeric value from a node (handles -1 as UnaryExpression).
   *
   * @returns {number | null} Numeric value, or null if not a number
   */
  getNumericValue() {
    // Handle direct literals (e.g., 0)
    if (j.Literal.check(this.node) && typeof this.node.value === "number") {
      return this.node.value
    }
    // Handle UnaryExpression with minus operator (e.g., -1)
    if (
      j.UnaryExpression.check(this.node) &&
      this.node.operator === "-" &&
      j.Literal.check(this.node.argument) &&
      typeof this.node.argument.value === "number"
    ) {
      return -this.node.argument.value
    }
    return null
  }

  /**
   * Determine which side of the binary expression has the indexOf call.
   *
   * @returns {{
   *   indexOfCall: import("ast-types").namedTypes.CallExpression;
   *   comparisonValue: import("ast-types").namedTypes.Node;
   *   isLeftIndexOf: boolean;
   * } | null} Object with indexOf call info, or null if not found
   */
  getIndexOfInfo() {
    if (!j.BinaryExpression.check(this.node)) {
      return null
    }

    // Check left side
    if (
      j.CallExpression.check(this.node.left) &&
      j.MemberExpression.check(this.node.left.callee) &&
      j.Identifier.check(this.node.left.callee.property) &&
      this.node.left.callee.property.name === "indexOf"
    ) {
      return {
        indexOfCall: this.node.left,
        comparisonValue: this.node.right,
        isLeftIndexOf: true,
      }
    }
    // Check right side
    else if (
      j.CallExpression.check(this.node.right) &&
      j.MemberExpression.check(this.node.right.callee) &&
      j.Identifier.check(this.node.right.callee.property) &&
      this.node.right.callee.property.name === "indexOf"
    ) {
      return {
        indexOfCall: this.node.right,
        comparisonValue: this.node.left,
        isLeftIndexOf: false,
      }
    }
    return null
  }

  /**
   * Determine if a binary expression is a null check.
   *
   * @returns {{ value: import("ast-types").Node; isNegated: boolean } | null} Null check result or null
   */
  getNullCheck() {
    if (
      j.BinaryExpression.check(this.node) &&
      (this.node.operator === "!==" || this.node.operator === "===")
    ) {
      const isNegated = this.node.operator === "!=="
      if (
        j.NullLiteral.check(this.node.right) ||
        (j.Literal.check(this.node.right) && this.node.right.value === null)
      ) {
        return { value: this.node.left, isNegated }
      }
      if (
        j.NullLiteral.check(this.node.left) ||
        (j.Literal.check(this.node.left) && this.node.left.value === null)
      ) {
        return { value: this.node.right, isNegated }
      }
    }
    return null
  }

  /**
   * Determine if a binary expression is an undefined check.
   *
   * @returns {{ value: import("ast-types").Node; isNegated: boolean } | null} Undefined check result or null
   */
  getUndefinedCheck() {
    if (
      j.BinaryExpression.check(this.node) &&
      (this.node.operator === "!==" || this.node.operator === "===")
    ) {
      const isNegated = this.node.operator === "!=="
      if (j.Identifier.check(this.node.right) && this.node.right.name === "undefined") {
        return { value: this.node.left, isNegated }
      }
      if (j.Identifier.check(this.node.left) && this.node.left.name === "undefined") {
        return { value: this.node.right, isNegated }
      }
    }
    return null
  }

  /**
   * Check if a function body has a local declaration shadowing the variable.
   *
   * @param {import("ast-types").NodePath} declarationPath - Path to the original
   *   declaration
   * @param {string} varName - Variable name to check
   * @returns {{ hasShadowing: boolean; foundOurDeclaration: boolean }}
   */
  checkFunctionBodyForShadowing(declarationPath, varName) {
    let foundOurDeclaration = false
    const hasShadowing = j(this.node)
      .find(j.VariableDeclarator)
      .some((declPath) => {
        if (declPath.parent.node === declarationPath.node) {
          foundOurDeclaration = true
          return false
        }
        return new NodeTest(declPath.node.id).patternContainsIdentifier(varName)
      })

    return { hasShadowing, foundOurDeclaration }
  }

  /**
   * Check if node is a known promise-returning expression.
   *
   * @returns {boolean} True if the node is a known promise
   */
  isKnownPromise() {
    if (j.NewExpression.check(this.node) && j.Identifier.check(this.node.callee)) {
      return this.node.callee.name === "Promise"
    }

    if (j.CallExpression.check(this.node)) {
      if (j.Identifier.check(this.node.callee)) {
        const knownPromiseFunctions = ["fetch"]
        return knownPromiseFunctions.includes(this.node.callee.name)
      }

      if (j.MemberExpression.check(this.node.callee)) {
        const callee = this.node.callee
        if (
          j.Identifier.check(callee.object) &&
          callee.object.name === "Promise" &&
          j.Identifier.check(callee.property)
        ) {
          const promiseStaticMethods = ["all", "race", "resolve", "reject", "allSettled", "any"]
          return promiseStaticMethods.includes(callee.property.name)
        }

        if (j.Identifier.check(callee.property)) {
          const promiseMethods = ["then", "catch", "finally"]
          return promiseMethods.includes(callee.property.name)
        }
      }
    }

    return false
  }
}

/**
 * Check if function parameters contain a specific variable name.
 *
 * @param {import("ast-types").ASTNode[]} params - Function parameters
 * @param {string} varName - Variable name to search for
 * @returns {boolean} True if any parameter contains the variable name
 */
function paramsContainIdentifier(params, varName) {
  return params.some((param) => new NodeTest(param).patternContainsIdentifier(varName))
}

/**
 * Check if an assignment/update expression is shadowed by a closer variable declaration
 *
 * @param {string} varName - The variable name to check
 * @param {import("ast-types").NodePath} declarationPath - The path to the original
 *   declaration
 * @param {import("ast-types").NodePath} currentPath - The current path being checked
 * @returns {boolean} True if the assignment is shadowed by a closer declaration
 */
function isAssignmentShadowed(varName, declarationPath, currentPath) {
  if (!currentPath.parent) {
    return false
  }

  const node = currentPath.parent.node

  if (
    j.FunctionDeclaration.check(node) ||
    j.FunctionExpression.check(node) ||
    j.ArrowFunctionExpression.check(node)
  ) {
    if (node.params && paramsContainIdentifier(node.params, varName)) {
      return true
    }

    if (node.body) {
      const { hasShadowing, foundOurDeclaration } = new NodeTest(
        node.body,
      ).checkFunctionBodyForShadowing(declarationPath, varName)

      if (hasShadowing) {
        return true
      }

      if (foundOurDeclaration) {
        return false
      }
    }
  }

  return isAssignmentShadowed(varName, declarationPath, currentPath.parent)
}

/**
 * Check if a variable is reassigned after its declaration
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @param {string} varName - The variable name to check
 * @param {import("ast-types").NodePath} declarationPath - The path to the variable
 *   declaration
 * @returns {boolean} True if the variable is reassigned
 */
function isVariableReassigned(root, varName, declarationPath) {
  let isReassigned = false

  // Check for AssignmentExpression where left side targets the variable
  root.find(j.AssignmentExpression).forEach((assignPath) => {
    if (!new NodeTest(assignPath.node.left).patternContainsIdentifier(varName)) {
      return
    }

    if (isAssignmentShadowed(varName, declarationPath, assignPath)) {
      return
    }

    isReassigned = true
  })

  if (isReassigned) return true

  // Check for UpdateExpression (++, --)
  root.find(j.UpdateExpression).forEach((updatePath) => {
    if (
      !j.Identifier.check(updatePath.node.argument) ||
      updatePath.node.argument.name !== varName
    ) {
      return
    }

    if (isAssignmentShadowed(varName, declarationPath, updatePath)) {
      return
    }

    isReassigned = true
  })

  return isReassigned
}

/**
 * Determine the appropriate kind (const or let) for a declarator
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @param {import("jscodeshift").VariableDeclarator} declarator - The variable
 *   declarator
 * @param {import("ast-types").NodePath} declarationPath - The path to the variable
 *   declaration
 * @returns {"const" | "let"} The appropriate variable kind
 */
export function determineDeclaratorKind(root, declarator, declarationPath) {
  // Check if this is a for-of or for-in loop variable declaration
  const isLoopVariable =
    declarationPath.parent &&
    declarationPath.parent.node &&
    (j.ForOfStatement.check(declarationPath.parent.node) ||
      j.ForInStatement.check(declarationPath.parent.node)) &&
    declarationPath.parent.node.left === declarationPath.node

  // Variables without initialization must use let (const requires initialization)
  // Exception: for-of and for-in loop variables don't need initialization
  if (!declarator.init && !isLoopVariable) {
    return "let"
  }

  if (j.Identifier.check(declarator.id)) {
    return isVariableReassigned(root, declarator.id.name, declarationPath)
      ? "let"
      : "const"
  }

  // Destructuring pattern - check if any identifier is reassigned
  for (const varName of new NodeTest(declarator.id).extractIdentifiersFromPattern()) {
    if (isVariableReassigned(root, varName, declarationPath)) {
      return "let"
    }
  }

  return "const"
}

/**
 * Process a single declarator variable declaration
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {{ modified: boolean; change: { type: string; line: number } | null }}
 */
export function processSingleDeclarator(root, path) {
  const declarator = path.node.declarations[0]
  path.node.kind = determineDeclaratorKind(root, declarator, path)

  const change = path.node.loc
    ? { type: "varToLetOrConst", line: path.node.loc.start.line }
    : null

  return { modified: true, change }
}

/**
 * Process a multiple declarator variable declaration by splitting into separate
 * declarations
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {{ modified: boolean; change: { type: string; line: number } | null }}
 */
export function processMultipleDeclarators(root, path) {
  const declarations = path.node.declarations.map((declarator) => {
    return j.variableDeclaration(determineDeclaratorKind(root, declarator, path), [
      declarator,
    ])
  })

  j(path).replaceWith(declarations)

  const change = path.node.loc
    ? { type: "varToLetOrConst", line: path.node.loc.start.line }
    : null

  return { modified: true, change }
}

/**
 * Check if an identifier is shadowed by a local declaration or parameter.
 *
 * @param {import("ast-types").NodePath} path - Path to the identifier
 * @param {string} name - Name to check for shadowing
 * @returns {boolean} True if the identifier is shadowed
 */
export function isShadowed(path, name) {
  let scope = path.scope
  while (scope) {
    if (scope.getBindings()[name]) {
      return true
    }
    scope = scope.parent
  }
  return false
}

/**
 * Validate that both checks are negated, operate on the same value, and match the consequent.
 *
 * @param {object} nullCheck - The null check result
 * @param {object} undefinedCheck - The undefined check result
 * @param {import("ast-types").ASTNode} consequent - The consequent node
 * @returns {boolean} True if validation passes
 */
export function validateChecks(nullCheck, undefinedCheck, consequent) {
  return (
    nullCheck.isNegated &&
    undefinedCheck.isNegated &&
    new NodeTest(nullCheck.value).isEqual(undefinedCheck.value) &&
    new NodeTest(nullCheck.value).isEqual(consequent)
  )
}

/**
 * Find the enclosing function for a given path.
 *
 * @param {import("ast-types").NodePath} path - The path to start from
 * @returns {import("ast-types").NodePath | null} The enclosing function path or null
 */
export function findEnclosingFunction(path) {
  if (!path?.parent) {
    return null
  }

  const node = path.parent.node
  if (
    j.FunctionDeclaration.check(node) ||
    j.FunctionExpression.check(node) ||
    j.ArrowFunctionExpression.check(node)
  ) {
    return path.parent
  }

  return findEnclosingFunction(path.parent)
}
