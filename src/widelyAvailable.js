import { default as j } from "jscodeshift"
import {
  NodeTest,
  processMultipleDeclarators,
  processSingleDeclarator,
  isShadowed,
  validateChecks,
} from "./types.js"

/**
 * Transform var to const or let.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let
 */
export function varToLetOrConst(root) {
  let modified = false

  root.find(j.VariableDeclaration, { kind: "var" }).forEach((path) => {
    const isSingleDeclarator = path.node.declarations.length === 1

    const result = isSingleDeclarator
      ? processSingleDeclarator(root, path)
      : processMultipleDeclarators(root, path)

    if (result.modified) {
      modified = true
    }
  })

  return modified
}

/**
 * Transform string concatenation to template literals.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
 */
export function concatToTemplateLiteral(root) {
  let modified = false

  root
    .find(j.BinaryExpression, { operator: "+" })
    .filter((path) => new NodeTest(path.node).containsStringLiteral())
    .forEach((path) => {
      const parts = []
      const expressions = []
      let lastStringNode = null

      function addStringPart(stringNode) {
        const nodeTest = new NodeTest(stringNode)
        const rawValue = nodeTest.getRawStringValue()
        const cookedValue = stringNode.value

        // Check if we need to add a line continuation backslash
        // This happens when two consecutive string literals are on different lines
        let needsLineContinuation = false
        if (
          lastStringNode &&
          lastStringNode.loc &&
          stringNode.loc &&
          lastStringNode.loc.end.line < stringNode.loc.start.line
        ) {
          // Strings are on different lines - add line continuation
          needsLineContinuation = true
        }

        if (parts.length === 0 || expressions.length >= parts.length) {
          parts.push({ raw: rawValue, cooked: cookedValue })
        } else {
          const lastPart = parts[parts.length - 1]
          if (needsLineContinuation) {
            // Add backslash and newline for line continuation
            // But if the last part already ends with a newline, don't add another backslash+newline
            if (lastPart.raw.endsWith("\n")) {
              lastPart.raw += rawValue
            } else {
              lastPart.raw += `\\
${rawValue}`
            }
            lastPart.cooked += cookedValue
          } else {
            lastPart.raw += rawValue
            lastPart.cooked += cookedValue
          }
        }

        lastStringNode = stringNode
      }

      function addExpression(expr) {
        if (parts.length === 0) {
          parts.push({ raw: "", cooked: "" })
        }
        expressions.push(expr)
      }

      function flatten(node, stringContext = false) {
        if (j.BinaryExpression.check(node) && node.operator === "+") {
          const nodeTest = new NodeTest(node)
          const hasString = nodeTest.containsStringLiteral()

          if (!hasString && !stringContext) {
            addExpression(node)
          } else {
            const leftHasString = new NodeTest(node.left).containsStringLiteral()

            if (j.BinaryExpression.check(node.left) && node.left.operator === "+") {
              flatten(node.left, stringContext)
            } else if (new NodeTest(node.left).isStringLiteral()) {
              addStringPart(node.left)
            } else {
              addExpression(node.left)
            }

            const rightInStringContext = stringContext || leftHasString
            if (j.BinaryExpression.check(node.right) && node.right.operator === "+") {
              if (
                !new NodeTest(node.right).containsStringLiteral() &&
                rightInStringContext
              ) {
                addExpression(node.right)
              } else {
                flatten(node.right, rightInStringContext)
              }
            } else if (new NodeTest(node.right).isStringLiteral()) {
              addStringPart(node.right)
            } else {
              addExpression(node.right)
            }
          }
        }
      }

      flatten(path.node)

      // Ensure we have the right number of quasis (one more than expressions)
      while (parts.length <= expressions.length) {
        parts.push({ raw: "", cooked: "" })
      }

      // Create template literal
      const quasis = parts.map((part, i) =>
        j.templateElement(
          { raw: part.raw, cooked: part.cooked },
          i === parts.length - 1,
        ),
      )

      const templateLiteral = j.templateLiteral(quasis, expressions)
      j(path).replaceWith(templateLiteral)

      modified = true
    })

  return modified
}

/**
 * Transform Object.assign({}, ...) to object spread.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
 */
export function objectAssignToSpread(root) {
  let modified = false

  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { name: "Object" },
        property: { name: "assign" },
      },
    })
    .filter((path) => {
      // First argument must be empty object literal
      const firstArg = path.node.arguments[0]
      return j.ObjectExpression.check(firstArg) && firstArg.properties.length === 0
    })
    .forEach((path) => {
      const spreadProperties = path.node.arguments
        .slice(1)
        .map((arg) => j.spreadElement(arg))

      const objectExpression = j.objectExpression(spreadProperties)
      j(path).replaceWith(objectExpression)

      modified = true
    })

  return modified
}

/**
 * Transform Array.from().forEach() to for...of.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
 */
export function arrayFromForEachToForOf(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node
      // Check if this is a forEach call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "forEach"
      ) {
        return false
      }

      // Check if the object is Array.from()
      const object = node.callee.object
      return new NodeTest(object).isArrayStaticCall("from")
    })
    .forEach((path) => {
      const node = path.node
      const iterable = node.callee.object.arguments[0]
      const callback = node.arguments[0]

      // Only transform if callback is a function
      if (
        callback &&
        (j.ArrowFunctionExpression.check(callback) ||
          j.FunctionExpression.check(callback))
      ) {
        // Only transform if:
        // 1. Callback has exactly 1 parameter (element only), OR
        // 2. Callback has 2+ params AND first param is a destructuring pattern (e.g., [key, value])
        //    This handles cases like Array.from(Object.entries(obj)).forEach(([k, v]) => ...)
        const params = callback.params
        const canTransform =
          params.length === 1 || (params.length >= 2 && j.ArrayPattern.check(params[0]))

        if (canTransform) {
          const itemParam = callback.params[0]
          const body = callback.body

          // Create for...of loop
          const forOfLoop = j.forOfStatement(
            j.variableDeclaration("const", [j.variableDeclarator(itemParam)]),
            iterable,
            j.BlockStatement.check(body)
              ? body
              : j.blockStatement([j.expressionStatement(body)]),
          )

          // Replace the expression statement containing the forEach call
          const statement = path.parent
          if (j.ExpressionStatement.check(statement.node)) {
            j(statement).replaceWith(forOfLoop)

            modified = true
          }
        }
      }
    })

  return modified
}

/**
 * Transform Array.from(obj) to [...obj] spread syntax. This handles cases like
 * Array.from(obj).map(), .filter(), .some(), etc. that are not covered by the forEach
 * transformer.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
 */
