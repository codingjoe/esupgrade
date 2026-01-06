import { default as j } from "jscodeshift"

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
   * Check if an expression is statically verifiable as iterable. Used by transformers
   * to ensure they only transform known iterable types.
   *
   * @returns {boolean} True if the node can be verified as iterable
   */
  isIterable() {
    // Array literal: [1, 2, 3]
    if (j.ArrayExpression.check(this.node)) {
      return true
    }

    // Array.from(), Array.of(), etc.
    if (
      j.CallExpression.check(this.node) &&
      j.MemberExpression.check(this.node.callee) &&
      j.Identifier.check(this.node.callee.object) &&
      this.node.callee.object.name === "Array"
    ) {
      return true
    }

    // new Array()
    if (
      j.NewExpression.check(this.node) &&
      j.Identifier.check(this.node.callee) &&
      this.node.callee.name === "Array"
    ) {
      return true
    }

    // String literal methods that return iterables
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

    // String literal methods (e.g., "a,b,c".split(','), "hello".slice(0))
    return !!(
      j.CallExpression.check(this.node) &&
      j.MemberExpression.check(this.node.callee) &&
      j.Identifier.check(this.node.callee.property) &&
      j.StringLiteral.check(this.node.callee.object) &&
      STRING_METHODS_RETURNING_ITERABLE.includes(this.node.callee.property.name)
    )
  }

  /**
   * Check if two AST nodes are structurally equivalent. Compares identifiers, literals,
   * member expressions, and call expressions recursively.
   *
   * @param {import("ast-types").ASTNode | null | undefined} other - Second node to
   *   compare
   * @returns {boolean} True if nodes are structurally equivalent
   */
  isEqual(other) {
    if (!this.node || !other) return false

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
}

/**
 * Check if a pattern (identifier, destructuring, etc.) contains a specific variable
 * name
 *
 * @param {import("ast-types").ASTNode} node - The AST node to check
 * @param {string} varName - The variable name to search for
 * @returns {boolean} True if the pattern contains the identifier
 */
function patternContainsIdentifier(node, varName) {
  if (j.Identifier.check(node)) {
    return node.name === varName
  }
  if (j.ObjectPattern.check(node)) {
    return node.properties.some(
      (prop) =>
        ((j.Property.check(prop) || j.ObjectProperty.check(prop)) &&
          patternContainsIdentifier(prop.value, varName)) ||
        (j.RestElement.check(prop) &&
          patternContainsIdentifier(prop.argument, varName)),
    )
  }
  if (j.ArrayPattern.check(node)) {
    return node.elements.some((element) => patternContainsIdentifier(element, varName))
  }
  if (j.AssignmentPattern.check(node)) {
    return patternContainsIdentifier(node.left, varName)
  }
  // RestElement is the only remaining valid pattern type
  return j.RestElement.check(node) && patternContainsIdentifier(node.argument, varName)
}

/**
 * Extract all identifier names from a pattern (handles destructuring)
 *
 * @param {import("ast-types").ASTNode | null | undefined} pattern - The pattern node to
 *   extract identifiers from
 * @yields {string} Identifier names found in the pattern
 * @returns {Generator<string, void, unknown>}
 */
function* extractIdentifiersFromPattern(pattern) {
  if (!pattern) return

  if (j.Identifier.check(pattern)) {
    yield pattern.name
  } else if (j.ObjectPattern.check(pattern)) {
    for (const prop of pattern.properties) {
      if (j.Property.check(prop) || j.ObjectProperty.check(prop)) {
        yield* extractIdentifiersFromPattern(prop.value)
      } else if (j.RestElement.check(prop)) {
        yield* extractIdentifiersFromPattern(prop.argument)
      }
    }
  } else if (j.ArrayPattern.check(pattern)) {
    for (const element of pattern.elements) {
      yield* extractIdentifiersFromPattern(element)
    }
  } else if (j.AssignmentPattern.check(pattern)) {
    yield* extractIdentifiersFromPattern(pattern.left)
  } else if (j.RestElement.check(pattern)) {
    yield* extractIdentifiersFromPattern(pattern.argument)
  }
}

/**
 * Check if an assignment/update expression is shadowed by a closer variable declaration
 *
 * @param {string} varName - The variable name to check
 * @param {import("ast-types").NodePath} declarationPath - The path to the original
 *   declaration
 * @param {import("ast-types").NodePath} usagePath - The path to the assignment/update
 *   expression
 * @returns {boolean} True if the assignment is shadowed by a closer declaration
 */
function isAssignmentShadowed(varName, declarationPath, usagePath) {
  let current = usagePath.parent

  while (current) {
    if (
      j.FunctionDeclaration.check(current.node) ||
      j.FunctionExpression.check(current.node) ||
      j.ArrowFunctionExpression.check(current.node)
    ) {
      // Check function parameters
      if (current.node.params) {
        for (const param of current.node.params) {
          if (patternContainsIdentifier(param, varName)) {
            return true
          }
        }
      }

      // Check for var/let/const declarations in this function
      const functionBody = current.node.body
      if (functionBody) {
        let foundOurDeclaration = false
        const hasLocalDecl = j(functionBody)
          .find(j.VariableDeclarator)
          .some((declPath) => {
            const declParent = declPath.parent.node
            if (declParent === declarationPath.node) {
              foundOurDeclaration = true
              return false
            }
            return patternContainsIdentifier(declPath.node.id, varName)
          })

        // If we found a shadowing declaration (not our own), the assignment is shadowed
        if (hasLocalDecl) {
          return true
        }

        // If we found our declaration in this scope, stop traversing -
        // the assignment is not shadowed, it belongs to our declaration
        if (foundOurDeclaration) {
          return false
        }
      }
    }

    current = current.parent
  }

  return false
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
    if (!patternContainsIdentifier(assignPath.node.left, varName)) {
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
  for (const varName of extractIdentifiersFromPattern(declarator.id)) {
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
  const kind = determineDeclaratorKind(root, declarator, path)

  path.node.kind = kind

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
    const kind = determineDeclaratorKind(root, declarator, path)
    return j.variableDeclaration(kind, [declarator])
  })

  j(path).replaceWith(declarations)

  const change = path.node.loc
    ? { type: "varToLetOrConst", line: path.node.loc.start.line }
    : null

  return { modified: true, change }
}
