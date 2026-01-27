import { default as j } from "jscodeshift"
import {
  isSafeToTransformInitializer,
  areAllChainedMethodsTransformable,
} from "./utils.js"

/**
 * Replace jQuery selector $('.selector') with document.querySelectorAll('.selector').
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll
 */
export function selectorToQuerySelectorAll(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "Identifier", name: "$" },
    })
    .forEach((path) => {
      const arg = path.node.arguments[0]
      if (!arg) return
      // Support Literal, StringLiteral, or TemplateLiteral with no expressions
      const isString =
        (arg.type === "Literal" && typeof arg.value === "string") ||
        (arg.type === "StringLiteral" && typeof arg.value === "string") ||
        (arg.type === "TemplateLiteral" &&
          Array.isArray(arg.expressions) &&
          arg.expressions.length === 0)
      if (!isString) return

      // For TemplateLiteral with no expressions, keep the TemplateLiteral node
      // as the argument; jscodeshift will print it as a template literal.
      const textValue = arg.type === "TemplateLiteral" ? null : arg.value

      // Only transform class selectors here.
      const valueToCheck =
        arg.type === "TemplateLiteral"
          ? (arg.quasis?.[0]?.value?.cooked ?? null)
          : textValue
      if (typeof valueToCheck !== "string") return
      if (!valueToCheck.startsWith(".")) return

      // Skip when the call is immediately followed by a .each(...) member access
      // to avoid partially transforming into document.querySelectorAll().each(...)
      const parent = path.parent?.node ? path.parent.node : null
      if (parent && parent.type === "MemberExpression") {
        const prop = parent.property
        if (prop && prop.type === "Identifier" && prop.name === "each") return
      }

      // Check if all chained methods are transformable
      if (!areAllChainedMethodsTransformable(path)) return

      if (!areAllChainedMethodsTransformable(path)) return
      if (!isSafeToTransformInitializer(root, path)) return

      j(path).replaceWith(
        j.callExpression(
          j.memberExpression(
            j.identifier("document"),
            j.identifier("querySelectorAll"),
          ),
          [arg],
        ),
      )
      modified = true
    })
  return modified
}