export function arrayFromToSpread(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      // Check if this is Array.from() call
      if (!new NodeTest(node).isArrayStaticCall("from")) {
        return false
      }

      // Must have exactly one argument (the iterable)
      // If there's a second argument (mapping function), we should not transform
      if (node.arguments.length !== 1) {
        return false
      }

      // Don't transform if this is Array.from().forEach()
      // as that's handled by arrayFromForEachToForOf
      const parent = path.parent.node
      if (
        j.MemberExpression.check(parent) &&
        j.Identifier.check(parent.property) &&
        parent.property.name === "forEach"
      ) {
        return false
      }

      return true
    })
    .forEach((path) => {
      const node = path.node
      const iterable = node.arguments[0]

      // Create array with spread element
      const spreadArray = j.arrayExpression([j.spreadElement(iterable)])

      j(path).replaceWith(spreadArray)

      modified = true
    })

  return modified
}

/**
 * Transform Math.pow() to exponentiation operator (**).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Exponentiation
 */
export function mathPowToExponentiation(root) {
  let modified = false

  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { name: "Math" },
        property: { name: "pow" },
      },
    })
    .filter((path) => {
      // Must have exactly 2 arguments (base and exponent)
      return path.node.arguments.length === 2
    })
    .forEach((path) => {
      const node = path.node
      const [base, exponent] = node.arguments

      // Create exponentiation expression
      const expExpression = j.binaryExpression("**", base, exponent)

      j(path).replaceWith(expExpression)

      modified = true
    })

  return modified
}

/**
 * Transform traditional for loops to for...of where safe. Converts: for (let i = 0; i <
 * arr.length; i++) { const item = arr[i]; ... } To: for (const item of arr) { ... }
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
 */
export function forLoopToForOf(root) {
  let modified = false

  root
    .find(j.ForStatement)
    .filter((path) => {
      const node = path.node

      // Check init: must be let/const i = 0
      if (!j.VariableDeclaration.check(node.init)) {
        return false
      }
      if (node.init.declarations.length !== 1) {
        return false
      }
      const initDeclarator = node.init.declarations[0]
      if (!j.Identifier.check(initDeclarator.id)) {
        return false
      }
      const indexVar = initDeclarator.id.name
      if (!j.Literal.check(initDeclarator.init) || initDeclarator.init.value !== 0) {
        return false
      }

      // Check test: must be i < arr.length
      if (!j.BinaryExpression.check(node.test)) {
        return false
      }
      if (node.test.operator !== "<") {
        return false
      }
      if (!j.Identifier.check(node.test.left) || node.test.left.name !== indexVar) {
        return false
      }
      if (!j.MemberExpression.check(node.test.right)) {
        return false
      }
      if (
        !j.Identifier.check(node.test.right.property) ||
        node.test.right.property.name !== "length"
      ) {
        return false
      }
      if (!j.Identifier.check(node.test.right.object)) {
        return false
      }
      const arrayVar = node.test.right.object.name

      // Check update: must be i++ or ++i
      if (j.UpdateExpression.check(node.update)) {
        if (
          !j.Identifier.check(node.update.argument) ||
          node.update.argument.name !== indexVar ||
          node.update.operator !== "++"
        ) {
          return false
        }
      } else {
        return false
      }

      // Check body: must be a block statement
      if (!j.BlockStatement.check(node.body)) {
        return false
      }

      // Look for first statement that assigns arr[i] to a variable
      if (node.body.body.length === 0) {
        return false
      }

      const firstStmt = node.body.body[0]
      if (!j.VariableDeclaration.check(firstStmt)) {
        return false
      }
      if (firstStmt.declarations.length !== 1) {
        return false
      }
      const varDeclarator = firstStmt.declarations[0]
      if (!j.Identifier.check(varDeclarator.id)) {
        return false
      }
      if (!j.MemberExpression.check(varDeclarator.init)) {
        return false
      }
      if (
        !j.Identifier.check(varDeclarator.init.object) ||
        varDeclarator.init.object.name !== arrayVar
      ) {
        return false
      }
      if (
        !j.Identifier.check(varDeclarator.init.property) ||
        varDeclarator.init.property.name !== indexVar ||
        varDeclarator.init.computed !== true
      ) {
        return false
      }

      // Check that the index variable is not used elsewhere in the body
      const bodyWithoutFirst = node.body.body.slice(1)
      const indexVarUsed = bodyWithoutFirst.some((stmt) =>
        new NodeTest(stmt).usesIdentifier(indexVar),
      )

      return !indexVarUsed
    })
    .forEach((path) => {
      const node = path.node
      const arrayVar = node.test.right.object.name
      const itemVar = node.body.body[0].declarations[0].id.name
      const itemKind = node.body.body[0].kind

      // Create new body without the first declaration
      const newBody = j.blockStatement(node.body.body.slice(1))

      // Create for...of loop
      const forOfLoop = j.forOfStatement(
        j.variableDeclaration(itemKind, [j.variableDeclarator(j.identifier(itemVar))]),
        j.identifier(arrayVar),
        newBody,
      )

      j(path).replaceWith(forOfLoop)

      modified = true
    })

  return modified
}

/**
 * Transform iterables' forEach() to for...of loop. Handles DOM APIs like
 * querySelectorAll, getElementsBy*, etc. and other known iterables. Only transforms
 * when forEach callback is declared inline with a function body (block statement).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
 */
export function iterableForEachToForOf(root) {
  let modified = false

  // Define known iterable-returning methods by their object/context
  const knownIterableMethods = {
    document: [
      "querySelectorAll",
      "getElementsByTagName",
      "getElementsByClassName",
      "getElementsByName",
    ],
  }

  // Define known iterable properties
  const knownIterableProperties = {
    window: ["frames"],
    globalThis: ["frames"],
  }

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node
      // Check if this is a forEach call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "forEach"
      ) {
        return false
      }

      const object = node.callee.object

      // Check if this is a property access pattern like window.frames
      if (j.MemberExpression.check(object) && !j.CallExpression.check(object)) {
        const objectName = j.Identifier.check(object.object) ? object.object.name : null
        const propertyName = j.Identifier.check(object.property)
          ? object.property.name
          : null

        if (
          objectName &&
          propertyName &&
          knownIterableProperties[objectName] &&
          knownIterableProperties[objectName].includes(propertyName)
        ) {
          // This is a valid iterable property like window.frames - continue to callback check
        } else {
          // Not a known iterable property
          return false
        }
      }
      // Check for method call patterns like document.querySelectorAll()
      else if (j.CallExpression.check(object)) {
        // Check if it's a member expression (e.g., document.querySelectorAll)
        if (!j.MemberExpression.check(object.callee)) {
          return false
        }

        // Get the method name
        const methodName = j.Identifier.check(object.callee.property)
          ? object.callee.property.name
          : null

        if (!methodName) {
          return false
        }

        // Verify the object is document only
        const callerObject = object.callee.object
        if (j.Identifier.check(callerObject)) {
          const objectName = callerObject.name
          // Only allow document
          if (objectName !== "document") {
            return false
          }
          // Verify method belongs to document
          if (!knownIterableMethods.document.includes(methodName)) {
            return false
          }
        } else if (
          j.MemberExpression.check(callerObject) ||
          j.CallExpression.check(callerObject)
        ) {
          if (!new NodeTest(callerObject).isFromDocument()) {
            return false
          }
          if (!knownIterableMethods.document.includes(methodName)) {
            return false
          }
        } else {
          return false
        }
      } else {
        return false
      }

      // Check that forEach has a callback argument
      if (node.arguments.length === 0) {
        return false
      }

      const callback = node.arguments[0]
      // Only transform if callback is an inline function (arrow or function expression)
      if (
        !j.ArrowFunctionExpression.check(callback) &&
        !j.FunctionExpression.check(callback)
      ) {
        return false
      }

      // Only transform if the callback has a block statement body (with braces)
      // Arrow functions with expression bodies (e.g., item => item.value) should NOT be transformed
      if (!j.BlockStatement.check(callback.body)) {
        return false
      }

      // Only transform if callback uses only the first parameter (element)
      // Don't transform if it uses index or array parameters
      const params = callback.params
      if (params.length !== 1) {
        return false
      }

      return true
    })
    .forEach((path) => {
      const node = path.node
      const iterable = node.callee.object
      const callback = node.arguments[0]

      const itemParam = callback.params[0]
      const body = callback.body

      // Create for...of loop
      const forOfLoop = j.forOfStatement(
        j.variableDeclaration("const", [j.variableDeclarator(itemParam)]),
        iterable,
        body,
      )

      // Replace the expression statement containing the forEach call
      const statement = path.parent
      if (j.ExpressionStatement.check(statement.node)) {
        j(statement).replaceWith(forOfLoop)

        modified = true
      }
    })

  return modified
}

