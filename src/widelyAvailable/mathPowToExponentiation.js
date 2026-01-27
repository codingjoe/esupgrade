import { default as j } from "jscodeshift"

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
      return path.node.arguments.length === 2
    })
    .forEach((path) => {
      const node = path.node
      let [base, exponent] = node.arguments

      // Check if base is a Math.pow call that will become ** in this pass
      const baseIsMathPow =
        j.CallExpression.check(base) &&
        j.MemberExpression.check(base.callee) &&
        j.Identifier.check(base.callee.object) &&
        base.callee.object.name === "Math" &&
        j.Identifier.check(base.callee.property) &&
        base.callee.property.name === "pow" &&
        base.arguments?.length === 2

      // Check if exponent is a Math.pow call that will become ** in this pass
      const exponentIsMathPow =
        j.CallExpression.check(exponent) &&
        j.MemberExpression.check(exponent.callee) &&
        j.Identifier.check(exponent.callee.object) &&
        exponent.callee.object.name === "Math" &&
        j.Identifier.check(exponent.callee.property) &&
        exponent.callee.property.name === "pow" &&
        exponent.arguments?.length === 2

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
