import jscodeshift from "jscodeshift"

/**
 * Baseline levels for ECMAScript features
 *
 * - widely-available: Features available across all modern browsers
 * - newly-available: Newly standardized features (e.g., Promise.try)
 */
const BASELINE_LEVELS = {
  "widely-available": [
    "varToConst",
    "concatToTemplateLiteral",
    "objectAssignToSpread",
    "arrayFromForEachToForOf",
    "forEachToForOf",
    "forOfKeysToForIn",
  ],
  "newly-available": [
    "varToConst",
    "concatToTemplateLiteral",
    "objectAssignToSpread",
    "arrayFromForEachToForOf",
    "forEachToForOf",
    "forOfKeysToForIn",
    "promiseTry",
  ],
}

/**
 * Transform var to const
 */
function varToConst(j, root) {
  let modified = false
  const changes = []

  root.find(j.VariableDeclaration, { kind: "var" }).forEach((path) => {
    path.node.kind = "const"
    modified = true
    if (path.node.loc) {
      changes.push({
        type: "varToConst",
        line: path.node.loc.start.line,
      })
    }
  })

  return { modified, changes }
}

/**
 * Transform string concatenation to template literals
 */
function concatToTemplateLiteral(j, root) {
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

      const flatten = (node) => {
        if (j.BinaryExpression.check(node) && node.operator === "+") {
          flatten(node.left)
          flatten(node.right)
        } else if (
          j.StringLiteral.check(node) ||
          (j.Literal.check(node) && typeof node.value === "string")
        ) {
          // Add string literal value
          if (parts.length === 0 || expressions.length >= parts.length) {
            parts.push(node.value)
          } else {
            parts[parts.length - 1] += node.value
          }
        } else {
          // Add expression
          if (parts.length === 0) {
            parts.push("")
          }
          expressions.push(node)
        }
      }

      flatten(path.node)

      // Ensure we have the right number of quasis (one more than expressions)
      while (parts.length <= expressions.length) {
        parts.push("")
      }

      // Create template literal
      const quasis = parts.map((part, i) =>
        j.templateElement({ raw: part, cooked: part }, i === parts.length - 1),
      )

      const templateLiteral = j.templateLiteral(quasis, expressions)
      j(path).replaceWith(templateLiteral)

      modified = true
      if (path.node.loc) {
        changes.push({
          type: "concatToTemplateLiteral",
          line: path.node.loc.start.line,
        })
      }
    })

  return { modified, changes }
}

/**
 * Transform Object.assign({}, ...) to object spread
 */
function objectAssignToSpread(j, root) {
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
      if (path.node.loc) {
        changes.push({
          type: "objectAssignToSpread",
          line: path.node.loc.start.line,
        })
      }
    })

  return { modified, changes }
}

/**
 * Transform Array.from().forEach() to for...of
 */
