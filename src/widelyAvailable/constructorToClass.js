import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

function getDeclarationScope(path) {
  return j.FunctionDeclaration.check(path.node)
    ? (path.scope.parent ?? path.scope)
    : path.scope
}

function addConstructor(constructorsByScope, constructorName, declarationPath) {
  const constructorInfo = {
    constructorName,
    declaration: declarationPath,
    prototypeMethods: [],
  }

  const scopeNode = getDeclarationScope(declarationPath).path.node
  const constructorsInScope = constructorsByScope.get(scopeNode) ?? new Map()

  constructorsInScope.set(constructorName, constructorInfo)
  constructorsByScope.set(scopeNode, constructorsInScope)
}

function getConstructor(constructorsByScope, path, constructorName) {
  let activeScope = path.scope

  while (activeScope) {
    const constructorsInScope = constructorsByScope.get(activeScope.path.node)
    const constructorInfo = constructorsInScope?.get(constructorName)

    if (constructorInfo) {
      return constructorInfo
    }

    activeScope = activeScope.parent
  }

  return null
}

function findConstructors(root) {
  const constructorsByScope = new Map()

  root.find(j.FunctionDeclaration).forEach((path) => {
    if (
      !new NodeTest(path.node.id).isConstructorName() ||
      !new NodeTest(path.node.body).hasSimpleConstructorBody()
    ) {
      return
    }

    addConstructor(constructorsByScope, path.node.id.name, path)
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

      addConstructor(constructorsByScope, declarator.id.name, path)
    })
  })

  return constructorsByScope
}

/**
 * Find and associate prototype methods with constructors.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection.
 * @param {Map<
 *   object,
 *   Map<
 *     string,
 *     {
 *       constructorName: string
 *       declaration: import("ast-types").NodePath
 *       prototypeMethods: any[]
 *     }
 *   >
 * >} constructorsByScope
 *   - Map of constructors grouped by lexical scope.
 */
function findPrototypeMethods(root, constructorsByScope) {
  // Pattern 1: ConstructorName.prototype.methodName = ...
  root
    .find(j.ExpressionStatement)
    .filter((path) => {
      const { node } = path

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
      return !!getConstructor(constructorsByScope, path, constructorName)
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

      const constructorInfo = getConstructor(constructorsByScope, path, constructorName)

      constructorInfo.prototypeMethods.push({
        path,
        methodName,
        methodValue,
      })
    })

  // Pattern 2: ConstructorName.prototype = { methodName: function() {...}, ... }
  root
    .find(j.ExpressionStatement)
    .filter((path) => {
      const { node } = path

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
      return !!getConstructor(constructorsByScope, path, constructorName)
    })
    .forEach((path) => {
      const assignment = path.node.expression
      const left = assignment.left
      const constructorName = left.object.name
      const methodValue = assignment.right

      if (!j.ObjectExpression.check(methodValue)) {
        return
      }

      const constructorInfo = getConstructor(constructorsByScope, path, constructorName)

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

        constructorInfo.prototypeMethods.push({
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
 *   object,
 *   Map<
 *     string,
 *     {
 *       constructorName: string
 *       declaration: import("ast-types").NodePath
 *       prototypeMethods: any[]
 *     }
 *   >
 * >} constructorsByScope
 *   - Map of constructors grouped by lexical scope.
 *
 * @returns {boolean} True if code was modified.
 */
function transformConstructorsToClasses(root, constructorsByScope) {
  let modified = false

  constructorsByScope.forEach((constructors) => {
    constructors.forEach((info) => {
      if (info.prototypeMethods.length === 0) {
        return
      }

      const constructorName = info.constructorName
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

      const hasNodeOrBodyComments =
        (constructorNode.comments && constructorNode.comments.length > 0) ||
        (constructorNode.body.comments && constructorNode.body.comments.length > 0)

      const classBody =
        constructorNode.params.length > 0 ||
        constructorNode.body.body.length > 0 ||
        hasNodeOrBodyComments
          ? [
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
          : []

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
  const constructorsByScope = findConstructors(root)
  findPrototypeMethods(root, constructorsByScope)
  return transformConstructorsToClasses(root, constructorsByScope)
}
constructorToClass.baselineDate = new Date(Date.UTC(2016, 2, 8))
