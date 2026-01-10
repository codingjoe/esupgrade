import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

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

        if (!new NodeTest(methodValue).canBeClassMethod()) {
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

          if (!new NodeTest(prop.value).canBeClassMethod()) {
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
        const functionExpr = j.functionExpression(
          null,
          methodValue.params,
          new NodeTest(methodValue).toBlockStatement(),
          methodValue.generator || false,
        )

        // Preserve async property
        if (methodValue.async) {
          functionExpr.async = true
        }

        const method = j.methodDefinition(
          "method",
          j.identifier(methodName),
          functionExpr,
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