function arrayFromForEachToForOf(j, root) {
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
 * Helper function to check if an expression is definitively an array or iterable
 * 
 * This function is conservative - it only returns true for expressions that we can
 * statically determine are iterable. This prevents transforming forEach calls on
 * objects that implement forEach but are not iterable (like jscodeshift's Collection).
 */
function isDefinitelyArrayOrIterable(j, node) {
  // Array literal - definitely iterable
  if (j.ArrayExpression.check(node)) {
    return true
  }

  // Call expressions that return arrays/iterables
  if (j.CallExpression.check(node)) {
    const callee = node.callee

    if (j.MemberExpression.check(callee)) {
      // Array.from(), Array.of() - definitely return arrays
      if (j.Identifier.check(callee.object) && callee.object.name === "Array") {
        return true
      }

      // Array methods that return arrays
      const arrayMethods = [
        "filter",
        "map",
        "slice",
        "concat",
        "flat",
        "flatMap",
        "splice",
        "reverse",
        "sort",
      ]
      if (
        j.Identifier.check(callee.property) &&
        arrayMethods.includes(callee.property.name)
      ) {
        return true
      }

      // String methods that return arrays
      if (
        j.Identifier.check(callee.property) &&
        (callee.property.name === "split" || callee.property.name === "match")
      ) {
        return true
      }

      // Object.keys(), Object.values(), Object.entries() - these return arrays
      if (
        j.Identifier.check(callee.object) &&
        callee.object.name === "Object" &&
        j.Identifier.check(callee.property) &&
        (callee.property.name === "keys" ||
          callee.property.name === "values" ||
          callee.property.name === "entries")
      ) {
        return true
      }

      // document.querySelectorAll() returns NodeList (iterable)
      // document.getElementsBy* returns HTMLCollection (iterable)
      if (
        j.Identifier.check(callee.property) &&
        (callee.property.name === "querySelectorAll" ||
          callee.property.name === "getElementsByTagName" ||
          callee.property.name === "getElementsByClassName" ||
          callee.property.name === "getElementsByName")
      ) {
        return true
      }
    }
  }

  // Member expressions for known iterable properties
  if (j.MemberExpression.check(node)) {
    const property = node.property
    if (
      j.Identifier.check(property) &&
      (property.name === "children" || property.name === "childNodes")
    ) {
      return true
    }
  }

  // New expressions for known iterables
  if (j.NewExpression.check(node)) {
    if (j.Identifier.check(node.callee)) {
      const constructorName = node.callee.name
      // Set, Map, Array, WeakSet - all iterable
      // Note: Map has different forEach signature (value, key), so it's handled separately
      if (constructorName === "Set" || constructorName === "Array" ||
          constructorName === "WeakSet") {
        return true
      }
    }
  }

  // Do NOT use heuristics like variable names - we can't be sure from the name alone
  // For example, a variable named "items" could be a jscodeshift Collection,
  // which has forEach but is not iterable
  return false
}

/**
 * Transform all .forEach() calls to for...of loops
 * Only transforms when the object is likely an array or iterable
 */
function forEachToForOf(j, root) {
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

      // Skip Array.from().forEach() as it's handled by arrayFromForEachToForOf
      const object = node.callee.object
      if (
        j.CallExpression.check(object) &&
        j.MemberExpression.check(object.callee) &&
        j.Identifier.check(object.callee.object) &&
        object.callee.object.name === "Array" &&
        j.Identifier.check(object.callee.property) &&
        object.callee.property.name === "from"
      ) {
        return false
      }

      // Only transform if the object is definitely an array or iterable
      if (!isDefinitelyArrayOrIterable(j, object)) {
        return false
      }

      return true
    })
    .forEach((path) => {
      const node = path.node
      const iterable = node.callee.object
      const callback = node.arguments[0]

      // Only transform if callback is a function
      if (
        callback &&
        (j.ArrowFunctionExpression.check(callback) ||
          j.FunctionExpression.check(callback))
      ) {
        // Only transform if:
        // 1. Callback has exactly 1 parameter (element only), OR
        // 2. Callback has 2+ params AND first param is a destructuring pattern
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
                type: "forEachToForOf",
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
 */
function forOfKeysToForIn(j, root) {
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
 * Transform new Promise((resolve, reject) => { resolve(fn()) }) to Promise.try(fn)
 */
function promiseTry(j, root) {
  let modified = false
  const changes = []

  root
    .find(j.NewExpression)
    .filter((path) => {
      const node = path.node
      // Check if this is new Promise(...)
      if (!j.Identifier.check(node.callee) || node.callee.name !== "Promise") {
        return false
      }

      // Check if there's one argument that's a function
      if (node.arguments.length !== 1) {
        return false
      }

      const executor = node.arguments[0]
      if (
        !j.ArrowFunctionExpression.check(executor) &&
        !j.FunctionExpression.check(executor)
      ) {
        return false
      }

      // Check if function has 1-2 params (resolve, reject)
      if (executor.params.length < 1 || executor.params.length > 2) {
        return false
      }

      // Check if body is a block with single resolve() call or expression body
      const body = executor.body

      // For arrow functions with expression body: (resolve) => expr
      if (!j.BlockStatement.check(body)) {
        // Check if expression is resolve(something) or func(resolve)
        if (j.CallExpression.check(body)) {
          const callExpr = body
          // Pattern: (resolve) => resolve(expr)
          if (
            j.Identifier.check(callExpr.callee) &&
            j.Identifier.check(executor.params[0]) &&
            callExpr.callee.name === executor.params[0].name &&
            callExpr.arguments.length > 0
          ) {
            return true
          }
          // Pattern: (resolve) => func(resolve) - resolve must be the ONLY argument
          if (
            callExpr.arguments.length === 1 &&
            j.Identifier.check(callExpr.arguments[0]) &&
            j.Identifier.check(executor.params[0]) &&
            callExpr.arguments[0].name === executor.params[0].name
          ) {
            return true
          }
        }
        return false
      }

      // For functions with block body containing single resolve(expr) call
      if (body.body.length === 1 && j.ExpressionStatement.check(body.body[0])) {
        const expr = body.body[0].expression
        if (
          j.CallExpression.check(expr) &&
          j.Identifier.check(expr.callee) &&
          expr.callee.name === executor.params[0].name
        ) {
          return true
        }
      }

      return false
    })
    .forEach((path) => {
      const node = path.node
      const executor = node.arguments[0]
      const body = executor.body
      const resolveParam = executor.params[0]

      let expression
      let tryArg

      // Extract the expression
      if (!j.BlockStatement.check(body)) {
        // Arrow function with expression body: (resolve) => expr
        expression = body
        
        // Check if expression is a call where resolve is passed as the only argument
        // e.g., (resolve) => setTimeout(resolve) should become Promise.try(setTimeout)
        if (
          j.CallExpression.check(expression) &&
          expression.arguments.length === 1 &&
          j.Identifier.check(expression.arguments[0]) &&
          j.Identifier.check(resolveParam) &&
          expression.arguments[0].name === resolveParam.name
        ) {
          // Use the callee directly (e.g., setTimeout)
          tryArg = expression.callee
        }
        // Check if expression is resolve(something)
        else if (
          j.CallExpression.check(expression) &&
          j.Identifier.check(expression.callee) &&
          j.Identifier.check(resolveParam) &&
          expression.callee.name === resolveParam.name &&
          expression.arguments.length > 0
        ) {
          // Extract the argument from resolve(arg) and wrap in arrow function
          expression = expression.arguments[0]
          tryArg = j.arrowFunctionExpression([], expression)
        } else {
          // Wrap expression in arrow function
          tryArg = j.arrowFunctionExpression([], expression)
        }
      } else if (body.body.length === 1 && j.ExpressionStatement.check(body.body[0])) {
        // Block with resolve(expr) call
        const callExpr = body.body[0].expression
        if (j.CallExpression.check(callExpr) && callExpr.arguments.length > 0) {
          expression = callExpr.arguments[0]
          // Wrap expression in arrow function for Promise.try
          tryArg = j.arrowFunctionExpression([], expression)
        }
      }

      if (tryArg) {
        // Create Promise.try(fn)
        const promiseTryCall = j.callExpression(
          j.memberExpression(j.identifier("Promise"), j.identifier("try")),
          [tryArg],
        )

        j(path).replaceWith(promiseTryCall)

        modified = true
        if (node.loc) {
          changes.push({
            type: "promiseTry",
            line: node.loc.start.line,
          })
        }
      }
    })

  return { modified, changes }
}

/**
 * Transform JavaScript code using the specified transformers
 * @param {string} code - The source code to transform
 * @param {Object} options - Transformation options
 * @param {string} options.baseline - Baseline level ('widely-available' or 'newly-available')
 * @returns {Object} - Object with { code, modified, changes }
 */
function transform(code, options = {}) {
  const baseline = options.baseline || "widely-available"
  const enabledTransformers =
    BASELINE_LEVELS[baseline] || BASELINE_LEVELS["widely-available"]

  const j = jscodeshift.withParser("tsx")
  const root = j(code)

  let modified = false
  const allChanges = []

  // Apply transformers
  const transformerFunctions = {
    varToConst,
    concatToTemplateLiteral,
    objectAssignToSpread,
    arrayFromForEachToForOf,
    forEachToForOf,
    forOfKeysToForIn,
    promiseTry,
  }

  for (const transformerName of enabledTransformers) {
    const transformer = transformerFunctions[transformerName]
    if (transformer) {
      const result = transformer(j, root)
      if (result.modified) {
        modified = true
        allChanges.push(...result.changes)
      }
    }
  }

  return {
    code: root.toSource(),
    modified,
    changes: allChanges,
  }
}

export { transform, BASELINE_LEVELS }
