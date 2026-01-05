/**
 * Utility classes for AST node checking and pattern analysis.
 * These static classes provide reusable checks for AST manipulation.
 */

/**
 * Pattern matching and identifier extraction utilities.
 */
export class PatternChecker {
  /**
   * Check if a pattern contains a specific variable name.
   * Handles destructuring patterns, array patterns, and rest elements.
   * @param {import('jscodeshift').JSCodeshift} j - The jscodeshift API.
   * @param {import('jscodeshift').ASTNode | null | undefined} node - The AST node to check.
   * @param {string} varName - The variable name to search for.
   * @returns {boolean} True if the pattern contains the identifier.
   */
  static containsIdentifier(j, node, varName) {
    if (!node) {
      return false
    }
    if (j.Identifier.check(node)) {
      return node.name === varName
    }
    if (j.ObjectPattern.check(node)) {
      return node.properties.some(
        (prop) =>
          ((j.Property.check(prop) || j.ObjectProperty.check(prop)) &&
            PatternChecker.containsIdentifier(j, prop.value, varName)) ||
          (j.RestElement.check(prop) &&
            PatternChecker.containsIdentifier(j, prop.argument, varName)),
      )
    }
    if (j.ArrayPattern.check(node)) {
      return node.elements.some((element) =>
        PatternChecker.containsIdentifier(j, element, varName),
      )
    }
    if (j.AssignmentPattern.check(node)) {
      return PatternChecker.containsIdentifier(j, node.left, varName)
    }
    // RestElement is the only remaining valid pattern type
    return (
      j.RestElement.check(node) &&
      PatternChecker.containsIdentifier(j, node.argument, varName)
    )
  }

  /**
   * Extract all identifier names from a pattern.
   * Handles destructuring patterns recursively.
   * @param {import('jscodeshift').JSCodeshift} j - The jscodeshift API.
   * @param {import('jscodeshift').ASTNode | null | undefined} pattern - The pattern node to extract identifiers from.
   * @yields {string} Identifier names found in the pattern.
   * @returns {Generator<string, void, unknown>}
   */
  static *extractIdentifiers(j, pattern) {
    if (!pattern) return

    if (j.Identifier.check(pattern)) {
      yield pattern.name
    } else if (j.ObjectPattern.check(pattern)) {
      for (const prop of pattern.properties) {
        if (j.Property.check(prop) || j.ObjectProperty.check(prop)) {
          yield* PatternChecker.extractIdentifiers(j, prop.value)
        } else if (j.RestElement.check(prop)) {
          yield* PatternChecker.extractIdentifiers(j, prop.argument)
        }
      }
    } else if (j.ArrayPattern.check(pattern)) {
      for (const element of pattern.elements) {
        yield* PatternChecker.extractIdentifiers(j, element)
      }
    } else if (j.AssignmentPattern.check(pattern)) {
      yield* PatternChecker.extractIdentifiers(j, pattern.left)
    } else if (j.RestElement.check(pattern)) {
      yield* PatternChecker.extractIdentifiers(j, pattern.argument)
    }
  }
}

/**
 * AST node comparison and verification utilities.
 */
export class NodeChecker {
  /**
   * Check if two AST nodes are structurally equivalent.
   * Compares identifiers, literals, member expressions, and call expressions recursively.
   * @param {import('jscodeshift').JSCodeshift} j - The jscodeshift API.
   * @param {import('jscodeshift').ASTNode | null | undefined} node1 - First node to compare.
   * @param {import('jscodeshift').ASTNode | null | undefined} node2 - Second node to compare.
   * @returns {boolean} True if nodes are structurally equivalent.
   */
  static areEquivalent(j, node1, node2) {
    if (!node1 || !node2) return false

    // Both are identifiers with same name
    if (j.Identifier.check(node1) && j.Identifier.check(node2)) {
      return node1.name === node2.name
    }

    // Both are literals with same value
    if (j.Literal.check(node1) && j.Literal.check(node2)) {
      return node1.value === node2.value
    }

    // Both are member expressions
    if (j.MemberExpression.check(node1) && j.MemberExpression.check(node2)) {
      return (
        NodeChecker.areEquivalent(j, node1.object, node2.object) &&
        NodeChecker.areEquivalent(j, node1.property, node2.property) &&
        node1.computed === node2.computed
      )
    }

    // Both are call expressions
    if (j.CallExpression.check(node1) && j.CallExpression.check(node2)) {
      // Check if callees are equivalent
      if (!NodeChecker.areEquivalent(j, node1.callee, node2.callee)) {
        return false
      }
      // Check if argument counts match
      if (node1.arguments.length !== node2.arguments.length) {
        return false
      }
      // Check if all arguments are equivalent
      for (let i = 0; i < node1.arguments.length; i++) {
        if (!NodeChecker.areEquivalent(j, node1.arguments[i], node2.arguments[i])) {
          return false
        }
      }
      return true
    }

    return false
  }

  /**
   * Check if an expression is statically verifiable as iterable.
   * Used by transformers to ensure they only transform known iterable types.
   * @param {import('jscodeshift').JSCodeshift} j - The jscodeshift API.
   * @param {import('jscodeshift').ASTNode} node - The AST node to check.
   * @returns {boolean} True if the node can be verified as iterable.
   */
  static isVerifiableIterable(j, node) {
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
      j.CallExpression.check(node) &&
      j.MemberExpression.check(node.callee) &&
      j.Identifier.check(node.callee.property) &&
      j.StringLiteral.check(node.callee.object) &&
      STRING_METHODS_RETURNING_ITERABLE.includes(node.callee.property.name)
    )
  }
}

/**
 * Variable scope and reassignment checking utilities.
 */
export class VariableChecker {
  /**
   * Check if an assignment/update expression is shadowed by a closer variable declaration.
   * @param {import('jscodeshift').JSCodeshift} j - The jscodeshift API.
   * @param {string} varName - The variable name to check.
   * @param {import('jscodeshift').ASTPath} declarationPath - The path to the original declaration.
   * @param {import('jscodeshift').ASTPath} usagePath - The path to the assignment/update expression.
   * @returns {boolean} True if the assignment is shadowed by a closer declaration.
   */
  static isAssignmentShadowed(j, varName, declarationPath, usagePath) {
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
            if (PatternChecker.containsIdentifier(j, param, varName)) {
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
              return PatternChecker.containsIdentifier(j, declPath.node.id, varName)
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
   * Check if a variable is reassigned after its declaration.
   * @param {import('jscodeshift').JSCodeshift} j - The jscodeshift API.
   * @param {import('jscodeshift').Collection} root - The root AST collection.
   * @param {string} varName - The variable name to check.
   * @param {import('jscodeshift').ASTPath} declarationPath - The path to the variable declaration.
   * @returns {boolean} True if the variable is reassigned.
   */
  static isReassigned(j, root, varName, declarationPath) {
    let isReassigned = false

    // Check for AssignmentExpression where left side targets the variable
    root.find(j.AssignmentExpression).forEach((assignPath) => {
      if (!PatternChecker.containsIdentifier(j, assignPath.node.left, varName)) {
        return
      }

      if (
        VariableChecker.isAssignmentShadowed(j, varName, declarationPath, assignPath)
      ) {
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

      if (
        VariableChecker.isAssignmentShadowed(j, varName, declarationPath, updatePath)
      ) {
        return
      }

      isReassigned = true
    })

    return isReassigned
  }
}