/**
 * Transform anonymous function expressions to arrow functions. Does not transform if
 * the function:
 *
 * - Is a named function expression (useful for stack traces and recursion)
 * - Uses 'this' (arrow functions don't have their own 'this')
 * - Uses 'arguments' (arrow functions don't have 'arguments' object)
 * - Uses 'super' (defensive check, though this would be a syntax error in function
 *   expressions)
 * - Is a generator function (arrow functions cannot be generators)
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
 */
export function anonymousFunctionToArrow(root) {
  let modified = false

  root
    .find(j.FunctionExpression)
    .filter((path) => {
      const node = path.node

      // Skip if it's a named function expression
      // Named functions are useful for stack traces and recursion
      if (node.id) {
        return false
      }

      // Skip if it's a generator function
      if (node.generator) {
        return false
      }

      // Skip if it uses 'this'
      if (new NodeTest(node.body).usesThis()) {
        return false
      }

      // Skip if it uses 'arguments'
      if (new NodeTest(node.body).usesArguments()) {
        return false
      }

      // Skip if this function expression is the init of a variable declarator
      // because namedArrowFunctionToNamedFunction will handle those
      const parent = path.parent.node
      if (j.VariableDeclarator.check(parent) && parent.init === node) {
        return false
      }

      // Note: We don't need to check for 'super' because using super in a
      // function expression is a syntax error and will never parse successfully

      return true
    })
    .forEach((path) => {
      const node = path.node

      // Create arrow function with same params and body
      const arrowFunction = j.arrowFunctionExpression(node.params, node.body, false)

      // Preserve async property
      if (node.async) {
        arrowFunction.async = true
      }

      j(path).replaceWith(arrowFunction)

      modified = true
    })

  return modified
}

/**
 * Transform named arrow function and anonymous function expression assignments to
 * named function declarations. Converts:
 *
 * - Const myFunc = () => {} to: function myFunc() {}
 * - Const myFunc = function() {} to: function myFunc() {}
 * - Let myFunc = function(x: number): number {...} to: function myFunc(x: number): number {...}
 *
 * Only transforms when safe (function doesn't use outer 'this' or 'arguments'). Note:
 * Arrow functions never have their own 'this' or 'arguments', so this transformation
 * is generally safe for arrow functions, but we check to ensure they don't use 'this'
 * at all to avoid potential issues.
 *
 * TypeScript type annotations on function parameters and return types are preserved.
 * Variables with type annotations are only skipped if the function itself doesn't
 * have a return type annotation that can be preserved.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions
 */
export function namedArrowFunctionToNamedFunction(root) {
  let modified = false

  root
    .find(j.VariableDeclaration)
    .filter((path) => {
      const node = path.node

      // Must have exactly one declarator
      if (node.declarations.length !== 1) {
        return false
      }

      const declarator = node.declarations[0]

      // Declarator must have an identifier (simple variable name)
      if (!j.Identifier.check(declarator.id)) {
        return false
      }

      // Init must be an arrow function or anonymous function expression
      const isArrowFunction = j.ArrowFunctionExpression.check(declarator.init)
      const isFunctionExpression =
        j.FunctionExpression.check(declarator.init) && !declarator.init.id

      if (!isArrowFunction && !isFunctionExpression) {
        return false
      }

      const func = declarator.init

      // Skip if the variable has a TypeScript type annotation but the function
      // doesn't have its own return type annotation (which we can preserve)
      // This handles cases like: const Template: StoryFn<MyType> = () => {...}
      // where the type information would be lost in the transformation
      if (declarator.id.typeAnnotation && !func.returnType) {
        return false
      }

      // Skip if it's a generator function
      if (func.generator) {
        return false
      }

      // Skip if the function uses 'this'
      if (new NodeTest(func.body).usesThis()) {
        return false
      }

      // Skip if the function uses 'arguments' (only relevant for function expressions)
      if (isFunctionExpression && new NodeTest(func.body).usesArguments()) {
        return false
      }

      return true
    })
    .forEach((path) => {
      const node = path.node
      const declarator = node.declarations[0]
      const functionName = declarator.id.name
      const func = declarator.init

      // Convert function body to block statement if needed (for arrow functions with expression bodies)
      let functionBody
      if (j.BlockStatement.check(func.body)) {
        functionBody = func.body
      } else {
        // Expression body - wrap in return statement
        functionBody = j.blockStatement([j.returnStatement(func.body)])
      }

      // Create function declaration
      const functionDeclaration = j.functionDeclaration(
        j.identifier(functionName),
        func.params,
        functionBody,
      )

      // Preserve async property
      if (func.async) {
        functionDeclaration.async = true
      }

      // Preserve TypeScript generic type parameters
      if (func.typeParameters) {
        functionDeclaration.typeParameters = func.typeParameters
      }

      // Preserve TypeScript return type annotation
      if (func.returnType) {
        functionDeclaration.returnType = func.returnType
      }

      // Preserve comments from the original variable declaration
      if (node.comments) {
        functionDeclaration.comments = node.comments
      }
      if (node.leadingComments) {
        functionDeclaration.leadingComments = node.leadingComments
      }
      if (node.trailingComments) {
        functionDeclaration.trailingComments = node.trailingComments
      }

      j(path).replaceWith(functionDeclaration)

      modified = true
    })

  return modified
}

/**
 * Transform Array.concat() to array spread syntax.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
 */
