import { default as j } from "jscodeshift"

const SKIP_KEYS = new Set(["loc", "start", "end", "tokens", "comments", "type"])
const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
])
const VAR_LET_OR_CONST_KINDS = new Set(["var", "let", "const"])
const BLOCK_SCOPED_KINDS = new Set(["let", "const"])
const BINDING_SCOPE_TYPES = new Set([
  "Program",
  "BlockStatement",
  "StaticBlock",
  "SwitchStatement",
])
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
// A string is iterable, so these string-returning methods verify an iterable too.
const ITERABLE_STRING_METHODS = [
  "slice",
  "substr",
  "substring",
  "toLowerCase",
  "toUpperCase",
  "trim",
  "trimStart",
  "trimEnd",
]
const STRING_METHODS_RETURNING_STRING = [
  ...ITERABLE_STRING_METHODS,
  "trimLeft",
  "trimRight",
  "repeat",
  "padStart",
  "padEnd",
  "concat",
  "replace",
  "replaceAll",
]
const STRING_METHODS_RETURNING_ITERABLE = [
  "matchAll",
  "split",
  ...ITERABLE_STRING_METHODS,
]

/**
 * Statements that declare a binding which ast-types scope analysis does not
 * track. TypeScript binds a value in the enclosing scope through enums,
 * namespaces, and `import name = require(...)` statements.
 */
const TYPESCRIPT_BINDING_TYPES = new Set([
  "TSEnumDeclaration",
  "TSImportEqualsDeclaration",
  "TSModuleDeclaration",
])

/**
 * Check whether a statement declares a name through a TypeScript statement.
 *
 * @param {import("ast-types").ASTNode} statement - Statement to check
 * @param {string} name - Identifier name to look for
 * @returns {boolean} True if the statement declares the name
 */
function declaresTypeScriptBinding(statement, name) {
  return (
    TYPESCRIPT_BINDING_TYPES.has(statement.type) &&
    j.Identifier.check(statement.id) &&
    statement.id.name === name
  )
}

/**
 * Wrapper class for AST nodes providing utility methods.
 *
 * @property {import("ast-types").ASTNode} node - The underlying AST node
 * @property {import("ast-types").NodePath | null} path - Path that locates the
 *   node, or a node inside the same scope, in the syntax tree
 */
export class NodeTest {
  /**
   * @param {import("ast-types").ASTNode} node - The underlying AST node
   * @param {import("ast-types").NodePath} [path] - Path that locates the node,
   *   or a node inside the same scope. Names of globals are only trusted when
   *   their binding can be resolved through a path.
   */
  constructor(node, path = null) {
    this.node = node
    this.path = path
  }

