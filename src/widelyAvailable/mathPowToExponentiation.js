import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Check whether a node is a two-argument Math.pow() call.
 *
 * @param {import("ast-types").ASTNode} node - The node to check
 * @returns {boolean} True when the node is Math.pow() with two arguments
 */
function isMathPow(node) {
  return (
    new NodeTest(node).isMethodCall(["pow"]) &&
    j.Identifier.check(node.callee.object) &&
    node.callee.object.name === "Math" &&
    node.arguments.length === 2
  )
}

/**
 * Transform Math.pow() to exponentiation operator (**).
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Exponentiation
 */
export function mathPowToExponentiation(root) {
  let modified = false

  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { name: "Math" },
        property: { name: "pow" },
      },
    })
    .filter((path) => {
      // Must have exactly 2 arguments (base and exponent)
      return path.node.arguments.length === 2 && !path.node.callee.computed
    })
    .forEach((path) => {
      const node = path.node
      let [base, exponent] = node.arguments

      // Check if base is a Math.pow call that will become ** in this pass
      const baseIsMathPow = isMathPow(base)

      // Check if exponent is a Math.pow call that will become ** in this pass
      const exponentIsMathPow = isMathPow(exponent)

      // Wrap binary expressions or Math.pow calls in parentheses to preserve order of operations
      if (j.BinaryExpression.check(base) || baseIsMathPow) {
        base = j.parenthesizedExpression(base)
      }
      if (j.BinaryExpression.check(exponent) || exponentIsMathPow) {
        exponent = j.parenthesizedExpression(exponent)
      }

      // Create exponentiation expression
      const expExpression = j.binaryExpression("**", base, exponent)

      j(path).replaceWith(expExpression)

      modified = true
    })

  return modified
}
mathPowToExponentiation.baselineDate = new Date(Date.UTC(2017, 2, 27))