export function arrayConcatToSpread(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      // Check if this is a .concat() call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "concat"
      ) {
        return false
      }

      // Must have at least one argument
      if (node.arguments.length === 0) {
        return false
      }

      // Only transform if we can verify the object is an iterable
      return new NodeTest(node.callee.object).isIterable()
    })
    .forEach((path) => {
      const node = path.node
      const baseArray = node.callee.object
      const concatArgs = node.arguments

      // Build array elements: start with spread of base array
      const elements = [j.spreadElement(baseArray)]

      // Add each concat argument
      concatArgs.forEach((arg) => {
        // If the argument is an array literal, spread it
        // Otherwise, check if it's likely an array (could be iterable)
        if (j.ArrayExpression.check(arg)) {
          // Spread array literals
          elements.push(j.spreadElement(arg))
        } else {
          // For non-array arguments, we need to determine if they should be spread
          // In concat(), arrays are flattened one level, primitives are added as-is
          // Since we can't statically determine types, we spread everything
          // This matches concat's behavior for arrays and iterables
          elements.push(j.spreadElement(arg))
        }
      })

      // Create new array expression with spread elements
      const spreadArray = j.arrayExpression(elements)

      j(path).replaceWith(spreadArray)

      modified = true
    })

  return modified
}

/**
 * Transform old-school constructor functions with prototype methods to ES6 class
 * syntax.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes
 */
export function constructorToClass(root) {
  function findConstructors(root) {
    const constructors = new Map()

    root.find(j.FunctionDeclaration).forEach((path) => {
      if (
        !new NodeTest(path.node.id).isConstructorName() ||
        !new NodeTest(path.node.body).hasSimpleConstructorBody()
      ) {
        return
      }

      constructors.set(path.node.id.name, {
        declaration: path,
        prototypeMethods: [],
      })
    })

    root.find(j.VariableDeclaration).forEach((path) => {
      path.node.declarations.forEach((declarator) => {
        if (
          !new NodeTest(declarator.id).isConstructorName() ||
          !j.FunctionExpression.check(declarator.init) ||
          !new NodeTest(declarator.init.body).hasSimpleConstructorBody()
        ) {
          return
        }

        constructors.set(declarator.id.name, {
          declaration: path,
          prototypeMethods: [],
        })
      })
    })

    return constructors
  }

  /**
   * Check if a method value is acceptable for class transformation.
   * Accepts function expressions and arrow functions that don't use 'this'.
   *
   * @param {import("ast-types").ASTNode} methodValue - The method value node
   * @returns {boolean} True if the method can be transformed
   */
  function isAcceptableMethod(methodValue) {
    // Accept function expressions
    if (j.FunctionExpression.check(methodValue)) {
      return true
    }

    // Accept arrow functions that don't use 'this' (safe to convert)
    if (j.ArrowFunctionExpression.check(methodValue)) {
      return !new NodeTest(methodValue.body).usesThis()
    }

    return false
  }

  /**
   * Find and associate prototype methods with constructors.
   *
   * @param {import("jscodeshift").Collection} root - The root AST collection.
   * @param {Map<
   *   string,
   *   { declaration: import("ast-types").NodePath; prototypeMethods: any[] }
   * >} constructors
   *   - Map of constructors.
   */
  function findPrototypeMethods(root, constructors) {
    // Pattern 1: ConstructorName.prototype.methodName = ...
    root
      .find(j.ExpressionStatement)
      .filter((path) => {
        const node = path.node
        if (!j.AssignmentExpression.check(node.expression)) {
          return false
        }

        const assignment = node.expression
        const left = assignment.left

        if (
          !j.MemberExpression.check(left) ||
          !j.MemberExpression.check(left.object) ||
          !j.Identifier.check(left.object.object) ||
          !j.Identifier.check(left.object.property) ||
          left.object.property.name !== "prototype" ||
          !j.Identifier.check(left.property)
        ) {
          return false
        }

        const constructorName = left.object.object.name
        return constructors.has(constructorName)
      })
      .forEach((path) => {
        const assignment = path.node.expression
        const left = assignment.left
        const constructorName = left.object.object.name
        const methodName = left.property.name
        const methodValue = assignment.right

        if (!isAcceptableMethod(methodValue)) {
          return
        }

        constructors.get(constructorName).prototypeMethods.push({
          path,
          methodName,
          methodValue,
        })
      })

    // Pattern 2: ConstructorName.prototype = { methodName: function() {...}, ... }
    root
      .find(j.ExpressionStatement)
      .filter((path) => {
        const node = path.node
        if (!j.AssignmentExpression.check(node.expression)) {
          return false
        }

        const assignment = node.expression
        const left = assignment.left

        if (
          !j.MemberExpression.check(left) ||
          !j.Identifier.check(left.object) ||
          !j.Identifier.check(left.property) ||
          left.property.name !== "prototype"
        ) {
          return false
        }

        const constructorName = left.object.name
        return constructors.has(constructorName)
      })
      .forEach((path) => {
        const assignment = path.node.expression
        const left = assignment.left
        const constructorName = left.object.name
        const methodValue = assignment.right

        if (!j.ObjectExpression.check(methodValue)) {
          return
        }

        methodValue.properties.forEach((prop) => {
          if (!j.Property.check(prop) && !j.ObjectProperty.check(prop)) {
            return
          }

          if (prop.computed) {
            return
          }

          let methodName
          if (j.Identifier.check(prop.key)) {
            methodName = prop.key.name
          } else {
            return
          }

          if (!isAcceptableMethod(prop.value)) {
            return
          }

          constructors.get(constructorName).prototypeMethods.push({
            path,
            methodName,
            methodValue: prop.value,
            isObjectLiteral: true,
          })
        })
      })
  }

  /**
   * Transform constructors and their prototype methods to class syntax.
   *
   * @param {import("jscodeshift").Collection} root - The root AST collection.
   * @param {Map<
   *   string,
   *   { declaration: import("ast-types").NodePath; prototypeMethods: any[] }
   * >} constructors
   *   - Map of constructors.
   *
   * @returns {boolean} True if code was modified.
   */
  function transformConstructorsToClasses(root, constructors) {
    let modified = false

    constructors.forEach((info, constructorName) => {
      if (info.prototypeMethods.length === 0) {
        return
      }

      const declarationPath = info.declaration
      const declarationNode = declarationPath.node

      let constructorNode
      if (j.FunctionDeclaration.check(declarationNode)) {
        constructorNode = declarationNode
      } else {
        const declarator = declarationNode.declarations.find(
          (decl) => decl.id.name === constructorName,
        )
        constructorNode = declarator.init
      }

      const classBody = [
        j.methodDefinition(
          "constructor",
          j.identifier("constructor"),
          j.functionExpression(
            null,
            constructorNode.params,
            constructorNode.body,
            constructorNode.generator,
            constructorNode.async,
          ),
          false,
        ),
      ]

      info.prototypeMethods.forEach(({ methodName, methodValue }) => {
        // For arrow functions, we need to ensure the body is a block statement
        let methodBody = methodValue.body
        if (j.ArrowFunctionExpression.check(methodValue)) {
          // If arrow function has expression body, wrap it in a return statement
          if (!j.BlockStatement.check(methodBody)) {
            methodBody = j.blockStatement([j.returnStatement(methodBody)])
          }
        }

        const method = j.methodDefinition(
          "method",
          j.identifier(methodName),
          j.functionExpression(
            null,
            methodValue.params,
            methodBody,
            methodValue.generator,
            methodValue.async,
          ),
          false,
        )
        classBody.push(method)
      })

      const classDeclaration = j.classDeclaration(
        j.identifier(constructorName),
        j.classBody(classBody),
      )

      classDeclaration.comments = declarationNode.comments

      j(info.declaration).replaceWith(classDeclaration)

      const pathsToRemove = new Set()
      info.prototypeMethods.forEach(({ path }) => {
        pathsToRemove.add(path)
      })

      pathsToRemove.forEach((path) => {
        j(path).remove()
      })

      modified = true
    })

    return modified
  }

  const constructors = findConstructors(root)
  findPrototypeMethods(root, constructors)
  return transformConstructorsToClasses(root, constructors)
}

