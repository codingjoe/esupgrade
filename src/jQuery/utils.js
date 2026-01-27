import { default as j } from "jscodeshift"
import data from "./HTMLInputElement.json" with { type: "json" }

/**
 * Set of HTML element methods and properties that are safe to transform from jQuery.
 * Includes standard DOM APIs, event handlers, ARIA attributes, and node manipulation methods.
 */
const HTMLInputElementMethods = new Set(data)

/**
 * Check if a method name is safe to transform from jQuery to native DOM.
 *
 * @param {string} methodName - The method name to check.
 * @returns {boolean} True if the method has a safe DOM equivalent.
 */
export function isTransformableJQueryMethod(methodName) {
  return HTMLInputElementMethods.has(methodName)
}

/**
 * Check if a parent node is a method call.
 *
 * @param {Object} parent - Parent node to check.
 * @param {Object} grandParent - Grand parent node to check.
 * @param {Object} currentNode - Current node being checked.
 * @returns {boolean} True if parent is a method call on current node.
 */
function isMethodCall(parent, grandParent, currentNode) {
  const isMemberExpression =
    parent?.type === "MemberExpression" && parent.object === currentNode

  const isCalledExpression =
    grandParent?.type === "CallExpression" && grandParent.callee === parent

  return isMemberExpression && isCalledExpression
}

/**
 * Check if all chained methods on a jQuery call are transformable to DOM equivalents.
 *
 * Validates that all methods chained on a jQuery result can be safely transformed
 * to native DOM APIs. Returns false if any method is jQuery-specific.
 *
 * @param {import('jscodeshift').ASTPath} callPath - AST path of the $() CallExpression.
 * @returns {boolean} True if all chained methods are transformable.
 */
export function areAllChainedMethodsTransformable(callPath) {
  if (!callPath?.node || callPath.node.type !== "CallExpression") {
    return true
  }

  let currentPath = callPath

  while (currentPath?.parent) {
    const parent = currentPath.parent.node
    const grandParent = currentPath.parent.parent?.node

    if (!isMethodCall(parent, grandParent, currentPath.node)) {
      break
    }

    const methodName = parent.property?.name
    if (methodName && !isTransformableJQueryMethod(methodName)) {
      return false
    }

    currentPath = currentPath.parent.parent
  }

  return true
}

/**
 * Utilities for analyzing and validating jQuery code transformations.
 */

// Module-scoped cache previously held as a private static field on the class.
const initTargetCache = new WeakMap()

/**
 * Get cached init target.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @param {string} name - The identifier name.
 * @returns {any} Cached value or undefined.
 */
function getCached(root, name) {
  const map = initTargetCache.get(root)
  return map?.[name]
}

/**
 * Set cached init target.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @param {string} name - The identifier name.
 * @param {any} value - Value to cache.
 */
function setCached(root, name, value) {
  let map = initTargetCache.get(root)
  if (!map) {
    map = {}
    initTargetCache.set(root, map)
  }
  map[name] = value
}

/**
 * Check if a declarator is a top-level $-prefixed variable.
 *
 * @param {import('jscodeshift').ASTPath} path - Declarator path.
 * @param {string} identName - Identifier name.
 * @returns {boolean} True if top-level $-prefixed.
 */
function isTopLevelDollarPrefixed(path, identName) {
  if (!identName.startsWith("$")) {
    return false
  }

  const parent = path.parent?.parent?.node

  return parent?.type === "Program"
}

/**
 * Check if init is a valid jQuery call.
 *
 * @param {Object} init - Init node to check.
 * @returns {boolean} True if valid jQuery call.
 */
function isValidJQueryCall(init) {
  if (!j.CallExpression.check(init)) {
    return false
  }

  const callee = init.callee
  return (
    j.Identifier.check(callee) &&
    (callee.name === "$" || callee.name === "jQuery") &&
    init.arguments?.[0] != null
  )
}

/**
 * Check if identifier has any update expressions.
 *
 * @param {import('jscodeshift').Collection} root - Root collection.
 * @param {string} identName - Identifier name.
 * @returns {boolean} True if update expressions found.
 */
function hasUpdateExpressions(root, identName) {
  for (const path of root.find(j.UpdateExpression).paths()) {
    const arg = path.node.argument
    if (j.Identifier.check(arg) && arg.name === identName) {
      return true
    }
  }
  return false
}

/**
 * Check if identifier usage is safe (declarator, assignment, or member expression).
 *
 * @param {Object} parent - Parent node.
 * @param {Object} node - Current node.
 * @returns {boolean} True if usage is safe.
 */
function isSafeUsage(parent, node) {
  if (parent?.type === "VariableDeclarator" && parent.id === node) {
    return true
  }

  if (parent?.type === "AssignmentExpression" && parent.left === node) {
    return true
  }

  return parent?.type === "MemberExpression" && parent.object === node
}