  /**
   * Check whether a name refers to the binding in the global scope. A name is
   * trusted only when the enclosing scopes resolve it to the global binding.
   *
   * @param {string} name - Identifier name to resolve
   * @returns {boolean} True if no enclosing scope declares the name
   */
  #isGlobalReference(name) {
    return (
      this.path !== null &&
      this.path.scope.lookup(name) === null &&
      !this.#hasTypeScriptBinding(this.path, name)
    )
  }

  /**
   * Check whether an enclosing statement list declares a name through a
   * TypeScript statement, which ast-types scope analysis does not track.
   *
   * @param {import("ast-types").NodePath | null} path - Path to inspect
   * @param {string} name - Identifier name to look for
   * @returns {boolean} True if an enclosing statement list declares the name
   */
  #hasTypeScriptBinding(path, name) {
    if (path === null) {
      return false
    }

    const body = path.node.body
    return (
      (Array.isArray(body) &&
        body.some((statement) => declaresTypeScriptBinding(statement, name))) ||
      this.#hasTypeScriptBinding(path.parent, name)
    )
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
      this.node.callee.name === "Array" &&
      this.#isGlobalReference("Array")
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
      !this.node.callee.computed &&
      j.Identifier.check(this.node.callee.object) &&
      this.node.callee.object.name === "Array" &&
      this.#isGlobalReference("Array")
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
   * Check if node is a call to one of the given methods.
   *
   * @param {string[]} methodNames - Method names to check for
   * @returns {boolean} True if node calls one of the methods
   */
  isMethodCall(methodNames) {
    return (
      j.CallExpression.check(this.node) &&
      j.MemberExpression.check(this.node.callee) &&
      !this.node.callee.computed &&
      j.Identifier.check(this.node.callee.property) &&
      methodNames.includes(this.node.callee.property.name)
    )
  }

  /**
   * Check if node is a method call on a verified string receiver.
   *
   * @param {string[]} methodNames - Method names to check for
   * @returns {boolean} True if node matches the pattern
   */
  isStringMethodCall(methodNames) {
    return (
      this.isMethodCall(methodNames) &&
      new NodeTest(this.node.callee.object, this.path).isString()
    )
  }

  /**
   * Check if node is statically verifiable as a string. Resolves string-returning
   * method calls recursively, so a receiver rooted in a string literal or template
   * literal stays verifiable through any depth of string method calls.
   *
   * @returns {boolean} True if the node evaluates to a string
   */
  isString() {
    if (this.isStringLiteral()) {
      return true
    }

    if (j.TemplateLiteral.check(this.node)) {
      return true
    }

    return this.isStringMethodCall(STRING_METHODS_RETURNING_STRING)
  }

  /**
   * Check if node is a method call on a receiver that passes a check.
   *
   * @param {string[]} methodNames - Method names to check for
   * @param {(receiver: NodeTest) => boolean} isReceiverVerified - Check for the
   *   receiver of the call
   * @returns {boolean} True if node is a method call on a verified receiver
   */
  isArrayMethodChain(methodNames, isReceiverVerified) {
    return (
      this.isMethodCall(methodNames) &&
      isReceiverVerified(new NodeTest(this.node.callee.object, this.path))
    )
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

    return this.isStringMethodCall(STRING_METHODS_RETURNING_ITERABLE)
  }

  /**
   * Check if an expression is statically verifiable as an array. Unlike isIterable(),
   * strings and other iterables are rejected. Used by transformers relying on Array
   * methods that no other iterable provides.
   *
   * @returns {boolean} True if the node can be verified as an array
   */
  isArray() {
    return (
      this.isArrayLiteral() ||
      this.isNewArray() ||
      this.isArrayStaticCall("from") ||
      this.isArrayStaticCall("of") ||
      this.isArrayMethodChain(ARRAY_METHODS_RETURNING_ARRAY, (receiver) =>
        receiver.isArray(),
      )
    )
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

    if (this.isString()) {
      return true
    }

    return this.isArrayMethodChain(ARRAY_METHODS_RETURNING_ARRAY, (receiver) =>
      receiver.hasIndexOfAndIncludes(),
    )
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
   *
   * @param {import("ast-types").ASTNode} astNode - The node to traverse
   * @param {function(import("ast-types").ASTNode): boolean} predicate - Return true if found
   * @param {boolean} [crossFunctions] - Traverse nested functions
   * @returns {boolean} True if predicate returned true for any node
   */
  #traverseForPredicate(astNode, predicate, crossFunctions = false) {
    if (!astNode) {
      return false
    }

    if (predicate(astNode)) {
      return true
    }

    if (!crossFunctions && FUNCTION_TYPES.has(astNode.type)) {
      return false
    }

    for (const key in astNode) {
      if (SKIP_KEYS.has(key)) {
        continue
      }
      const value = astNode[key]
      if (Array.isArray(value)) {
        for (const item of value) {
          if (this.#traverseForPredicate(item, predicate, crossFunctions)) {
            return true
          }
        }
      } else if (value && typeof value === "object") {
        if (this.#traverseForPredicate(value, predicate, crossFunctions)) {
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
    return this.#traverseForPredicate(
      this.node,
      (node) => node.type === "Identifier" && node.name === "arguments",
    )
  }

  /**
   * Check if node is a function expression or an arrow function.
   *
   * @returns {boolean} True if node is a function expression or an arrow function
   */
  isFunctionExpression() {
    return (
      j.FunctionExpression.check(this.node) ||
      j.ArrowFunctionExpression.check(this.node)
    )
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
   * Check if node is a `var`, `let`, or `const` declaration.
   *
   * `using` and `await using` declarations dispose their resource when the scope exits.
   * Rewriting them into another declaration kind drops that cleanup, so they are excluded.
   *
   * @returns {boolean} True if node is a var, let, or const declaration
   */
  isVarLetOrConstDeclaration() {
    return (
      j.VariableDeclaration.check(this.node) &&
      VAR_LET_OR_CONST_KINDS.has(this.node.kind)
    )
  }

  /**
   * Check if identifier is used in the node, ignoring nested functions by default.
   *
   * @param {string} name - Identifier name to search for
   * @param {object} [options] - Traversal options
   * @param {boolean} [options.crossFunctions] - Traverse nested functions, which
   *   have their own scope
   * @returns {boolean} True if identifier name is found
   */
  containsIdentifier(name, { crossFunctions = false } = {}) {
    return this.#traverseForPredicate(
      this.node,
      (node) => node.type === "Identifier" && node.name === name,
      crossFunctions,
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
   * Determine whether an inline function has side effects.
   * Extracts parameter names from the function node and checks the body against a
   * strict whitelist: only literals, parameter identifiers, binary expressions, and
   * non-computed member access on parameters are side-effect free.
   *
   * @returns {boolean} True if the function has side effects
   */
  hasSideEffects() {
    const paramNames = new Set(
      this.node.params.flatMap((param) => [
        ...new NodeTest(param).extractIdentifiersFromPattern(),
      ]),
    )
    return this.#hasNodeSideEffects(this.node.body, paramNames)
  }

  /**
   * Recursively determine if an AST node has side effects given a set of allowed
   * identifiers. Returns false only for literals, known-parameter identifiers, binary
   * expressions, non-computed property access on side-effect-free sub-expressions, and
   * single-return-statement block bodies. Returns true for all other node types.
   *
   * @param {import("ast-types").ASTNode} node - The node to inspect
   * @param {Set<string>} paramNames - Set of allowed identifier names
   * @returns {boolean} True if the node has side effects
   */
  #hasNodeSideEffects(node, paramNames) {
    if (j.Literal.check(node)) return false
    if (j.Identifier.check(node)) return !paramNames.has(node.name)
    if (j.BinaryExpression.check(node)) {
      return (
        this.#hasNodeSideEffects(node.left, paramNames) ||
        this.#hasNodeSideEffects(node.right, paramNames)
      )
    }
    if (j.MemberExpression.check(node)) {
      if (node.computed) return true
      return this.#hasNodeSideEffects(node.object, paramNames)
    }
    if (j.BlockStatement.check(node)) {
      if (node.body.length !== 1) return true
      const [stmt] = node.body
      return (
        !j.ReturnStatement.check(stmt) ||
        this.#hasNodeSideEffects(stmt.argument, paramNames)
      )
    }
    return true
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
      !this.node.callee.computed &&
      j.MemberExpression.check(this.node.callee.object) &&
      !this.node.callee.object.computed &&
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
   * Extract all identifiers a pattern binds (handles destructuring).
   *
   * @yields {import("ast-types").namedTypes.Identifier} Binding identifiers
   * @returns {Generator<import("ast-types").namedTypes.Identifier, void, unknown>}
   */
  *extractBindingIdentifiers() {
    if (
      j.TSNonNullExpression.check(this.node) ||
      j.TSAsExpression.check(this.node) ||
      j.TSSatisfiesExpression.check(this.node)
    ) {
      yield* new NodeTest(this.node.expression).extractBindingIdentifiers()
    } else if (j.Identifier.check(this.node)) {
      yield this.node
    } else if (j.ObjectPattern.check(this.node)) {
      for (const prop of this.node.properties) {
        if (j.Property.check(prop) || j.ObjectProperty.check(prop)) {
          yield* new NodeTest(prop.value).extractBindingIdentifiers()
        } else if (j.RestElement.check(prop)) {
          yield* new NodeTest(prop.argument).extractBindingIdentifiers()
        }
      }
    } else if (j.ArrayPattern.check(this.node)) {
      for (const element of this.node.elements) {
        yield* new NodeTest(element).extractBindingIdentifiers()
      }
    } else if (j.AssignmentPattern.check(this.node)) {
      yield* new NodeTest(this.node.left).extractBindingIdentifiers()
    } else if (j.RestElement.check(this.node)) {
      yield* new NodeTest(this.node.argument).extractBindingIdentifiers()
    }
  }

  /**
   * Extract all identifier names from a pattern (handles destructuring).
   *
   * @yields {string} Identifier names found in the pattern
   * @returns {Generator<string, void, unknown>}
   */
  *extractIdentifiersFromPattern() {
    for (const identifier of this.extractBindingIdentifiers()) {
      yield identifier.name
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
   * Determine which side of a binary expression calls one of the given methods.
   *
   * @param {string[]} methodNames - Method names to check for
   * @returns {{
   *   call: import("ast-types").namedTypes.CallExpression;
   *   comparisonValue: import("ast-types").namedTypes.Node;
   *   isLeftCall: boolean;
   * } | null} Object with call info, or null if not found
   */
  getComparisonCall(methodNames) {
    if (!j.BinaryExpression.check(this.node)) {
      return null
    }

    for (const [call, comparisonValue, isLeftCall] of [
      [this.node.left, this.node.right, true],
      [this.node.right, this.node.left, false],
    ]) {
      if (new NodeTest(call).isMethodCall(methodNames)) {
        return { call, comparisonValue, isLeftCall }
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
      if (j.Literal.check(this.node.right) && this.node.right.value === null) {
        return { value: this.node.left, isNegated }
      }
      if (j.Literal.check(this.node.left) && this.node.left.value === null) {
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
   * Check if node is a known promise-returning expression.
   * This includes new Promise(), fetch(), Promise static methods,
   * and any method called on a promise.
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
          const promiseStaticMethods = [
            "all",
            "race",
            "resolve",
            "reject",
            "allSettled",
            "any",
          ]
          return promiseStaticMethods.includes(callee.property.name)
        }

        return new NodeTest(callee.object).isKnownPromise()
      }
    }

    return false
  }

  /**
   * Unwrap a Promise.resolve() or Promise.reject() call.
   *
   * @returns {{
   *   kind: "resolve" | "reject";
   *   argument: import("ast-types").Node;
   * } | null} The unwrapped call, or null when the node is no such call
   */
  unwrapPromiseResolveReject() {
    if (
      !this.isMethodCall(["resolve", "reject"]) ||
      !j.Identifier.check(this.node.callee.object) ||
      this.node.callee.object.name !== "Promise"
    ) {
      return null
    }

    return {
      kind: this.node.callee.property.name,
      argument:
        this.node.arguments.length === 1
          ? this.node.arguments[0]
          : j.identifier("undefined"),
    }
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
 * Check whether a node establishes a function scope.
 *
 * A function scope holds the parameters, the `var` declarations, and the
 * function declarations of a function, of the program, of a class static block,
 * and of a TypeScript module block.
 *
 * @param {import("ast-types").ASTNode} node - Node to check
 * @returns {boolean} True if the node establishes a function scope
 */
function isFunctionScopeNode(node) {
  return (
    j.Function.check(node) ||
    j.Program.check(node) ||
    j.StaticBlock.check(node) ||
    j.TSModuleBlock.check(node)
  )
}

/**
 * List the statements of a scope body.
 *
 * @param {import("ast-types").ASTNode} node - Function, program, or block node
 * @returns {import("ast-types").ASTNode[]} Statements of the body
 */
function listBodyStatements(node) {
  if (Array.isArray(node.body)) {
    return node.body
  }

  return Array.isArray(node.body?.body) ? node.body.body : []
}

/**
 * Check whether a variable declaration binds a name.
 *
 * @param {import("ast-types").namedTypes.VariableDeclaration} declaration - Declaration to check
 * @param {string} name - Identifier name to look for
 * @returns {boolean} True if a declarator of the declaration binds the name
 */
function declarationBindsName(declaration, name) {
  return declaration.declarations.some((declarator) =>
    new NodeTest(declarator.id).patternContainsIdentifier(name),
  )
}

/**
 * Check whether a statement binds a name in the block scope of its statement
 * list.
 *
 * `let`, `const`, `using`, `class`, and function declarations bind in the block
 * that holds them.
 *
 * @param {import("ast-types").ASTNode} statement - Statement to check
 * @param {string} name - Identifier name to look for
 * @returns {boolean} True if the statement binds the name in a block scope
 */
function statementBindsBlockScope(statement, name) {
  if (j.VariableDeclaration.check(statement)) {
    return statement.kind !== "var" && declarationBindsName(statement, name)
  }

  if (j.ClassDeclaration.check(statement) || j.FunctionDeclaration.check(statement)) {
    return j.Identifier.check(statement.id) && statement.id.name === name
  }

  return false
}

/**
 * Check whether a statement list binds a name in its block scope.
 *
 * @param {import("ast-types").ASTNode[]} statements - Statements of the list
 * @param {string} name - Identifier name to look for
 * @returns {boolean} True if the list binds the name in a block scope
 */
function statementsBindBlockScope(statements, name) {
  return statements.some((statement) => statementBindsBlockScope(statement, name))
}

/**
 * Check whether a node holds a `var` declaration of a name.
 *
 * A `var` declaration binds in the nearest enclosing function scope, so the
 * search descends into blocks and statements but stops at nested functions,
 * static blocks, and module blocks, which establish their own scope.
 *
 * @param {import("ast-types").ASTNode} node - Node to search
 * @param {string} name - Identifier name to look for
 * @returns {boolean} True if a `var` declaration binds the name
 */
function declaresVarBinding(node, name) {
  if (!node || typeof node !== "object") {
    return false
  }

  if (Array.isArray(node)) {
    return node.some((item) => declaresVarBinding(item, name))
  }

  if (isFunctionScopeNode(node)) {
    return false
  }

  if (j.VariableDeclaration.check(node)) {
    return node.kind === "var" && declarationBindsName(node, name)
  }

  return Object.entries(node).some(
    ([key, value]) => !SKIP_KEYS.has(key) && declaresVarBinding(value, name),
  )
}

/**
 * Check whether a function scope binds a name.
 *
 * The scope holds its parameters, the `var` declarations of its body, and the
 * declarations that sit directly in its body. A function body block shares the
 * scope of its function, so the declarations of the body count as well.
 *
 * @param {import("ast-types").ASTNode} node - Function, program, or block node
 * @param {string} name - Identifier name to look for
 * @returns {boolean} True if the scope binds the name
 */
function functionScopeBinds(node, name) {
  if (Array.isArray(node.params) && paramsContainIdentifier(node.params, name)) {
    return true
  }

  return listBodyStatements(node).some(
    (statement) =>
      statementBindsBlockScope(statement, name) || declaresVarBinding(statement, name),
  )
}

/**
 * Check whether a block is the body of a function.
 *
 * A function body block binds the same names as the function scope it belongs
 * to, so that scope covers the body.
 *
 * @param {import("ast-types").NodePath} path - Path of the block
 * @returns {boolean} True if the block is a function body
 */
function isFunctionBody(path) {
  const parent = path.parent.node

  return j.Function.check(parent) && parent.body === path.node
}

/**
 * Check whether a loop binds a name in its own scope.
 *
 * A `let` or `const` declaration in the initializer of a `for` loop, or in the
 * head of a `for-in` or `for-of` loop, binds in the scope of the loop.
 *
 * @param {import("ast-types").ASTNode} node - Loop node
 * @param {string} name - Identifier name to look for
 * @returns {boolean} True if the loop binds the name in its own scope
 */
function loopBindsName(node, name) {
  const declaration = node.init ?? node.left

  return (
    j.VariableDeclaration.check(declaration) &&
    declaration.kind !== "var" &&
    declarationBindsName(declaration, name)
  )
}

/**
 * Check whether a switch statement binds a name in its own scope.
 *
 * @param {import("ast-types").ASTNode} node - Switch statement
 * @param {string} name - Identifier name to look for
 * @returns {boolean} True if a case of the switch binds the name
 */
function switchBindsName(node, name) {
  return node.cases.some((switchCase) =>
    statementsBindBlockScope(switchCase.consequent, name),
  )
}

/**
 * Find the scope that the node of a path establishes for a name.
 *
 * @param {import("ast-types").NodePath} path - Path of the node to inspect
 * @param {string} name - Identifier name to resolve
 * @returns {import("ast-types").ASTNode | null} The scope node, or null
 */
function bindingScopeOf(path, name) {
  const { node } = path

  if (isFunctionScopeNode(node)) {
    return functionScopeBinds(node, name) ? node : null
  }

  if (j.BlockStatement.check(node)) {
    const bindsName = !isFunctionBody(path) && statementsBindBlockScope(node.body, name)

    return bindsName ? node : null
  }

  if (
    j.ForStatement.check(node) ||
    j.ForInStatement.check(node) ||
    j.ForOfStatement.check(node)
  ) {
    return loopBindsName(node, name) ? node : null
  }

  if (j.SwitchStatement.check(node)) {
    return switchBindsName(node, name) ? node : null
  }

  if (j.CatchClause.check(node)) {
    return new NodeTest(node.param).patternContainsIdentifier(name) ? node : null
  }

  return null
}

/**
 * Resolve the scope that binds a name at a path.
 *
 * Resolution walks the enclosing scopes from the innermost outwards and returns
 * the scope that binds the name, which is the binding a write of that name
 * targets. A name that no enclosing scope binds is a global and resolves to
 * null.
 *
 * @param {import("ast-types").NodePath} path - Path to resolve the name at
 * @param {string} name - Identifier name to resolve
 * @returns {import("ast-types").ASTNode | null} The scope that binds the name, or null
 */
function resolveBindingScope(path, name) {
  if (!path) {
    return null
  }

  return bindingScopeOf(path, name) ?? resolveBindingScope(path.parent, name)
}

/**
 * Assignment, update, and loop target expressions grouped by the identifier
 * they write and the binding the write targets.
 *
 * A single index per syntax tree replaces the full tree traversal that would
 * otherwise run for every variable declaration. Indexing uses the same pattern
 * rules as {@link NodeTest#extractIdentifiersFromPattern}, so the indexed
 * candidates are exactly the nodes that a traversal would match.
 *
 * Every write resolves its binding while the indexed tree still holds the
 * original declaration kinds. Rewriting a declaration changes the scope that
 * binds its name, so resolving a write later would make the analysis depend on
 * the order in which declarations are rewritten.
 */
export class ReassignmentIndex {
  #writes = new Map()

  /**
   * Index every write of the root collection.
   *
   * @param {import("jscodeshift").Collection} root - The root AST collection
   */
  constructor(root) {
    this.#indexWrites(root, j.AssignmentExpression, "left")
    this.#indexWrites(root, j.UpdateExpression, "argument")
    this.#indexWrites(root, j.ForOfStatement, "left")
    this.#indexWrites(root, j.ForInStatement, "left")
  }

  /**
   * List the paths of the writes that target a variable name.
   *
   * @param {string} varName - The variable name to look up
   * @returns {Array<import("ast-types").NodePath>} Writing paths
   */
  getPathsFor(varName) {
    return (this.#writes.get(varName) ?? []).map((write) => write.path)
  }

  /**
   * Check whether a write targets the binding of a scope.
   *
   * @param {string} varName - The variable name to look up
   * @param {import("ast-types").ASTNode | null} bindingScope - The scope that binds the name
   * @returns {boolean} True if an indexed write targets the binding
   */
  containsWriteToBinding(varName, bindingScope) {
    return (this.#writes.get(varName) ?? []).some(
      (write) => write.bindingScope === bindingScope,
    )
  }

  /**
   * Index the identifiers a node type writes through one of its fields.
   *
   * @param {import("jscodeshift").Collection} root - The root AST collection
   * @param {import("jscodeshift").ASTType} nodeType - The node type to index
   * @param {string} field - The field holding the written target
   */
  #indexWrites(root, nodeType, field) {
    root.find(nodeType).forEach((path) => {
      const target = path.node[field]

      for (const name of new NodeTest(target).extractIdentifiersFromPattern()) {
        this.#append(name, path)
      }
    })
  }

  /**
   * Store a path under the given identifier name with the binding it targets.
   *
   * @param {string} name - The identifier name
   * @param {import("ast-types").NodePath} path - The path to store
   */
  #append(name, path) {
    const writes = this.#writes.get(name)
    const write = { path, bindingScope: resolveBindingScope(path, name) }

    writes ? writes.push(write) : this.#writes.set(name, [write])
  }
}

/**
 * Check whether an identifier refers to a variable.
 *
 * Member and property names name a field instead of a variable, so they never
 * resolve to a declaration. Declared identifiers resolve to the binding they
 * create, which declarations of one name share.
 *
 * @param {import("ast-types").NodePath} path - The path of the identifier
 * @returns {boolean} True if the identifier refers to a variable
 */
function isReferenceIdentifier({ node, parentPath }) {
  const parent = parentPath?.node

  if (j.JSXMemberExpression.check(parent)) {
    return parent.object === node
  }
  if (j.JSXOpeningElement.check(parent) || j.JSXClosingElement.check(parent)) {
    return parent.name === node
  }
  if (j.JSXAttribute.check(parent) || j.JSXNamespacedName.check(parent)) {
    return false
  }
  if (j.MemberExpression.check(parent)) {
    return parent.computed || parent.property !== node
  }
  if (
    j.Property.check(parent) ||
    j.ObjectProperty.check(parent) ||
    j.ObjectMethod.check(parent) ||
    j.ClassMethod.check(parent) ||
    j.ClassPrivateMethod.check(parent) ||
    j.ClassProperty.check(parent) ||
    j.ClassPrivateProperty.check(parent)
  ) {
    return parent.computed || parent.key !== node
  }

  return true
}

/**
 * Identifiers grouped by the name they read or declare.
 *
 * A single index per syntax tree replaces the tree walk that would otherwise run
 * for every name of every declaration.
 */
export class ReferenceIndex {
  #paths = new Map()

  /**
   * Index every identifier that takes part in the binding of a name.
   *
   * @param {import("jscodeshift").Collection} root - The root AST collection
   */
  constructor(root) {
    root.find(j.Identifier).forEach((path) => this.#append(path))
    root.find(j.JSXIdentifier).forEach((path) => this.#append(path))
  }

  /**
   * List the identifiers that read or declare the given variable.
   *
   * @param {string} varName - The variable name to look up
   * @returns {Array<import("ast-types").NodePath>} Identifier paths
   */
  getPathsFor(varName) {
    return this.#paths.get(varName) ?? []
  }

  /**
   * Store an identifier under its name.
   *
   * @param {import("ast-types").NodePath} path - The path of the identifier
   */
  #append(path) {
    if (!isReferenceIdentifier(path)) return

    const paths = this.#paths.get(path.node.name)

    paths ? paths.push(path) : this.#paths.set(path.node.name, [path])
  }
}

/**
 * Find the function that a binding identifier declares.
 *
 * A function declaration binds through its own name. A function expression
 * binds through the `const` or `let` declarator that initializes it. A `var`
 * declarator stays out, because a call above its initializer runs before the
 * binding holds the function.
 *
 * @param {import("ast-types").NodePath} path - The path of a binding identifier
 * @returns {import("ast-types").ASTNode | null} The declared function, or null
 */
function findDeclaredFunction({ node, parentPath }) {
  const declaration = parentPath.node

  if (j.FunctionDeclaration.check(declaration) && declaration.id === node) {
    return declaration
  }

  if (
    j.VariableDeclarator.check(declaration) &&
    declaration.id === node &&
    BLOCK_SCOPED_KINDS.has(parentPath.parentPath.node.kind) &&
    j.Function.check(declaration.init)
  ) {
    return declaration.init
  }

  return null
}

/**
 * List the functions that a call expression invokes.
 *
 * Only an identifier names a function: a property call, an alias, and a
 * callback hold no name to follow. A name that no scope binds is a global.
 *
 * @param {import("ast-types").NodePath} path - The path of the call expression
 * @returns {Array<import("ast-types").ASTNode>} The invoked functions
 */
function listCalleeFunctions({ node, scope }) {
  if (!j.Identifier.check(node.callee)) {
    return []
  }

  const name = node.callee.name
  const declarationScope = scope.lookup(name)

  if (!declarationScope) {
    return []
  }

  return declarationScope.getBindings()[name].flatMap((identifierPath) => {
    const functionNode = findDeclaredFunction(identifierPath)

    return functionNode ? [functionNode] : []
  })
}

/**
 * Call expressions grouped by the function they invoke.
 *
 * Only a call that names a function resolves: a function declaration, or a
 * function expression that `const` or `let` binds. A property call, an alias,
 * and a callback hold no name to resolve, so they stay out of the index.
 */
export class CallIndex {
  #calls = new Map()

  /**
   * Index every resolvable call of the root collection.
   *
   * @param {import("jscodeshift").Collection} root - The root AST collection
   */
  constructor(root) {
    root.find(j.CallExpression).forEach((path) => this.#append(path))
  }

  /**
   * List the calls that invoke a function.
   *
   * @param {import("ast-types").ASTNode} functionNode - The invoked function
   * @returns {Array<import("ast-types").NodePath>} Call expression paths
   */
  getPathsFor(functionNode) {
    return this.#calls.get(functionNode) ?? []
  }

  /**
   * Store a call under every function its callee names.
   *
   * @param {import("ast-types").NodePath} path - The path of the call expression
   */
  #append(path) {
    for (const functionNode of listCalleeFunctions(path)) {
      const calls = this.#calls.get(functionNode)

      calls ? calls.push(path) : this.#calls.set(functionNode, [path])
    }
  }
}

/**
 * Direct `eval` calls of a syntax tree.
 *
 * A direct `eval` runs in the scope of the call site, so it reads, writes, and
 * declares bindings without leaving an identifier behind. Indexing the calls
 * once replaces a tree walk per declaration.
 */
export class DirectEvalIndex {
  #paths = []

  /**
   * Index every direct `eval` call of the root collection.
   *
   * A call is direct when its callee is the `eval` identifier of the global
   * scope. A local or block-scoped binding of the name resolves to a scope and
   * does not count.
   *
   * @param {import("jscodeshift").Collection} root - The root AST collection
   */
  constructor(root) {
    root.find(j.CallExpression).forEach((path) => this.#append(path))
  }

  /**
   * List the calls that run inside a scope.
   *
   * A call in a nested function counts, because the scope chain of the function
   * includes the scope it sits in.
   *
   * @param {import("ast-types").ASTNode} scopeNode - The scope to inspect
   * @returns {Array<import("ast-types").NodePath>} Paths of the calls
   */
  getPathsInScope(scopeNode) {
    return this.#paths.filter((path) => isInsideNode(scopeNode, path))
  }

  /**
   * Store a call when it targets the global `eval`.
   *
   * @param {import("ast-types").NodePath} path - The path of the call expression
   */
  #append(path) {
    if (!isDirectEvalCall(path)) return

    this.#paths.push(path)
  }
}

/**
 * Check whether a call expression calls the global `eval`.
 *
 * @param {import("ast-types").NodePath} path - The path of the call expression
 * @returns {boolean} True when the call is a direct eval call
 */
function isDirectEvalCall(path) {
  const { callee } = path.node

  return (
    j.Identifier.check(callee) &&
    callee.name === "eval" &&
    resolveBindingScope(path, "eval") === null
  )
}

/**
 * Check if a variable is reassigned after its declaration
 *
 * @param {ReassignmentIndex} reassignments - Indexed assignments and updates
 * @param {string} varName - The variable name to check
 * @param {import("ast-types").NodePath} declarationPath - The path to the variable
 *   declaration
 * @returns {boolean} True if the variable is reassigned
 */
function isVariableReassigned(reassignments, varName, declarationPath) {
  return reassignments.containsWriteToBinding(
    varName,
    resolveBindingScope(declarationPath, varName),
  )
}

/**
 * Check whether a declaration sits in the head of a loop.
 *
 * A loop head owns its declarations and scopes them to the whole loop.
 *
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {boolean} True when the loop head holds the declaration
 */
function isLoopHeadDeclaration({ node, parentPath }) {
  const parent = parentPath?.node

  if (j.ForStatement.check(parent)) {
    return parent.init === node
  }

  return (
    (j.ForOfStatement.check(parent) || j.ForInStatement.check(parent)) &&
    parent.left === node
  )
}

/**
 * Check whether a node owns a `let` or `const` binding.
 *
 * @param {import("ast-types").ASTNode} node - The node to check
 * @returns {boolean} True when the node owns `let` or `const` bindings
 */
function isBindingScopeNode({ type }) {
  return BINDING_SCOPE_TYPES.has(type)
}

/**
 * Find the closest ancestor that matches a predicate.
 *
 * The program encloses every node, so an ancestor always matches.
 *
 * @param {(node: import("ast-types").ASTNode) => boolean} isMatch - Predicate for
 *   a candidate node
 * @param {import("ast-types").NodePath} path - The path whose ancestors to search
 * @returns {import("ast-types").NodePath} The closest matching ancestor path
 */
function findAncestorPath(isMatch, { parentPath: currentPath }) {
  return isMatch(currentPath.node)
    ? currentPath
    : findAncestorPath(isMatch, currentPath)
}

/**
 * Check whether a node encloses a path.
 *
 * @param {import("ast-types").ASTNode} node - The enclosing node
 * @param {import("ast-types").NodePath} path - The path to inspect
 * @returns {boolean} True when the node encloses the path
 */
function isInsideNode(node, { parentPath: currentPath }) {
  if (!currentPath) return false

  return currentPath.node === node || isInsideNode(node, currentPath)
}

/**
 * Find the scope that would own the binding of a narrowed declaration.
 *
 * A loop head owns its declarations and scopes them to the whole loop.
 *
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {import("ast-types").NodePath} The owning scope path
 */
function findBindingScope(path) {
  return isLoopHeadDeclaration(path)
    ? path.parentPath
    : findAncestorPath(isBindingScopeNode, path)
}

/**
 * Find the declarator that binds an identifier.
 *
 * @param {import("ast-types").NodePath} path - The path of the identifier
 * @returns {import("ast-types").NodePath | null} The declarator path that binds the
 *   identifier, or null when the identifier is read instead of bound
 */
function findBindingDeclarator(path) {
  const { parentPath } = path

  if (!parentPath) {
    return null
  }

  if (j.VariableDeclarator.check(parentPath.node)) {
    return parentPath.node.id === path.node ? parentPath : null
  }

  return findBindingDeclarator(parentPath)
}

/**
 * Find the scope that binds an identifier through a parameter.
 *
 * @param {import("ast-types").NodePath} path - The path of the identifier
 * @returns {import("ast-types").ASTNode | null} The function or catch clause that
 *   binds the identifier through a parameter, or null
 */
function findBindingParameter(path) {
  const { parentPath } = path

  if (!parentPath) {
    return null
  }

  const { node } = parentPath

  if (j.Function.check(node) && node.params?.includes(path.node)) {
    return node
  }

  if (j.CatchClause.check(node) && node.param === path.node) {
    return node
  }

  return findBindingParameter(parentPath)
}

/**
 * Check whether an identifier binds a declaration instead of reading a binding.
 *
 * Binding identifiers of other declarations narrow or keep their kind on their
 * own, so they do not count as references.
 *
 * @param {import("ast-types").NodePath} path - The path of the identifier
 * @returns {boolean} True when the identifier binds a declaration
 */
function isDeclarationBinding(path) {
  return findBindingDeclarator(path) !== null || findBindingParameter(path) !== null
}

/**
 * List the identifiers that belong to the binding of a name.
 *
 * Identifiers that resolve to another scope, such as a declaration that shadows
 * the name inside a block, belong to a different binding.
 *
 * @param {ReferenceIndex} references - Indexed identifier references of the root
 * @param {string} varName - The declared name
 * @param {import("ast-types").NodePath} declarationPath - The path to the variable
 *   declaration
 * @returns {Array<import("ast-types").NodePath>} Identifiers of the binding
 */
function listBindingReferences(references, varName, declarationPath) {
  const variableScope = resolveBindingScope(declarationPath, varName)

  return references
    .getPathsFor(varName)
    .filter((path) => resolveBindingScope(path, varName) === variableScope)
}

/**
 * Check whether a reference follows the initialization of a declarator.
 *
 * Positions are missing on nodes that a transformer created, so those count as
 * preceding the declaration. A transformer also re-parents declarators when it
 * splits a declaration, so the end of the declarator is compared instead of the
 * end of its declaration.
 *
 * @param {import("ast-types").NodePath} referencePath - The path of the reference
 * @param {import("jscodeshift").VariableDeclarator} declarator - The declarator to
 *   narrow
 * @returns {boolean} True when the reference follows the declarator
 */
function isAfterDeclarator(referencePath, declarator) {
  return referencePath.node.start >= declarator.end
}

/**
 * Build the reference context of a declarator.
 *
 * @param {import("jscodeshift").VariableDeclarator} declarator - The declarator to
 *   narrow
 * @param {import("ast-types").NodePath} declarationPath - The path to the variable
 *   declaration
 * @returns {Object} The declarator and the scope that would own its narrowed binding
 */
function createReferenceContext(declarator, declarationPath) {
  return {
    declarator,
    bindingScopePath: findBindingScope(declarationPath),
  }
}

/**
 * List the functions between a path and the scope that would own its binding.
 *
 * A reference inside a nested function runs when that function runs, so source
 * order does not imply execution order.
 *
 * @param {import("ast-types").NodePath} path - The path to inspect
 * @param {import("ast-types").ASTNode} scopeNode - The scope that holds the path
 * @returns {Array<import("ast-types").ASTNode>} Enclosing function nodes
 */
function listEnclosingFunctions(path, scopeNode) {
  const { parentPath } = path

  if (parentPath.node === scopeNode) {
    return []
  }

  const enclosingFunctions = listEnclosingFunctions(parentPath, scopeNode)

  return j.Function.check(parentPath.node)
    ? [parentPath.node, ...enclosingFunctions]
    : enclosingFunctions
}

/**
 * Check whether a call that precedes the declarator reads the reference.
 *
 * A reference inside a nested function runs whenever a call runs that function,
 * so source order does not prove execution order. Only a call that names the
 * enclosing function counts: a property call, an alias, and a callback cannot
 * be followed.
 *
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {import("ast-types").NodePath} referencePath - The path of the reference
 * @param {Object} context - The declarator and the scope that would own its binding
 * @param {import("jscodeshift").VariableDeclarator} context.declarator - The
 *   declarator to narrow
 * @param {import("ast-types").NodePath} context.bindingScopePath - The scope that
 *   would own the narrowed binding
 * @returns {boolean} True when a call runs before the declarator into a function
 *   that holds the reference
 */
function isCalledBeforeDeclarator(
  calls,
  referencePath,
  { declarator, bindingScopePath },
) {
  return listEnclosingFunctions(referencePath, bindingScopePath.node).some(
    (functionNode) =>
      calls
        .getPathsFor(functionNode)
        .some((callPath) => callPath.node.start < declarator.start),
  )
}

/**
 * Check whether a path keeps reaching the narrowed binding.
 *
 * A path outside the narrowed binding scope stops resolving, a path before the
 * declarator reads the hoisted `undefined` instead of the temporal dead zone,
 * and a function that a call above the declarator runs reaches the binding
 * before its initializer.
 *
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {import("ast-types").NodePath} path - The path to inspect
 * @param {Object} context - The declarator and the scope that would own its binding
 * @param {import("jscodeshift").VariableDeclarator} context.declarator - The
 *   declarator to narrow
 * @param {import("ast-types").NodePath} context.bindingScopePath - The scope that
 *   would own the narrowed binding
 * @returns {boolean} True when the path stays valid
 */
function reachesNarrowedBinding(calls, path, context) {
  return (
    isInsideNode(context.bindingScopePath.node, path) &&
    isAfterDeclarator(path, context.declarator) &&
    !isCalledBeforeDeclarator(calls, path, context)
  )
}

/**
 * Check whether a reference keeps reading the binding when narrowed.
 *
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {import("ast-types").NodePath} referencePath - The path of the reference
 * @param {Object} context - The declarator and the scope that would own its binding
 * @returns {boolean} True when the reference stays valid
 */
function keepsReferenceInScope(calls, referencePath, context) {
  return (
    isDeclarationBinding(referencePath) ||
    reachesNarrowedBinding(calls, referencePath, context)
  )
}

/**
 * List the direct eval calls that run in the variable scope of a declaration.
 *
 * A direct `eval` runs in the scope of the call site, so every call inside the
 * variable scope reads, writes, and declares the bindings of that scope by name.
 *
 * @param {DirectEvalIndex} evalCalls - Indexed direct eval calls of the root
 * @param {import("ast-types").NodePath} declarationPath - The path to the variable
 *   declaration
 * @returns {Array<import("ast-types").NodePath>} Paths of the calls
 */
function listScopeEvalCalls(evalCalls, declarationPath) {
  const variableScopePath = findAncestorPath(isFunctionScopeNode, declarationPath)

  return evalCalls.getPathsInScope(variableScopePath.node)
}

/**
 * Check that the direct eval calls of a declarator keep reaching the narrowed
 * binding.
 *
 * A call that the narrowed binding no longer reaches runs without the binding,
 * so the declaration keeps `var`.
 *
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {DirectEvalIndex} evalCalls - Indexed direct eval calls of the root
 * @param {import("ast-types").NodePath} declarationPath - The path to the variable
 *   declaration
 * @param {Object} context - The declarator and the scope that would own its binding
 * @returns {boolean} True when every call stays valid
 */
function keepsEvalCallsInScope(calls, evalCalls, declarationPath, context) {
  return listScopeEvalCalls(evalCalls, declarationPath).every((evalPath) =>
    reachesNarrowedBinding(calls, evalPath, context),
  )
}

/**
 * Check whether a direct eval call writes the narrowed binding.
 *
 * A call that reaches the narrowed binding writes the binding without leaving an
 * identifier behind, so the declaration cannot become `const`.
 *
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {DirectEvalIndex} evalCalls - Indexed direct eval calls of the root
 * @param {import("jscodeshift").VariableDeclarator} declarator - The declarator to
 *   narrow
 * @param {import("ast-types").NodePath} declarationPath - The path to the variable
 *   declaration
 * @returns {boolean} True when a call may write the binding
 */
function writesNarrowedBinding(calls, evalCalls, declarator, declarationPath) {
  const context = createReferenceContext(declarator, declarationPath)

  return listScopeEvalCalls(evalCalls, declarationPath).some((evalPath) =>
    reachesNarrowedBinding(calls, evalPath, context),
  )
}

/**
 * Check that a declarator keeps its own references when it narrows.
 *
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {DirectEvalIndex} evalCalls - Indexed direct eval calls of the root
 * @param {ReferenceIndex} references - Indexed identifier references of the root
 * @param {import("jscodeshift").VariableDeclarator} declarator - The declarator to
 *   narrow
 * @param {import("ast-types").NodePath} declarationPath - The path to the variable
 *   declaration
 * @returns {boolean} True when every reference stays valid
 */
function keepsOwnReferences(calls, evalCalls, references, declarator, declarationPath) {
  const context = createReferenceContext(declarator, declarationPath)

  return (
    keepsEvalCallsInScope(calls, evalCalls, declarationPath, context) &&
    [...new NodeTest(declarator.id).extractIdentifiersFromPattern()].every((varName) =>
      listBindingReferences(references, varName, declarationPath).every(
        (referencePath) => keepsReferenceInScope(calls, referencePath, context),
      ),
    )
  )
}

/**
 * Check whether an identifier keeps every declaration of a shared binding valid.
 *
 * `var` declarations of one name in a variable scope share a single binding.
 * Narrowing one of them moves it into a block, so the other declarations must
 * narrow as well, and no declaration may land in the scope of a parameter.
 *
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {DirectEvalIndex} evalCalls - Indexed direct eval calls of the root
 * @param {ReferenceIndex} references - Indexed identifier references of the root
 * @param {import("ast-types").NodePath} path - The path of the identifier
 * @param {Object} context - The declarator and the scope that would own its binding
 * @param {import("jscodeshift").VariableDeclarator} context.declarator - The
 *   declarator to narrow
 * @param {import("ast-types").NodePath} context.bindingScopePath - The scope that
 *   would own the narrowed binding
 * @returns {boolean} True when the identifier stays valid
 */
function keepsSharedOccurrence(calls, evalCalls, references, path, context) {
  const sibling = findBindingDeclarator(path)

  if (sibling) {
    return (
      sibling.node === context.declarator ||
      (findBindingScope(sibling.parentPath).node !== context.bindingScopePath.node &&
        keepsOwnReferences(
          calls,
          evalCalls,
          references,
          sibling.node,
          sibling.parentPath,
        ))
    )
  }

  const parameter = findBindingParameter(path)

  if (parameter) {
    return parameter.body !== context.bindingScopePath.node
  }

  return keepsReferenceInScope(calls, path, context)
}

/**
 * Check that narrowing a declarator to a block-scoped binding keeps every
 * reference valid.
 *
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {DirectEvalIndex} evalCalls - Indexed direct eval calls of the root
 * @param {ReferenceIndex} references - Indexed identifier references of the root
 * @param {import("jscodeshift").VariableDeclarator} declarator - The declarator to
 *   narrow
 * @param {import("ast-types").NodePath} declarationPath - The path to the variable
 *   declaration
 * @returns {boolean} True when every reference stays valid
 */
function keepsReferencesInScope(
  calls,
  evalCalls,
  references,
  declarator,
  declarationPath,
) {
  const context = createReferenceContext(declarator, declarationPath)

  return (
    keepsEvalCallsInScope(calls, evalCalls, declarationPath, context) &&
    [...new NodeTest(declarator.id).extractIdentifiersFromPattern()].every((varName) =>
      listBindingReferences(references, varName, declarationPath).every(
        (referencePath) =>
          keepsSharedOccurrence(calls, evalCalls, references, referencePath, context),
      ),
    )
  )
}

/**
 * Determine the appropriate kind (const, let or var) for a declarator
 *
 * @param {ReassignmentIndex} reassignments - Indexed assignments and updates
 * @param {ReferenceIndex} references - Indexed identifier references
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {DirectEvalIndex} evalCalls - Indexed direct eval calls of the root
 * @param {import("jscodeshift").VariableDeclarator} declarator - The variable
 *   declarator
 * @param {import("ast-types").NodePath} declarationPath - The path to the variable
 *   declaration
 * @returns {"const" | "let" | "var"} The appropriate variable kind
 */
function determineDeclaratorKind(
  reassignments,
  references,
  calls,
  evalCalls,
  declarator,
  declarationPath,
) {
  if (
    !keepsReferencesInScope(calls, evalCalls, references, declarator, declarationPath)
  ) {
    return "var"
  }

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

  // Destructuring patterns and plain identifiers both yield their bound names
  for (const varName of new NodeTest(declarator.id).extractIdentifiersFromPattern()) {
    if (isVariableReassigned(reassignments, varName, declarationPath)) {
      return "let"
    }
  }

  if (writesNarrowedBinding(calls, evalCalls, declarator, declarationPath)) {
    return "let"
  }

  return "const"
}

/**
 * Check whether a position accepts a lexical declaration.
 *
 * A lexical declaration is a statement list item, the target of a `for` loop,
 * or the declaration of an export.
 *
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {boolean} True when the position accepts a lexical declaration
 */
function acceptsLexicalDeclaration(path) {
  if (Array.isArray(path.parentPath.value)) {
    return true
  }

  const parent = path.parentPath.node

  if (j.ForStatement.check(parent)) {
    return path.name === "init"
  }

  if (j.ForInStatement.check(parent) || j.ForOfStatement.check(parent)) {
    return path.name === "left"
  }

  return j.ExportNamedDeclaration.check(parent)
}

/**
 * Check whether an identifier names a property instead of a variable.
 *
 * A non-computed property key and a non-computed member property never read a
 * variable, so a declaration that shares their name stays confined.
 *
 * @param {import("ast-types").NodePath} path - The path to the identifier
 * @returns {boolean} True when the identifier is not a variable reference
 */
function namesProperty({ name, parent }) {
  const parentNode = parent.node

  return (name === "key" || name === "property") && !parentNode.computed
}

/**
 * Check whether a declaration binds every name once.
 *
 * Declarators that share a name cannot split into separate lexical
 * declarations.
 *
 * @param {Set<import("ast-types").namedTypes.Identifier>} bindingIdentifiers -
 *   Identifiers the declaration binds
 * @returns {boolean} True when the declaration binds every name once
 */
function bindsDistinctNames(bindingIdentifiers) {
  const names = [...bindingIdentifiers].map((identifier) => identifier.name)

  return names.length === new Set(names).size
}

/**
 * Check whether a declaration is the only place its names appear.
 *
 * A block narrows the scope of the declared names, so a declaration may only
 * move into a block when every identifier of the names belongs to it.
 *
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {boolean} True when the names only appear as binding identifiers
 */
function confinesNamesToDeclaration(path) {
  const bindingIdentifiers = new Set(
    path.node.declarations.flatMap((declarator) => [
      ...new NodeTest(declarator.id).extractBindingIdentifiers(),
    ]),
  )

  if (!bindsDistinctNames(bindingIdentifiers)) {
    return false
  }

  const names = new Set([...bindingIdentifiers].map((identifier) => identifier.name))

  return j(path.scope.path)
    .find(j.Identifier)
    .every((identifierPath) => {
      return (
        !names.has(identifierPath.node.name) ||
        namesProperty(identifierPath) ||
        bindingIdentifiers.has(identifierPath.node)
      )
    })
}

/**
 * Resolve the path of a declaration that may become a lexical declaration.
 *
 * A single-statement body does not accept a lexical declaration, so the
 * declaration moves into a block. A declaration that shares its names with
 * other code keeps its kind, because a block narrows the scope of the names.
 *
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {import("ast-types").NodePath | null} Path of the declaration to
 *   convert, or null when it keeps its kind
 */
function resolveLexicalDeclaration(path) {
  if (acceptsLexicalDeclaration(path)) {
    return path
  }

  if (!confinesNamesToDeclaration(path)) {
    return null
  }

  const declaration = path.node
  path.replace(j.blockStatement([declaration]))

  return path.get("body").get(0)
}

/**
 * Process a single declarator variable declaration
 *
 * @param {ReassignmentIndex} reassignments - Indexed assignments and updates
 * @param {ReferenceIndex} references - Indexed identifier references
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {DirectEvalIndex} evalCalls - Indexed direct eval calls of the root
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {boolean} True when the declaration became a lexical declaration
 */
export function processSingleDeclarator(
  reassignments,
  references,
  calls,
  evalCalls,
  path,
) {
  const declarationPath = resolveLexicalDeclaration(path)

  if (declarationPath === null) {
    return false
  }

  const declarator = declarationPath.node.declarations[0]
  const kind = determineDeclaratorKind(
    reassignments,
    references,
    calls,
    evalCalls,
    declarator,
    declarationPath,
  )

  if (kind === declarationPath.node.kind) {
    return false
  }

  declarationPath.node.kind = kind

  return true
}

/**
 * Check whether a declaration can split into several declarations.
 *
 * Only a declaration in a slot holding a list of statements can split. The
 * initializer of a `for` loop and an exported declaration hold a single node.
 *
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {boolean} True when the declaration can split into several declarations
 */
function canSplitDeclaration(path) {
  return Array.isArray(path.parentPath.value)
}

/**
 * Calculate the kind shared by all declarators of a declaration.
 *
 * The declarators keep a single kind, which is `var` or `let` as soon as one
 * declarator requires it.
 *
 * @param {ReassignmentIndex} reassignments - Indexed assignments and updates
 * @param {ReferenceIndex} references - Indexed identifier references
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {DirectEvalIndex} evalCalls - Indexed direct eval calls of the root
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {"const" | "let" | "var"} The kind for the whole declaration
 */
function calculateMergedKind(reassignments, references, calls, evalCalls, path) {
  const kinds = path.node.declarations.map((declarator) => {
    return determineDeclaratorKind(
      reassignments,
      references,
      calls,
      evalCalls,
      declarator,
      path,
    )
  })

  if (kinds.includes("var")) {
    return "var"
  }

  return kinds.includes("let") ? "let" : "const"
}

/**
 * Split a variable declaration into one declaration per declarator.
 *
 * @param {ReassignmentIndex} reassignments - Indexed assignments and updates
 * @param {ReferenceIndex} references - Indexed identifier references
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {DirectEvalIndex} evalCalls - Indexed direct eval calls of the root
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {boolean} True when the declaration changed
 */
function splitDeclarators(reassignments, references, calls, evalCalls, path) {
  const kinds = path.node.declarations.map((declarator) => {
    return determineDeclaratorKind(
      reassignments,
      references,
      calls,
      evalCalls,
      declarator,
      path,
    )
  })

  if (kinds.every((kind) => kind === "var")) {
    return false
  }

  j(path).replaceWith(
    kinds.map((kind, index) => {
      return j.variableDeclaration(kind, [path.node.declarations[index]])
    }),
  )

  return true
}

/**
 * Process a multiple declarator variable declaration by splitting into separate
 * declarations, or by merging the declarator kinds when the declaration cannot
 * split.
 *
 * @param {ReassignmentIndex} reassignments - Indexed assignments and updates
 * @param {ReferenceIndex} references - Indexed identifier references
 * @param {CallIndex} calls - Indexed calls of the root
 * @param {DirectEvalIndex} evalCalls - Indexed direct eval calls of the root
 * @param {import("ast-types").NodePath} path - The path to the variable declaration
 * @returns {boolean} True when the declaration became a lexical declaration
 */
export function processMultipleDeclarators(
  reassignments,
  references,
  calls,
  evalCalls,
  path,
) {
  const declarationPath = resolveLexicalDeclaration(path)

  if (declarationPath === null) {
    return false
  }

  if (canSplitDeclaration(declarationPath)) {
    return splitDeclarators(
      reassignments,
      references,
      calls,
      evalCalls,
      declarationPath,
    )
  }

  const kind = calculateMergedKind(
    reassignments,
    references,
    calls,
    evalCalls,
    declarationPath,
  )

  if (kind === declarationPath.node.kind) {
    return false
  }

  declarationPath.node.kind = kind

  return true
}

/**
 * Check if an identifier is shadowed by a local declaration or parameter.
 *
 * @param {import("ast-types").NodePath} path - Path to the identifier
 * @param {string} name - Name to check for shadowing
 * @returns {boolean} True if the identifier is shadowed
 */
export function isShadowed({ scope }, name) {
  return scope.lookup(name) !== null
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