/**
 * Transform console.log() to console.info().
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/API/console
 */
export function consoleLogToInfo(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node
      // Check if this is a console.log() call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.object) ||
        node.callee.object.name !== "console" ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "log"
      ) {
        return false
      }

      return true
    })
    .forEach((path) => {
      const node = path.node

      // Replace the property name from 'log' to 'info'
      node.callee.property.name = "info"

      modified = true
    })

  return modified
}

/**
 * Remove 'use strict' directives from modules. Modules are strict by default, making
 * these directives redundant.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode#strict_mode_for_modules
 */
export function removeUseStrictFromModules(root) {
  let modified = false

  // Check if the file is a module by looking for import/export statements
  const hasImports = root.find(j.ImportDeclaration).length > 0
  const hasExports =
    root.find(j.ExportNamedDeclaration).length > 0 ||
    root.find(j.ExportDefaultDeclaration).length > 0 ||
    root.find(j.ExportAllDeclaration).length > 0

  const isModule = hasImports || hasExports

  // Only proceed if this is a module
  if (!isModule) {
    return modified
  }

  // Find and remove 'use strict' directives
  root.find(j.Program).forEach((programPath) => {
    const program = programPath.node

    // Check directives array (Babel/TSX parser stores directives here)
    if (program.directives && Array.isArray(program.directives)) {
      let i = 0
      while (i < program.directives.length) {
        const directive = program.directives[i]
        if (directive.value && directive.value.value === "use strict") {
          // This is a 'use strict' directive - remove it
          program.directives.splice(i, 1)
          modified = true
          // Don't increment i since we removed an element
        } else {
          i++
        }
      }
    }

    // Note: 'use strict' directives are typically stored in program.directives (for example with the tsx parser).
    // This transformer currently only handles directives represented in the directives array, not as body expressions.
  })

  return modified
}

/**
 * Replace global context references (window, self, Function("return this")()) with
 * globalThis.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
 */
export function globalContextToGlobalThis(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node
      // Check if this is a call to Function constructor
      if (
        !j.Identifier.check(node.callee) ||
        node.callee.name !== "Function" ||
        node.arguments.length !== 1
      ) {
        return false
      }

      // Check if the argument is "return this" (either single or double quotes)
      const arg = node.arguments[0]
      if (!j.StringLiteral.check(arg) && !j.Literal.check(arg)) {
        return false
      }

      const value = arg.value
      return typeof value === "string" && value === "return this"
    })
    .forEach((path) => {
      // Check if the Function call result is immediately invoked
      const parent = path.parent
      if (j.CallExpression.check(parent.node) && parent.node.callee === path.node) {
        // Replace the entire call expression with globalThis
        j(parent).replaceWith(j.identifier("globalThis"))
        modified = true
      }
    })

  // Transform window and self identifiers to globalThis
  const globalIdentifiers = ["window", "self"]

  for (const globalName of globalIdentifiers) {
    root
      .find(j.Identifier)
      .filter((path) => {
        const node = path.node
        if (node.name !== globalName) {
          return false
        }

        // Don't transform if it's a property name (e.g., obj.window)
        const parent = path.parent.node
        if (
          j.MemberExpression.check(parent) &&
          parent.property === node &&
          !parent.computed
        ) {
          return false
        }

        // Don't transform if it's an object property key or shorthand property
        if (j.Property.check(parent) || j.ObjectProperty.check(parent)) {
          if (parent.key === node && !parent.computed) {
            return false
          }
          if (parent.shorthand === true && parent.value === node) {
            return false
          }
        }

        // Don't transform if it's an object method key (method shorthand syntax)
        if (j.ObjectMethod.check(parent) && parent.key === node) {
          return false
        }

        // Don't transform if it's a class property key
        if (j.ClassProperty.check(parent) && parent.key === node) {
          return false
        }

        // Don't transform if it's a variable declarator id (e.g., var window = ...)
        if (j.VariableDeclarator.check(parent) && parent.id === node) {
          return false
        }

        // Don't transform if it's a function parameter
        if (
          (j.FunctionDeclaration.check(parent) ||
            j.FunctionExpression.check(parent) ||
            j.ArrowFunctionExpression.check(parent)) &&
          parent.params.includes(node)
        ) {
          return false
        }

        // Check if the identifier is shadowed by a local variable or parameter
        if (isShadowed(path, globalName)) {
          return false
        }

        return true
      })
      .forEach((path) => {
        path.node.name = "globalThis"
        modified = true
      })
  }

  return modified
}

/**
 * Transform null/undefined checks to nullish coalescing operator (??).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing
 */
export function nullishCoalescingOperator(root) {
  let modified = false

  root
    .find(j.ConditionalExpression)
    .filter((path) => {
      const node = path.node

      // Test must be a logical AND expression
      if (!j.LogicalExpression.check(node.test) || node.test.operator !== "&&") {
        return false
      }

      const left = node.test.left
      const right = node.test.right

      // Check if left and right are null and undefined checks
      const nullCheck = new NodeTest(left).getNullCheck()
      const undefinedCheck = new NodeTest(right).getUndefinedCheck()

      if (!nullCheck || !undefinedCheck) {
        // Try swapped order
        const nullCheckSwapped = new NodeTest(right).getNullCheck()
        const undefinedCheckSwapped = new NodeTest(left).getUndefinedCheck()

        if (!nullCheckSwapped || !undefinedCheckSwapped) {
          return false
        }

        return validateChecks(nullCheckSwapped, undefinedCheckSwapped, node.consequent)
      }

      return validateChecks(nullCheck, undefinedCheck, node.consequent)
    })
    .forEach((path) => {
      const node = path.node
      const test = node.test
      const left = test.left
      const right = test.right

      // Get the value being checked
      let valueNode
      const nullCheck = new NodeTest(left).getNullCheck()
      const undefinedCheck = new NodeTest(right).getUndefinedCheck()

      if (nullCheck && undefinedCheck) {
        // Normal order: null check on left, undefined check on right
        valueNode = nullCheck.value
      } else {
        // Swapped order: undefined check on left, null check on right
        // The filter guarantees both checks exist in this case
        const nullCheckSwapped = new NodeTest(right).getNullCheck()
        valueNode = nullCheckSwapped.value
      }

      // Create nullish coalescing expression: value ?? default
      const nullishCoalescing = j.logicalExpression("??", valueNode, node.alternate)

      j(path).replaceWith(nullishCoalescing)

      modified = true
    })

  return modified
}