/**
 * Resolve jQuery initialization target for an identifier.
 *
 * Returns the argument passed to $() or jQuery() if the identifier is safely
 * analyzable (single initialization, no reassignment, safe usage patterns).
 *
 * @param {import('jscodeshift').Collection} root - Root AST collection.
 * @param {string} identName - Identifier name to resolve.
 * @returns {import('jscodeshift').ASTNode|null} Init argument node or null.
 */
export function getJQueryInitTarget(root, identName) {
  if (!identName) {
    return null
  }

  const cached = getCached(root, identName)
  if (cached !== undefined) {
    return cached
  }

  let foundArg = null
  let safe = true

  const decls = root.find(j.VariableDeclarator, { id: { name: identName } })

  for (const path of decls.paths()) {
    const decl = path.node

    if (!isValidJQueryCall(decl.init)) {
      safe = false
      break
    }

    if (isTopLevelDollarPrefixed(path, identName)) {
      safe = false
      break
    }

    const args = decl.init.arguments
    const arg = args?.[0]
    if (!foundArg) {
      foundArg = arg
    } else if (j(foundArg).toSource() !== j(arg).toSource()) {
      safe = false
      break
    }
  }

  if (safe && decls.size() === 0) {
    const assignPaths = root.find(j.AssignmentExpression).paths()
    let foundAssignment = false

    for (const path of assignPaths) {
      const left = path.node.left
      if (!j.Identifier.check(left) || left.name !== identName) {
        continue
      }

      foundAssignment = true
      const right = path.node.right

      if (!isValidJQueryCall(right)) {
        safe = false
        break
      }

      const args = right.arguments
      const arg = args?.[0]
      if (!foundArg) {
        foundArg = arg
      } else if (j(foundArg).toSource() !== j(arg).toSource()) {
        safe = false
        break
      }
    }

    if (!foundAssignment) {
      setCached(root, identName, null)
      return null
    }
  }

  if (!safe || !foundArg) {
    setCached(root, identName, null)
    return null
  }

  if (hasUpdateExpressions(root, identName)) {
    setCached(root, identName, null)
    return null
  }

  const idents = root.find(j.Identifier, { name: identName })
  for (const path of idents.paths()) {
    const parent = path.parent?.node ?? null
    if (!isSafeUsage(parent, path.node)) {
      setCached(root, identName, null)
      return null
    }
  }

  setCached(root, identName, foundArg)
  return foundArg
}

/**
 * Count non-declarator usages of an identifier.
 *
 * @param {import('jscodeshift').Collection} root - Root collection.
 * @param {string} identName - Identifier name.
 * @returns {number} Count of usages.
 */
function countNonDeclaratorUsages(root, identName) {
  const idents = root.find(j.Identifier, { name: identName })
  let usageCount = 0

  for (const path of idents.paths()) {
    const parent = path.parent?.node ?? null
    if (parent?.type === "VariableDeclarator" && parent.id === path.node) {
      continue
    }
    usageCount++
  }

  return usageCount
}

/**
 * Check if jQuery initializer call is safe to transform.
 *
 * Validates that a $() call used as an initializer can be safely transformed
 * to native DOM APIs based on usage patterns and scope.
 *
 * @param {import('jscodeshift').Collection} root - Root AST collection.
 * @param {import('jscodeshift').ASTPath} callPath - AST path of the CallExpression.
 * @returns {boolean} True if safe to transform the initializer call.
 */
export function isSafeToTransformInitializer(root, callPath) {
  if (!callPath) {
    return true
  }

  const parent = callPath.parent?.node ?? null

  if (parent?.type === "VariableDeclarator" && parent.id?.name) {
    const identName = parent.id.name

    // Check if this is a top-level $-prefixed variable
    if (identName.startsWith("$")) {
      const program = callPath.parent?.parent?.parent?.node
      if (program?.type === "Program") {
        return false
      }
    }

    const usageCount = countNonDeclaratorUsages(root, identName)
    if (usageCount === 0) {
      return true
    }

    return !!getJQueryInitTarget(root, identName)
  }

  if (parent?.type === "AssignmentExpression" && parent.left?.type === "Identifier") {
    const identName = parent.left.name

    if (identName.startsWith("$")) {
      return false
    }

    return !!getJQueryInitTarget(root, identName)
  }

  return true
}

/**
 * Check if an expression represents a jQuery object.
 *
 * Validates whether the given AST node is a jQuery call ($(...) or jQuery(...))
 * or an identifier that resolves to a jQuery initialization.
 *
 * @param {import('jscodeshift').Collection} root - Root AST collection.
 * @param {import('jscodeshift').ASTNode} obj - Object expression to check.
 * @returns {boolean} True if the expression is a jQuery object.
 */
export function isJQueryObject(root, obj) {
  if (!obj) {
    return false
  }

  if (j.CallExpression.check(obj)) {
    const isJQueryCall =
      j.Identifier.check(obj.callee) &&
      (obj.callee.name === "$" || obj.callee.name === "jQuery")

    return isJQueryCall && obj.arguments?.[0] != null
  }

  if (j.Identifier.check(obj)) {
    return !!getJQueryInitTarget(root, obj.name)
  }

  return false
}
