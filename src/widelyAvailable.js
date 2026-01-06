import { default as j } from "jscodeshift"
import {
  NodeTest,
  processMultipleDeclarators,
  processSingleDeclarator,
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
    .filter((path) => {
      // Only transform if at least one operand is a string literal
      const hasStringLiteral = (node) => {
        if (
          j.StringLiteral.check(node) ||
          (j.Literal.check(node) && typeof node.value === "string")
        ) {
          return true
        }
        if (j.BinaryExpression.check(node) && node.operator === "+") {
          return hasStringLiteral(node.left) || hasStringLiteral(node.right)
        }
        return false
      }
      return hasStringLiteral(path.node)
    })
    .forEach((path) => {
      const parts = []
      const expressions = []

      // Helper to check if a node is a string literal
      const isStringLiteral = (node) => {
        return (
          j.StringLiteral.check(node) ||
          (j.Literal.check(node) && typeof node.value === "string")
        )
      }

      // Helper to check if a node contains any string literal
      const containsStringLiteral = (node) => {
        if (isStringLiteral(node)) return true
        if (j.BinaryExpression.check(node) && node.operator === "+") {
          return containsStringLiteral(node.left) || containsStringLiteral(node.right)
        }
        return false
      }

      // Helper to get the raw value of a string literal (preserving escape sequences)
      const getRawStringValue = (node) => {
        // In string literals, backslashes are used for escape sequences
        // In template literals, backslashes in the raw value also need escaping
        // So we need to double the backslashes: \\ -> \\\\
        // Template literals also have special characters that need escaping:
        // - Backtick ` needs to be escaped as \`
        // - Dollar-brace ${ needs to be escaped as \${ to prevent template expression evaluation
        // Note: node.extra.rawValue is always defined for string literals with the current parser
        return node.extra.rawValue
          .replace(/\\/g, "\\\\")
          .replace(/`/g, "\\`")
          .replace(/\$\{/g, "\\${")
      }

      const addStringPart = (stringNode) => {
        // Store both the raw and cooked values
        const rawValue = getRawStringValue(stringNode)
        const cookedValue = stringNode.value

        if (parts.length === 0 || expressions.length >= parts.length) {
          parts.push({ raw: rawValue, cooked: cookedValue })
        } else {
          const lastPart = parts[parts.length - 1]
          lastPart.raw += rawValue
          lastPart.cooked += cookedValue
        }
      }

      const addExpression = (expr) => {
        if (parts.length === 0) {
          parts.push({ raw: "", cooked: "" })
        }
        expressions.push(expr)
      }

      const flatten = (node, stringContext = false) => {
        // Note: node is always a BinaryExpression when called, as non-BinaryExpression
        // nodes are handled inline before recursing into flatten
        if (j.BinaryExpression.check(node) && node.operator === "+") {
          // Check if this entire binary expression contains any string literal
          const hasString = containsStringLiteral(node)

          if (!hasString && !stringContext) {
            // This is pure numeric addition (no strings anywhere), keep as expression
            addExpression(node)
          } else {
            // This binary expression is part of string concatenation
            // Check each operand
            const leftHasString = containsStringLiteral(node.left)

            // Process left side
            if (j.BinaryExpression.check(node.left) && node.left.operator === "+") {
              // Left is also a + expression - recurse
              flatten(node.left, stringContext)
            } else if (isStringLiteral(node.left)) {
              // Left is a string literal - use raw value to preserve escape sequences
              addStringPart(node.left)
            } else {
              // Left is some other expression
              addExpression(node.left)
            }

            // Process right side - it's in string context if left had a string
            const rightInStringContext = stringContext || leftHasString
            if (j.BinaryExpression.check(node.right) && node.right.operator === "+") {
              // If right is a + expression with no strings and we're in string context, keep it as a unit
              if (!containsStringLiteral(node.right) && rightInStringContext) {
                addExpression(node.right)
              } else {
                // Right has strings or we need to flatten it
                flatten(node.right, rightInStringContext)
              }
            } else if (isStringLiteral(node.right)) {
              // Right is a string literal - use raw value to preserve escape sequences
              addStringPart(node.right)
            } else {
              // Right is some other expression
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
      if (
        !j.CallExpression.check(object) ||
        !j.MemberExpression.check(object.callee) ||
        !j.Identifier.check(object.callee.object) ||
        object.callee.object.name !== "Array" ||
        !j.Identifier.check(object.callee.property) ||
        object.callee.property.name !== "from"
      ) {
        return false
      }

      return true
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
      if (
        !j.MemberExpression.check(node.callee) ||
        !j.Identifier.check(node.callee.object) ||
        node.callee.object.name !== "Array" ||
        !j.Identifier.check(node.callee.property) ||
        node.callee.property.name !== "from"
      ) {
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
      let indexVarUsed = false

      // Recursively check if identifier is used in AST nodes
      const checkNode = (astNode) => {
        if (!astNode || typeof astNode !== "object") return

        if (astNode.type === "Identifier" && astNode.name === indexVar) {
          indexVarUsed = true
          return
        }

        // Traverse all properties
        for (const key in astNode) {
          if (
            key === "loc" ||
            key === "start" ||
            key === "end" ||
            key === "tokens" ||
            key === "comments"
          )
            continue
          const value = astNode[key]
          if (Array.isArray(value)) {
            value.forEach(checkNode)
          } else if (value && typeof value === "object") {
            checkNode(value)
          }
        }
      }

      bodyWithoutFirst.forEach(checkNode)

      if (indexVarUsed) {
        return false
      }

      return true
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
        }
        // Handle cases like document.getElementById('x').querySelectorAll()
        // Only allow these from document-originating chains
        else if (
          j.MemberExpression.check(callerObject) ||
          j.CallExpression.check(callerObject)
        ) {
          // Check if this eventually chains from document
          const isFromDocument = (node) => {
            if (j.Identifier.check(node)) {
              return node.name === "document"
            }
            if (j.MemberExpression.check(node)) {
              return isFromDocument(node.object)
            }
            if (j.CallExpression.check(node)) {
              if (j.MemberExpression.check(node.callee)) {
                return isFromDocument(node.callee.object)
              }
            }
            return false
          }

          if (!isFromDocument(callerObject)) {
            return false
          }

          // Verify the method is valid for document
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

  // Helper to check if a node or its descendants use 'this'
  const usesThis = (node) => {
    let found = false

    const checkNode = (astNode) => {
      if (!astNode || typeof astNode !== "object" || found) return

      // Found 'this' identifier
      if (astNode.type === "ThisExpression") {
        found = true
        return
      }

      // Don't traverse into nested function declarations or expressions
      // as they have their own 'this' context
      if (
        astNode.type === "FunctionDeclaration" ||
        astNode.type === "FunctionExpression" ||
        astNode.type === "ArrowFunctionExpression"
      ) {
        return
      }

      // Traverse all properties
      for (const key in astNode) {
        if (
          key === "loc" ||
          key === "start" ||
          key === "end" ||
          key === "tokens" ||
          key === "comments"
        )
          continue
        const value = astNode[key]
        if (Array.isArray(value)) {
          value.forEach(checkNode)
        } else if (value && typeof value === "object") {
          checkNode(value)
        }
      }
    }

    checkNode(node)
    return found
  }

  // Helper to check if a node or its descendants use 'arguments'
  const usesArguments = (node) => {
    let found = false

    const visit = (n) => {
      if (!n || typeof n !== "object" || found) return

      // If we encounter a nested function, don't traverse into it
      // as it has its own 'arguments' binding
      if (n.type === "FunctionExpression" || n.type === "FunctionDeclaration") {
        return
      }

      // Check if this is an 'arguments' identifier
      if (n.type === "Identifier" && n.name === "arguments") {
        found = true
        return
      }

      // Traverse all child nodes
      for (const key in n) {
        if (
          key === "loc" ||
          key === "start" ||
          key === "end" ||
          key === "tokens" ||
          key === "comments" ||
          key === "type"
        ) {
          continue
        }
        const value = n[key]
        if (Array.isArray(value)) {
          for (const item of value) {
            visit(item)
            if (found) return
          }
        } else if (value && typeof value === "object") {
          visit(value)
        }
      }
    }

    // Start visiting from the function body's child nodes
    // Don't check the body node itself, check its contents
    // Note: FunctionExpression.body is always a BlockStatement
    if (node.type === "BlockStatement" && node.body) {
      for (const statement of node.body) {
        visit(statement)
        if (found) break
      }
    }

    return found
  }

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
      if (usesThis(node.body)) {
        return false
      }

      // Skip if it uses 'arguments'
      const hasArguments = usesArguments(node.body)
      if (hasArguments) {
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
 *
 * Only transforms when safe (function doesn't use outer 'this' or 'arguments'). Note:
 * Arrow functions never have their own 'this' or 'arguments', so this transformation
 * is generally safe for arrow functions, but we check to ensure they don't use 'this'
 * at all to avoid potential issues.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions
 */
export function namedArrowFunctionToNamedFunction(root) {
  let modified = false

  /**
   * Check if a node or its descendants use 'this'.
   *
   * @param {import("ast-types").ASTNode} node - The node to check
   * @returns {boolean} True if 'this' is used
   */
  const usesThis = (node) => {
    let found = false

    const checkNode = (astNode) => {
      if (!astNode || typeof astNode !== "object" || found) return

      // Found 'this' identifier
      if (astNode.type === "ThisExpression") {
        found = true
        return
      }

      // Don't traverse into nested function declarations or expressions
      // as they have their own 'this' context
      if (
        astNode.type === "FunctionDeclaration" ||
        astNode.type === "FunctionExpression" ||
        astNode.type === "ArrowFunctionExpression"
      ) {
        return
      }

      // Traverse all properties
      for (const key in astNode) {
        if (
          key === "loc" ||
          key === "start" ||
          key === "end" ||
          key === "tokens" ||
          key === "comments"
        )
          continue
        const value = astNode[key]
        if (Array.isArray(value)) {
          value.forEach(checkNode)
        } else if (value && typeof value === "object") {
          checkNode(value)
        }
      }
    }

    checkNode(node)
    return found
  }

  /**
   * Check if a node or its descendants use 'arguments'.
   *
   * @param {import("ast-types").ASTNode} node - The node to check
   * @returns {boolean} True if 'arguments' is used
   */
  const usesArguments = (node) => {
    let found = false

    const visit = (n) => {
      if (!n || typeof n !== "object" || found) return

      // If we encounter a nested function, don't traverse into it
      // as it has its own 'arguments' binding
      if (n.type === "FunctionExpression" || n.type === "FunctionDeclaration") {
        return
      }

      // Check if this is an 'arguments' identifier
      if (n.type === "Identifier" && n.name === "arguments") {
        found = true
        return
      }

      // Traverse all child nodes
      for (const key in n) {
        if (
          key === "loc" ||
          key === "start" ||
          key === "end" ||
          key === "tokens" ||
          key === "comments" ||
          key === "type"
        ) {
          continue
        }
        const value = n[key]
        if (Array.isArray(value)) {
          for (const item of value) {
            visit(item)
            if (found) return
          }
        } else if (value && typeof value === "object") {
          visit(value)
        }
      }
    }

    // Start visiting from the function body's child nodes
    if (node.type === "BlockStatement" && node.body) {
      for (const statement of node.body) {
        visit(statement)
        if (found) break
      }
    }

    return found
  }

  root
    .find(j.VariableDeclaration)
    .filter((path) => {
      const node = path.node

      // Transform const, let, and var declarations
      if (node.kind !== "const" && node.kind !== "let" && node.kind !== "var") {
        return false
      }

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

      // Skip if it's a generator function
      if (func.generator) {
        return false
      }

      // Skip if the function uses 'this'
      if (usesThis(func.body)) {
        return false
      }

      // Skip if the function uses 'arguments' (only relevant for function expressions)
      if (isFunctionExpression && usesArguments(func.body)) {
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
  /**
   * Check if a function name follows constructor naming convention.
   *
   * @param {string} name - The function name to check.
   * @returns {boolean} True if the name starts with an uppercase letter.
   */
  function isConstructorName(name) {
    return name && /^[A-Z]/.test(name)
  }

  /**
   * Check if a function body contains only simple constructor statements.
   *
   * @param {import("jscodeshift").BlockStatement} functionBody - The function body to
   *   check.
   * @returns {boolean} True if the body contains only allowed statements.
   */
  function hasSimpleConstructorBody(functionBody) {
    if (functionBody.body.length === 0) {
      return true
    }

    return functionBody.body.every((statement) => {
      if (j.VariableDeclaration.check(statement)) {
        return true
      }

      if (j.ExpressionStatement.check(statement)) {
        return true
      }

      return false
    })
  }

  /**
   * Find all constructor functions in the AST.
   *
   * @param {import("jscodeshift").Collection} root - The root AST collection.
   * @returns {Map<
   *   string,
   *   { declaration: import("ast-types").NodePath; prototypeMethods: any[] }
   * >}
   *   Map of constructor names to their info.
   */
  function findConstructors(root) {
    const constructors = new Map()

    // Handle function declarations
    root.find(j.FunctionDeclaration).forEach((path) => {
      const node = path.node
      const functionName = node.id ? node.id.name : null

      if (!functionName || !isConstructorName(functionName)) {
        return
      }

      if (!hasSimpleConstructorBody(node.body)) {
        return
      }

      constructors.set(functionName, {
        declaration: path,
        prototypeMethods: [],
      })
    })

    // Handle variable declarations with function expressions
    root.find(j.VariableDeclaration).forEach((path) => {
      path.node.declarations.forEach((declarator) => {
        const functionName = declarator.id.name

        if (!isConstructorName(functionName)) {
          return
        }

        if (!j.FunctionExpression.check(declarator.init)) {
          return
        }

        const functionExpr = declarator.init

        if (!hasSimpleConstructorBody(functionExpr.body)) {
          return
        }

        constructors.set(functionName, {
          declaration: path,
          prototypeMethods: [],
        })
      })
    })

    return constructors
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

        if (!j.FunctionExpression.check(methodValue)) {
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

          if (!j.FunctionExpression.check(prop.value)) {
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

      const classBody = []

      const constructorMethod = j.methodDefinition(
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
      )
      classBody.push(constructorMethod)

      info.prototypeMethods.forEach(({ methodName, methodValue }) => {
        const method = j.methodDefinition(
          "method",
          j.identifier(methodName),
          j.functionExpression(
            null,
            methodValue.params,
            methodValue.body,
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

  /**
   * Check if an identifier is shadowed by a local declaration or parameter.
   *
   * @param {import("ast-types").NodePath} path - Path to the identifier
   * @param {string} name - Name to check for shadowing
   * @returns {boolean} True if the identifier is shadowed
   */
  const isShadowed = (path, name) => {
    let scope = path.scope

    while (scope) {
      // Check if this scope has a binding for the name
      const bindings = scope.getBindings()
      if (bindings[name]) {
        // Found a binding - this shadows the global
        return true
      }

      // Move to parent scope
      scope = scope.parent
    }

    return false
  }

  // Transform Function("return this")() pattern to globalThis
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

  /**
   * Determine if a binary expression is a null check (=== null or !== null).
   *
   * @param {import("jscodeshift").BinaryExpression} node - The binary expression
   * @returns {{ value: import("ast-types").ASTNode; isNegated: boolean } | null}
   */
  const getNullCheck = (node) => {
    if (!j.BinaryExpression.check(node)) {
      return null
    }

    // Check for !== null or === null
    if (node.operator === "!==" || node.operator === "===") {
      const isNegated = node.operator === "!=="

      // value !== null or value === null
      if (
        j.NullLiteral.check(node.right) ||
        (j.Literal.check(node.right) && node.right.value === null)
      ) {
        return { value: node.left, isNegated }
      }

      // null !== value or null === value
      if (
        j.NullLiteral.check(node.left) ||
        (j.Literal.check(node.left) && node.left.value === null)
      ) {
        return { value: node.right, isNegated }
      }
    }

    return null
  }

  /**
   * Determine if a binary expression is an undefined check (=== undefined or !==
   * undefined).
   *
   * @param {import("jscodeshift").BinaryExpression} node - The binary expression
   * @returns {{ value: import("ast-types").ASTNode; isNegated: boolean } | null}
   */
  const getUndefinedCheck = (node) => {
    if (!j.BinaryExpression.check(node)) {
      return null
    }

    // Check for !== undefined or === undefined
    if (node.operator === "!==" || node.operator === "===") {
      const isNegated = node.operator === "!=="

      // value !== undefined or value === undefined
      if (j.Identifier.check(node.right) && node.right.name === "undefined") {
        return { value: node.left, isNegated }
      }

      // undefined !== value or undefined === value
      if (j.Identifier.check(node.left) && node.left.name === "undefined") {
        return { value: node.right, isNegated }
      }
    }

    return null
  }

  /**
   * Validate that both checks are negated, operate on the same value, and match the
   * consequent.
   *
   * @param {{ value: import("ast-types").ASTNode; isNegated: boolean }} nullCheck - The
   *   null check result
   * @param {{ value: import("ast-types").ASTNode; isNegated: boolean }} undefinedCheck
   *   - The undefined check result
   *
   * @param {import("ast-types").ASTNode} consequent - The consequent node to validate
   *   against
   * @returns {boolean} True if validation passes
   */
  const validateChecks = (nullCheck, undefinedCheck, consequent) => {
    // Both checks must be negated (!==)
    if (!nullCheck.isNegated || !undefinedCheck.isNegated) {
      return false
    }

    // Both checks must be on the same value
    if (!new NodeTest(nullCheck.value).isEqual(undefinedCheck.value)) {
      return false
    }

    // Consequent must be the same value
    return new NodeTest(nullCheck.value).isEqual(consequent)
  }

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
      const nullCheck = getNullCheck(left)
      const undefinedCheck = getUndefinedCheck(right)

      if (!nullCheck || !undefinedCheck) {
        // Try swapped order
        const nullCheckSwapped = getNullCheck(right)
        const undefinedCheckSwapped = getUndefinedCheck(left)

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
      const nullCheck = getNullCheck(left)
      const undefinedCheck = getUndefinedCheck(right)

      if (nullCheck && undefinedCheck) {
        // Normal order: null check on left, undefined check on right
        valueNode = nullCheck.value
      } else {
        // Swapped order: undefined check on left, null check on right
        // The filter guarantees both checks exist in this case
        const nullCheckSwapped = getNullCheck(right)
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

  /**
   * Check if a node is a property access or call on a base.
   *
   * @param {import("ast-types").ASTNode} node - The node to check
   * @param {import("ast-types").ASTNode} base - The expected base
   * @returns {boolean} True if node accesses base
   */
  const isAccessOnBase = (node, base) => {
    if (j.MemberExpression.check(node)) {
      return new NodeTest(node.object).isEqual(base)
    }
    if (j.CallExpression.check(node)) {
      return new NodeTest(node.callee).isEqual(base)
    }
    return false
  }

  /**
   * Build an optional chaining expression from a base and accesses.
   *
   * @param {import("ast-types").ASTNode} base - The base expression
   * @param {import("ast-types").ASTNode[]} accesses - The property/method accesses
   * @returns {import("ast-types").ASTNode} The optional chaining expression
   */
  const buildOptionalChain = (base, accesses) => {
    let result = base

    for (const access of accesses) {
      if (j.MemberExpression.check(access)) {
        result = j.optionalMemberExpression(
          result,
          access.property,
          access.computed,
          true, // optional = true
        )
      } else if (j.CallExpression.check(access)) {
        result = j.optionalCallExpression(result, access.arguments, true)
      }
    }

    return result
  }

  /**
   * Process a logical expression chain to extract optional chaining candidates.
   *
   * @param {import("ast-types").ASTNode} node - The logical expression (must be &&
   *   operator)
   * @returns {{
   *   base: import("ast-types").ASTNode
   *   accesses: import("ast-types").ASTNode[]
   * } | null}
   */
  const extractChain = (node) => {
    const parts = []
    let current = node

    // Flatten the && chain
    while (j.LogicalExpression.check(current) && current.operator === "&&") {
      parts.unshift(current.right)
      current = current.left
    }
    parts.unshift(current)

    // The base should be the first part
    const base = parts[0]

    // Check if all subsequent parts are accesses on the previous part
    const accesses = []
    for (let i = 1; i < parts.length; i++) {
      const prev = i === 1 ? base : parts[i - 1]
      if (!isAccessOnBase(parts[i], prev)) {
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