/**
 * Transform Array.slice(0) and Array.slice() to array spread syntax.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
 */
export function arraySliceToSpread(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      // Check if this is a .slice() call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "slice"
      ) {
        return false
      }

      // Only transform slice() with no arguments or slice(0)
      if (node.arguments.length === 0) {
        // slice() with no arguments is valid
      } else if (node.arguments.length === 1) {
        // slice(0) is valid
        const arg = node.arguments[0]
        if (!j.Literal.check(arg) || arg.value !== 0) {
          return false
        }
      } else {
        // slice with 2+ arguments is not a copying operation
        return false
      }

      // Only transform if we can verify the object is an iterable
      return new NodeTest(node.callee.object).isIterable()
    })
    .forEach((path) => {
      const node = path.node
      const arrayExpr = node.callee.object

      // Create array with spread element
      const spreadArray = j.arrayExpression([j.spreadElement(arrayExpr)])

      j(path).replaceWith(spreadArray)

      modified = true
    })

  return modified
}

/**
 * Transform conditional property access patterns to optional chaining. Converts
 * patterns like:
 *
 * - Obj && obj.prop to obj?.prop
 * - Arr && arr[0] to arr?.[0]
 * - Fn && fn() to fn?.()
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining
 */
export function optionalChaining(root) {
  let modified = false

  function buildOptionalChain(base, accesses) {
    let result = base

    for (const access of accesses) {
      if (j.MemberExpression.check(access)) {
        result = j.optionalMemberExpression(
          result,
          access.property,
          access.computed,
          true,
        )
      } else if (j.CallExpression.check(access)) {
        result = j.optionalCallExpression(result, access.arguments, true)
      }
    }

    return result
  }

  function extractChain(node) {
    const parts = []
    let current = node

    while (j.LogicalExpression.check(current) && current.operator === "&&") {
      parts.unshift(current.right)
      current = current.left
    }
    parts.unshift(current)

    const base = parts[0]
    const accesses = []
    for (let i = 1; i < parts.length; i++) {
      const prev = i === 1 ? base : parts[i - 1]
      if (!new NodeTest(parts[i]).isAccessOnBase(prev)) {
        return null
      }
      accesses.push(parts[i])
    }

    return accesses.length > 0 ? { base, accesses } : null
  }

  // Transform logical && expressions to optional chaining
  root
    .find(j.LogicalExpression, { operator: "&&" })
    .filter((path) => {
      // Only transform if this is the top-level && in the chain
      const parent = path.parent.node
      if (
        j.LogicalExpression.check(parent) &&
        parent.operator === "&&" &&
        parent.left === path.node
      ) {
        return false
      }
      return true
    })
    .forEach((path) => {
      const chain = extractChain(path.node)
      if (!chain) {
        return
      }

      const { base, accesses } = chain
      const optionalExpr = buildOptionalChain(base, accesses)

      j(path).replaceWith(optionalExpr)
      modified = true
    })

  return modified
}

/**
 * Transform indexOf() existence checks to includes() method.
 * Converts patterns like arr.indexOf(item) !== -1 to arr.includes(item).
 * Also handles negative checks: arr.indexOf(item) === -1 to !arr.includes(item).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes
 */
export function indexOfToIncludes(root) {
  let modified = false

  root
    .find(j.BinaryExpression)
    .filter((path) => {
      const node = path.node

      // Check for comparison operators: !==, ===, >, >=, <, <=
      if (!["!==", "===", ">", ">=", "<", "<="].includes(node.operator)) {
        return false
      }

      // Check if one side is a .indexOf() call and the other is -1 or 0
      const indexOfInfo = new NodeTest(node).getIndexOfInfo()
      if (!indexOfInfo) {
        return false
      }

      const { indexOfCall, comparisonValue, isLeftIndexOf } = indexOfInfo

      // Only transform if indexOf has exactly 1 argument (the search value)
      // indexOf with fromIndex (2nd argument) has different semantics
      if (!indexOfCall || indexOfCall.arguments.length !== 1) {
        return false
      }

      // Only transform if we can verify the object type is an array or string
      // This ensures both indexOf and includes are available
      const objectNode = indexOfCall.callee.object
      if (!new NodeTest(objectNode).hasIndexOfAndIncludes()) {
        return false
      }

      // Comparison value must be -1 or 0
      const value = new NodeTest(comparisonValue).getNumericValue()
      if (value !== -1 && value !== 0) {
        return false
      }

      // Validate operator with value combinations
      const operator = node.operator
      // For -1 comparisons:
      // - indexOf() !== -1 → includes()
      // - indexOf() === -1 → !includes()
      // - indexOf() > -1 → includes()
      // - indexOf() <= -1 → !includes()
      // For 0 comparisons:
      // - indexOf() >= 0 → includes()
      // - indexOf() < 0 → !includes()

      if (value === -1) {
        if (isLeftIndexOf) {
          // indexOf() !== -1
          if (!["!==", "===", ">", "<="].includes(operator)) {
            return false
          }
        } else {
          // -1 === indexOf()
          if (!["!==", "===", "<", ">="].includes(operator)) {
            return false
          }
        }
      } else if (value === 0) {
        if (isLeftIndexOf) {
          // indexOf() >= 0
          if (![">=", "<"].includes(operator)) {
            return false
          }
        } else {
          // 0 < indexOf()
          if (!["<=", ">"].includes(operator)) {
            return false
          }
        }
      }

      return true
    })
    .forEach((path) => {
      const node = path.node

      // Get indexOf call info using helper
      const indexOfInfo = new NodeTest(node).getIndexOfInfo()
      const { indexOfCall, comparisonValue, isLeftIndexOf } = indexOfInfo

      const operator = node.operator
      const value = new NodeTest(comparisonValue).getNumericValue()

      // Determine if this should be negated
      let shouldNegate = false

      if (value === -1) {
        if (isLeftIndexOf) {
          // indexOf() !== -1
          // Negate for: ===, <=
          shouldNegate = operator === "===" || operator === "<="
        } else {
          // -1 === indexOf()
          // Negate for: ===, >=
          shouldNegate = operator === "===" || operator === ">="
        }
      } else if (value === 0) {
        if (isLeftIndexOf) {
          // indexOf() >= 0
          // Negate for: <
          shouldNegate = operator === "<"
        } else {
          // 0 < indexOf()
          // Negate for: >
          shouldNegate = operator === ">"
        }
      }

      // Create includes() call
      const includesCall = j.callExpression(
        j.memberExpression(indexOfCall.callee.object, j.identifier("includes"), false),
        indexOfCall.arguments,
      )

      // Wrap in negation if needed
      const replacement = shouldNegate
        ? j.unaryExpression("!", includesCall)
        : includesCall

      j(path).replaceWith(replacement)

      modified = true
    })

  return modified
}

