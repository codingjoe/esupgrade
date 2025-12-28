/**
 * Transform var to const
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let
 */
export function varToConst(j, root) {
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
