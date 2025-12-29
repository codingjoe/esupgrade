/**
 * Transform var to const or let
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let
 */
export function varToConst(j, root) {
  let modified = false
  const changes = []

  /**
   * Check if a variable is reassigned after its declaration
   */
  const isVariableReassigned = (varName) => {
    // Check for AssignmentExpression where left side is the variable
    const assignmentExists =
      root
        .find(j.AssignmentExpression)
        .filter(
          (path) =>
            j.Identifier.check(path.node.left) && path.node.left.name === varName,
        )
        .size() > 0

    if (assignmentExists) return true

    // Check for UpdateExpression (++, --)
    const updateExists =
      root
        .find(j.UpdateExpression)
        .filter(
          (path) =>
            j.Identifier.check(path.node.argument) &&
            path.node.argument.name === varName,
        )
        .size() > 0

    return updateExists
  }

  root.find(j.VariableDeclaration, { kind: "var" }).forEach((path) => {
    // If there's only one declarator, we can simply update the kind
    if (path.node.declarations.length === 1) {
      const declarator = path.node.declarations[0]
      if (j.Identifier.check(declarator.id)) {
        const hasReassignment = isVariableReassigned(declarator.id.name)
        path.node.kind = hasReassignment ? "let" : "const"
      } else {
        // Destructuring or other pattern, use const as default
        path.node.kind = "const"
      }
      modified = true
      if (path.node.loc) {
        changes.push({
          type: "varToLetOrConst",
          line: path.node.loc.start.line,
        })
      }
    } else {
      // Multiple declarators - split into separate declarations
      // Each gets its own const/let based on reassignment
      const declarations = path.node.declarations.map((declarator) => {
        let kind = "const"
        if (j.Identifier.check(declarator.id)) {
          kind = isVariableReassigned(declarator.id.name) ? "let" : "const"
        }
        return j.variableDeclaration(kind, [declarator])
      })

      // Replace the single declaration with multiple declarations
      j(path).replaceWith(declarations)

      modified = true
      if (path.node.loc) {
        changes.push({
          type: "varToLetOrConst",
          line: path.node.loc.start.line,
        })
      }
    }
  })

  return { modified, changes }
}

/**
 * Transform string concatenation to template literals
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
 */
export function concatToTemplateLiteral(j, root) {
  let modified = false
  const changes = []

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
        // Note: node.extra.rawValue is always defined for string literals with the current parser
        return node.extra.rawValue.replace(/\\/g, "\\\\")
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

  return { modified, changes }
}

/**
 * Transform Object.assign({}, ...) to object spread
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
 */
export function objectAssignToSpread(j, root) {
  let modified = false
  const changes = []

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

  return { modified, changes }
}

/**
 * Transform Array.from().forEach() to for...of
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
 */
export function arrayFromForEachToForOf(j, root) {
  let modified = false
  const changes = []

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
            if (node.loc) {
              changes.push({
                type: "arrayFromForEachToForOf",
                line: node.loc.start.line,
              })
            }
          }
        }
      }
    })

  return { modified, changes }
}

/**
 * Transform for...of Object.keys() loops to for...in
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in
 */
export function forOfKeysToForIn(j, root) {
  let modified = false
  const changes = []

  root
    .find(j.ForOfStatement)
    .filter((path) => {
      const node = path.node
      const right = node.right

      // Check if iterating over Object.keys() call
      if (
        j.CallExpression.check(right) &&
        j.MemberExpression.check(right.callee) &&
        j.Identifier.check(right.callee.object) &&
        right.callee.object.name === "Object" &&
        j.Identifier.check(right.callee.property) &&
        right.callee.property.name === "keys" &&
        right.arguments.length === 1
      ) {
        return true
      }

      return false
    })
    .forEach((path) => {
      const node = path.node
      const left = node.left
      const objectArg = node.right.arguments[0]
      const body = node.body

      // Create for...in loop
      const forInLoop = j.forInStatement(left, objectArg, body)

      j(path).replaceWith(forInLoop)

      modified = true
      if (node.loc) {
        changes.push({
          type: "forOfKeysToForIn",
          line: node.loc.start.line,
        })
      }
    })

  return { modified, changes }
}