/**
 * Transform String.substr() to String.slice().
 * Converts the deprecated substr method to the modern slice method.
 * - str.substr(start, length) → str.slice(start, start + length)
 * - str.substr(start) → str.slice(start)
 * - str.substr() → str.slice()
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/slice
 */
export function substrToSlice(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      // Check if this is a .substr() call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "substr"
      ) {
        return false
      }

      // Only transform if we can verify the object is a string or returns a string
      return new NodeTest(node.callee.object).hasIndexOfAndIncludes()
    })
    .forEach((path) => {
      const node = path.node
      const object = node.callee.object
      const args = node.arguments

      let newArgs

      if (args.length === 0) {
        // substr() → slice()
        newArgs = []
      } else if (args.length === 1) {
        // substr(start) → slice(start)
        newArgs = [args[0]]
      } else {
        // substr(start, length) → slice(start, start + length)
        // This transformation works correctly even for negative start values:
        // - 'hello'.substr(-3, 2) returns 'll' (2 chars from position 5-3=2)
        // - 'hello'.slice(-3, -3 + 2) = slice(-3, -1) returns 'll' (same result)
        const start = args[0]
        const length = args[1]

        // Create start + length expression
        const endExpr = j.binaryExpression("+", start, length)

        newArgs = [start, endExpr]
      }

      // Create slice() call
      const sliceCall = j.callExpression(
        j.memberExpression(object, j.identifier("slice"), false),
        newArgs,
      )

      j(path).replaceWith(sliceCall)

      modified = true
    })

  return modified
}

/**
 * Transform Object.keys().forEach() to Object.entries().
 * Converts patterns where Object.keys() is used to iterate and access values from the same object
 * to use Object.entries() with destructuring.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
 */
export function objectKeysForEachToEntries(root) {
  let modified = false

  root
    .find(j.CallExpression)
    .filter((path) => {
      const node = path.node

      // Check if this is a forEach call
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "forEach"
      ) {
        return false
      }

      // Check if the object is Object.keys()
      const object = node.callee.object
      if (
        !j.CallExpression.check(object) ||
        !j.MemberExpression.check(object.callee) ||
        !j.Identifier.check(object.callee.object) ||
        object.callee.object.name !== "Object" ||
        !j.Identifier.check(object.callee.property) ||
        object.callee.property.name !== "keys"
      ) {
        return false
      }

      // Object.keys() must have exactly one argument (the object)
      if (object.arguments.length !== 1) {
        return false
      }

      // Check that forEach has a callback argument
      if (node.arguments.length === 0) {
        return false
      }

      const callback = node.arguments[0]
      // Only transform if callback is an inline function (arrow or function expression)
      if (
        !j.ArrowFunctionExpression.check(callback) &&
        !j.FunctionExpression.check(callback)
      ) {
        return false
      }

      // Only transform if callback uses only the first parameter (key)
      // Don't transform if it uses index or array parameters
      const params = callback.params
      if (params.length !== 1) {
        return false
      }

      // The callback must have at least one parameter (the key)
      if (!j.Identifier.check(params[0])) {
        return false
      }

      return true
    })
    .forEach((path) => {
      const node = path.node
      const objectKeysCall = node.callee.object
      const targetObject = objectKeysCall.arguments[0]
      const callback = node.arguments[0]
      const keyParam = callback.params[0]
      const keyName = keyParam.name

      // Check if the callback body has a pattern like:
      // const value = obj[key];
      // We need to find this pattern and convert to destructuring
      let valueVariable = null
      let bodyStatements = []

      if (j.BlockStatement.check(callback.body)) {
        bodyStatements = callback.body.body
      } else {
        // Expression body - don't transform
        return
      }

      // Look for first statement that assigns targetObject[keyName] to a variable
      if (bodyStatements.length > 0) {
        const firstStmt = bodyStatements[0]
        if (j.VariableDeclaration.check(firstStmt)) {
          if (firstStmt.declarations.length === 1) {
            const varDeclarator = firstStmt.declarations[0]
            if (j.Identifier.check(varDeclarator.id)) {
              // Check if init is targetObject[keyName]
              if (
                j.MemberExpression.check(varDeclarator.init) &&
                varDeclarator.init.computed === true &&
                j.Identifier.check(varDeclarator.init.property) &&
                varDeclarator.init.property.name === keyName &&
                new NodeTest(varDeclarator.init.object).isEqual(targetObject)
              ) {
                valueVariable = {
                  name: varDeclarator.id.name,
                }
              }
            }
          }
        }
      }

      // Only transform if we found the value variable pattern
      if (!valueVariable) {
        return
      }

      // Create new callback with destructuring parameter
      const newParam = j.arrayPattern([
        j.identifier(keyName),
        j.identifier(valueVariable.name),
      ])

      // Create new body without the first declaration
      const newBody = j.blockStatement(bodyStatements.slice(1))

      // Create new callback function with destructuring
      const newCallback = j.ArrowFunctionExpression.check(callback)
        ? j.arrowFunctionExpression([newParam], newBody, false)
        : j.functionExpression(null, [newParam], newBody, false, false)

      // Preserve async property
      if (callback.async) {
        newCallback.async = true
      }

      // Create Object.entries() call
      const objectEntriesCall = j.callExpression(
        j.memberExpression(j.identifier("Object"), j.identifier("entries"), false),
        [targetObject],
      )

      // Create new forEach call
      const newForEachCall = j.callExpression(
        j.memberExpression(objectEntriesCall, j.identifier("forEach"), false),
        [newCallback],
      )

      j(path).replaceWith(newForEachCall)

      modified = true
    })

  return modified
}

/**
 * Transform indexOf() prefix checks to startsWith().
 * Converts patterns like str.indexOf(prefix) === 0 to str.startsWith(prefix).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
 */
export function indexOfToStartsWith(root) {
  let modified = false

  root
    .find(j.BinaryExpression)
    .filter((path) => {
      const node = path.node

      // Check for === or !== operators
      if (!["===", "!=="].includes(node.operator)) {
        return false
      }

      // Check if one side is a .indexOf() call and the other is 0
      const indexOfInfo = new NodeTest(node).getIndexOfInfo()
      if (!indexOfInfo) {
        return false
      }

      const { indexOfCall, comparisonValue } = indexOfInfo

      // Only transform if indexOf has exactly 1 argument (the search value)
      if (!indexOfCall || indexOfCall.arguments.length !== 1) {
        return false
      }

      // Only transform if we can verify the object is a string
      const objectNode = indexOfCall.callee.object
      if (!new NodeTest(objectNode).hasIndexOfAndIncludes()) {
        return false
      }

      // Comparison value must be 0
      const value = new NodeTest(comparisonValue).getNumericValue()
      return value === 0
    })
    .forEach((path) => {
      const node = path.node
      const indexOfInfo = new NodeTest(node).getIndexOfInfo()
      const { indexOfCall } = indexOfInfo

      // Create startsWith() call
      const startsWithCall = j.callExpression(
        j.memberExpression(
          indexOfCall.callee.object,
          j.identifier("startsWith"),
          false,
        ),
        indexOfCall.arguments,
      )

      // Wrap in negation if operator is !==
      const replacement =
        node.operator === "!=="
          ? j.unaryExpression("!", startsWithCall)
          : startsWithCall

      j(path).replaceWith(replacement)

      modified = true
    })

  return modified
}

