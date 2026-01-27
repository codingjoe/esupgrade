import { default as j } from "jscodeshift"
import {
  isSafeToTransformInitializer,
  areAllChainedMethodsTransformable,
} from "./utils.js"

/**
 * Replace jQuery id selector $('#id') with document.getElementById('id').
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementById
 */
export function idSelectorToGetElementById(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "Identifier", name: "$" },
    })
    .forEach((path) => {
      const arg = path.node.arguments[0]
      if (!arg) return
      const isString =
        (arg.type === "Literal" && typeof arg.value === "string") ||
        (arg.type === "StringLiteral" && typeof arg.value === "string") ||
        (arg.type === "TemplateLiteral" &&
          Array.isArray(arg.expressions) &&
          arg.expressions.length === 0)
      if (!isString) return

      const value =
        arg.type === "TemplateLiteral"
          ? (arg.quasis?.[0]?.value?.cooked ?? null)
          : arg.value
      if (typeof value !== "string") return
      if (!value.startsWith("#")) return

      // Check if all chained methods are transformable
      if (!areAllChainedMethodsTransformable(path)) return

      // Use centralized safety check
      if (!isSafeToTransformInitializer(root, path)) return

      const idValue = value.slice(1)
      j(path).replaceWith(
        j.callExpression(
          j.memberExpression(j.identifier("document"), j.identifier("getElementById")),
          [j.literal(idValue)],
        ),
      )
      modified = true
    })
  return modified
}