/**
 * Transform Array.from(obj) to [...obj] spread syntax
 * This handles cases like Array.from(obj).map(), .filter(), .some(), etc.
 * that are not covered by the forEach transformer
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
 */
export function arrayFromToSpread(j, root) {
  let modified = false
  const changes = []

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
      if (node.loc) {
        changes.push({
          type: "arrayFromToSpread",
          line: node.loc.start.line,
        })
      }
    })

  return { modified, changes }
}

/**
 * Transform Math.pow() to exponentiation operator (**)
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Exponentiation
 */
export function mathPowToExponentiation(j, root) {
  let modified = false
  const changes = []

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
      if (node.loc) {
        changes.push({
          type: "mathPowToExponentiation",
          line: node.loc.start.line,
        })
      }
    })

  return { modified, changes }
}

/**
 * Transform traditional for loops to for...of where safe
 * Converts: for (let i = 0; i < arr.length; i++) { const item = arr[i]; ... }
 * To: for (const item of arr) { ... }
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
 */
export function forLoopToForOf(j, root) {
  let modified = false
  const changes = []

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
      if (node.loc) {
        changes.push({
          type: "forLoopToForOf",
          line: node.loc.start.line,
        })
      }
    })

  return { modified, changes }
}

/**
 * Transform iterables' forEach() to for...of loop
 * Handles DOM APIs like querySelectorAll, getElementsBy*, etc. and other known iterables
 * Only transforms when forEach callback is declared inline with a function body (block statement)
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
 */
export function iterableForEachToForOf(j, root) {
  let modified = false
  const changes = []

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
        if (node.loc) {
          changes.push({
            type: "iterableForEachToForOf",
            line: node.loc.start.line,
          })
        }
      }
    })

  return { modified, changes }
}

/**
 * Transform anonymous function expressions to arrow functions
 * Does not transform if the function:
 * - is a named function expression (useful for stack traces and recursion)
 * - uses 'this' (arrow functions don't have their own 'this')
 * - uses 'arguments' (arrow functions don't have 'arguments' object)
 * - uses 'super' (defensive check, though this would be a syntax error in function expressions)
 * - is a generator function (arrow functions cannot be generators)
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
 */
export function anonymousFunctionToArrow(j, root) {
  let modified = false
  const changes = []

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
      if (node.loc) {
        changes.push({
          type: "anonymousFunctionToArrow",
          line: node.loc.start.line,
        })
      }
    })

  return { modified, changes }
}

/**
 * Transform Array.concat() to array spread syntax
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
 */
export function arrayConcatToSpread(j, root) {
  let modified = false
  const changes = []

  // Helper to check if an expression is statically verifiable as an array
  const isVerifiableArray = (node) => {
    // Array literal: [1, 2, 3]
    if (j.ArrayExpression.check(node)) {
      return true
    }

    // Array.from(), Array.of(), etc.
    if (
      j.CallExpression.check(node) &&
      j.MemberExpression.check(node.callee) &&
      j.Identifier.check(node.callee.object) &&
      node.callee.object.name === "Array"
    ) {
      return true
    }

    // new Array()
    if (
      j.NewExpression.check(node) &&
      j.Identifier.check(node.callee) &&
      node.callee.name === "Array"
    ) {
      return true
    }

    const STRING_METHODS_RETURNING_ARRAY = [
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

    // .split() on strings returns arrays
    if (
      j.CallExpression.check(node) &&
      j.MemberExpression.check(node.callee) &&
      j.Identifier.check(node.callee.property) &&
      j.StringLiteral.check(node.callee.object) &&
      STRING_METHODS_RETURNING_ARRAY.includes(node.callee.property.name)
    ) {
      return true
    }

    return false
  }

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

      // Only transform if we can verify the object is an array
      const object = node.callee.object
      if (!isVerifiableArray(object)) {
        return false
      }

      return true
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
      if (node.loc) {
        changes.push({
          type: "arrayConcatToSpread",
          line: node.loc.start.line,
        })
      }
    })

  return { modified, changes }
}