/**
 * Transform substring() prefix checks to startsWith().
 * Converts patterns like str.substring(0, prefix.length) === prefix to
 * str.startsWith(prefix).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
 */
export function substringToStartsWith(root) {
  let modified = false

  root
    .find(j.BinaryExpression)
    .filter((path) => {
      const node = path.node

      // Check for === or !== operators
      if (!["===", "!=="].includes(node.operator)) {
        return false
      }

      // Check if one side is substring() and the other is an identifier/expression
      let substringCall = null
      let comparisonValue = null

      // Check left side for substring
      if (
        j.CallExpression.check(node.left) &&
        j.MemberExpression.check(node.left.callee) &&
        j.Identifier.check(node.left.callee.property) &&
        node.left.callee.property.name === "substring"
      ) {
        substringCall = node.left
        comparisonValue = node.right
      }
      // Check right side for substring
      else if (
        j.CallExpression.check(node.right) &&
        j.MemberExpression.check(node.right.callee) &&
        j.Identifier.check(node.right.callee.property) &&
        node.right.callee.property.name === "substring"
      ) {
        substringCall = node.right
        comparisonValue = node.left
      }

      if (!substringCall) {
        return false
      }

      // Must have exactly 2 arguments
      if (substringCall.arguments.length !== 2) {
        return false
      }

      // First argument must be 0
      const firstArg = substringCall.arguments[0]
      if (new NodeTest(firstArg).getNumericValue() !== 0) {
        return false
      }

      // Second argument must be comparisonValue.length
      const secondArg = substringCall.arguments[1]
      if (
        !j.MemberExpression.check(secondArg) ||
        !j.Identifier.check(secondArg.property) ||
        secondArg.property.name !== "length"
      ) {
        return false
      }

      // The object of the length property must match the comparison value
      if (!new NodeTest(secondArg.object).isEqual(comparisonValue)) {
        return false
      }

      // Only transform if we can verify the substring object is a string
      return new NodeTest(substringCall.callee.object).hasIndexOfAndIncludes()
    })
    .forEach((path) => {
      const node = path.node

      // Determine which side is substring (guaranteed by filter to exist)
      let substringCall, comparisonValue
      if (
        j.CallExpression.check(node.left) &&
        j.MemberExpression.check(node.left.callee) &&
        j.Identifier.check(node.left.callee.property) &&
        node.left.callee.property.name === "substring"
      ) {
        substringCall = node.left
        comparisonValue = node.right
      } else {
        substringCall = node.right
        comparisonValue = node.left
      }

      // Create startsWith() call
      const startsWithCall = j.callExpression(
        j.memberExpression(
          substringCall.callee.object,
          j.identifier("startsWith"),
          false,
        ),
        [comparisonValue],
      )

      // Wrap in negation if operator is !==
      const replacement =
        node.operator === "!=="
          ? j.unaryExpression("!", startsWithCall)
          : startsWithCall

      j(path).replaceWith(replacement)

      modified = true
    })

  return modified
}

/**
 * Transform lastIndexOf() suffix checks to endsWith().
 * Converts patterns like str.lastIndexOf(suffix) === str.length - suffix.length to
 * str.endsWith(suffix).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
 */
export function lastIndexOfToEndsWith(root) {
  let modified = false

  root
    .find(j.BinaryExpression)
    .filter((path) => {
      const node = path.node

      // Check for === or !== operators
      if (!["===", "!=="].includes(node.operator)) {
        return false
      }

      // Check if one side is lastIndexOf() and the other is a subtraction
      let lastIndexOfCall = null
      let comparisonValue = null

      // Check left side for lastIndexOf
      if (
        j.CallExpression.check(node.left) &&
        j.MemberExpression.check(node.left.callee) &&
        j.Identifier.check(node.left.callee.property) &&
        node.left.callee.property.name === "lastIndexOf"
      ) {
        lastIndexOfCall = node.left
        comparisonValue = node.right
      }
      // Check right side for lastIndexOf
      else if (
        j.CallExpression.check(node.right) &&
        j.MemberExpression.check(node.right.callee) &&
        j.Identifier.check(node.right.callee.property) &&
        node.right.callee.property.name === "lastIndexOf"
      ) {
        lastIndexOfCall = node.right
        comparisonValue = node.left
      }

      if (!lastIndexOfCall) {
        return false
      }

      // Only transform if lastIndexOf has exactly 1 argument (the search value)
      if (lastIndexOfCall.arguments.length !== 1) {
        return false
      }

      const searchValue = lastIndexOfCall.arguments[0]

      // Comparison value must be a binary expression: str.length - suffix.length
      if (!j.BinaryExpression.check(comparisonValue)) {
        return false
      }

      if (comparisonValue.operator !== "-") {
        return false
      }

      // Left side of subtraction must be str.length
      if (
        !j.MemberExpression.check(comparisonValue.left) ||
        !j.Identifier.check(comparisonValue.left.property) ||
        comparisonValue.left.property.name !== "length"
      ) {
        return false
      }

      // The object of str.length must match the lastIndexOf object
      if (
        !new NodeTest(comparisonValue.left.object).isEqual(
          lastIndexOfCall.callee.object,
        )
      ) {
        return false
      }

      // Right side of subtraction must be suffix.length
      if (
        !j.MemberExpression.check(comparisonValue.right) ||
        !j.Identifier.check(comparisonValue.right.property) ||
        comparisonValue.right.property.name !== "length"
      ) {
        return false
      }

      // The object of suffix.length must match the search value
      if (!new NodeTest(comparisonValue.right.object).isEqual(searchValue)) {
        return false
      }

      // Only transform if we can verify the object is a string
      return new NodeTest(lastIndexOfCall.callee.object).hasIndexOfAndIncludes()
    })
    .forEach((path) => {
      const node = path.node

      // Determine which side is lastIndexOf (guaranteed by filter to exist)
      let lastIndexOfCall
      if (
        j.CallExpression.check(node.left) &&
        j.MemberExpression.check(node.left.callee) &&
        j.Identifier.check(node.left.callee.property) &&
        node.left.callee.property.name === "lastIndexOf"
      ) {
        lastIndexOfCall = node.left
      } else {
        lastIndexOfCall = node.right
      }

      // Create endsWith() call
      const endsWithCall = j.callExpression(
        j.memberExpression(
          lastIndexOfCall.callee.object,
          j.identifier("endsWith"),
          false,
        ),
        lastIndexOfCall.arguments,
      )

      // Wrap in negation if operator is !==
      const replacement =
        node.operator === "!==" ? j.unaryExpression("!", endsWithCall) : endsWithCall

      j(path).replaceWith(replacement)

      modified = true
    })

  return modified
}

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
