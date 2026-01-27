import { default as j } from "jscodeshift"
import { isTransformableJQueryMethod } from "./utils.js"

/**
 * Unwrap jQuery calls that wrap DOM element identifiers like $(el) to just el.
 *
 * This transformer removes the jQuery wrapper when it's called with an identifier,
 * since the identifier is already a DOM element. This allows subsequent transformers
 * to work with the bare DOM element.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function unwrapJQueryIdentifier(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "Identifier", name: "$" },
    })
    .forEach((path) => {
      const arg = path.node.arguments?.[0] ?? null
      if (!arg || !j.Identifier.check(arg)) return
      if (path.node.arguments.length !== 1) return

      // Walk the chain to ensure every accessed property/method is allowed
      let currentPath = path
      while (currentPath.parent) {
        const parent = currentPath.parent.node

        if (parent.type !== "MemberExpression" || parent.object !== currentPath.node) {
          break
        }

        const prop = parent.property
        if (!j.Identifier.check(prop)) return
        if (!isTransformableJQueryMethod(prop.name)) return

        const grandParent = currentPath.parent.parent?.node ?? null
        if (grandParent?.type === "CallExpression" && grandParent.callee === parent) {
          currentPath = currentPath.parent.parent
          continue
        }

        currentPath = currentPath.parent
      }

      j(path).replaceWith(arg)
      modified = true
    })
  return modified
}
