import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform string concatenation to template literals.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
 */
export function concatToTemplateLiteral(root) {
  let modified = false

  root
    .find(j.BinaryExpression, { operator: "+" })
    .filter((path) => new NodeTest(path.node).containsStringLiteral())
    .forEach((path) => {
      const parts = []
      const expressions = []
      let lastStringNode = null

      function addStringPart(stringNode) {
        const nodeTest = new NodeTest(stringNode)
        const rawValue = nodeTest.getRawStringValue()
        const cookedValue = stringNode.value

        // Check if we need to add a line continuation backslash
        // This happens when two consecutive string literals are on different lines
        let needsLineContinuation = false
        if (
          lastStringNode &&
          lastStringNode.loc &&
          stringNode.loc &&
          lastStringNode.loc.end.line < stringNode.loc.start.line
        ) {
          // Strings are on different lines - add line continuation
          needsLineContinuation = true
        }

        if (parts.length === 0 || expressions.length >= parts.length) {
          parts.push({ raw: rawValue, cooked: cookedValue })
        } else {
          const lastPart = parts[parts.length - 1]
          if (needsLineContinuation) {
            // Add backslash and newline for line continuation
            // But if the last part already ends with a newline, don't add another backslash+newline
            if (lastPart.raw.endsWith("\n")) {
              lastPart.raw += rawValue
            } else {
              lastPart.raw += `\\
${rawValue}`
            }
            lastPart.cooked += cookedValue
          } else {
            lastPart.raw += rawValue
            lastPart.cooked += cookedValue
          }
        }

        lastStringNode = stringNode
      }

      function addExpression(expr) {
        if (parts.length === 0) {
          parts.push({ raw: "", cooked: "" })
        }
        expressions.push(expr)
      }

      function flatten(node, stringContext = false) {
        if (j.BinaryExpression.check(node) && node.operator === "+") {
          const nodeTest = new NodeTest(node)
          const hasString = nodeTest.containsStringLiteral()

          if (!hasString && !stringContext) {
            addExpression(node)
          } else {
            const leftHasString = new NodeTest(node.left).containsStringLiteral()

            if (j.BinaryExpression.check(node.left) && node.left.operator === "+") {
              flatten(node.left, stringContext)
            } else if (new NodeTest(node.left).isStringLiteral()) {
              addStringPart(node.left)
            } else {
              addExpression(node.left)
            }

            const rightInStringContext = stringContext || leftHasString
            if (j.BinaryExpression.check(node.right) && node.right.operator === "+") {
              if (
                !new NodeTest(node.right).containsStringLiteral() &&
                rightInStringContext
              ) {
                addExpression(node.right)
              } else {
                flatten(node.right, rightInStringContext)
              }
            } else if (new NodeTest(node.right).isStringLiteral()) {
              addStringPart(node.right)
            } else {
              addExpression(node.right)
            }
          }
        }
      }

      flatten(path.node)

      // Ensure we have the right number of quasis (one more than expressions)
      while (parts.length <= expressions.length) {
        parts.push({ raw: "", cooked: "" })
      }

      // Create template literal
      const quasis = parts.map((part, i) =>
        j.templateElement(
          { raw: part.raw, cooked: part.cooked },
          i === parts.length - 1,
        ),
      )

      const templateLiteral = j.templateLiteral(quasis, expressions)
      j(path).replaceWith(templateLiteral)

      modified = true
    })

  return modified
}
