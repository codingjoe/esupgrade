import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform named arrow function and anonymous function expression assignments to
 * named function declarations. Converts:
 *
 * - Const myFunc = () => {} to: function myFunc() {}
 * - Const myFunc = function() {} to: function myFunc() {}
 * - Let myFunc = function(x: number): number {...} to: function myFunc(x: number): number {...}
 *
 * Only transforms when safe (function doesn't use outer 'this' or 'arguments'). Note:
 * Arrow functions never have their own 'this' or 'arguments', so this transformation
 * is generally safe for arrow functions, but we check to ensure they don't use 'this'
 * at all to avoid potential issues.
 *
 * TypeScript type annotations on function parameters and return types are preserved.
 * Variables with type annotations are only skipped if the function itself doesn't
 * have a return type annotation that can be preserved.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions
 */
export function namedArrowFunctionToNamedFunction(root) {
  let modified = false

  root
    .find(j.VariableDeclaration)
    .filter((path) => {
      const node = path.node

      // Must have exactly one declarator
      if (node.declarations.length !== 1) {
        return false
      }

      const declarator = node.declarations[0]

      // Declarator must have an identifier (simple variable name)
      if (!j.Identifier.check(declarator.id)) {
        return false
      }

      // Init must be an arrow function or anonymous function expression
      const isArrowFunction = j.ArrowFunctionExpression.check(declarator.init)
      const isFunctionExpression =
        j.FunctionExpression.check(declarator.init) && !declarator.init.id

      if (!isArrowFunction && !isFunctionExpression) {
        return false
      }

      const func = declarator.init

      // Skip if the variable has a TypeScript type annotation but the function
      // doesn't have its own return type annotation (which we can preserve)
      // This handles cases like: const Template: StoryFn<MyType> = () => {...}
      // where the type information would be lost in the transformation
      if (declarator.id.typeAnnotation && !func.returnType) {
        return false
      }

      // Skip if it's a generator function
      if (func.generator) {
        return false
      }

      // Skip if the function uses 'this'
      if (new NodeTest(func.body).usesThis()) {
        return false
      }

      // Skip if the function uses 'arguments' (only relevant for function expressions)
      if (isFunctionExpression && new NodeTest(func.body).usesArguments()) {
        return false
      }

      return true
    })
    .forEach((path) => {
      const node = path.node
      const declarator = node.declarations[0]
      const functionName = declarator.id.name
      const func = declarator.init

      // Convert function body to block statement if needed (for arrow functions with expression bodies)
      let functionBody
      if (j.BlockStatement.check(func.body)) {
        functionBody = func.body
      } else {
        // Expression body - wrap in return statement
        functionBody = j.blockStatement([j.returnStatement(func.body)])
      }

      // Create function declaration
      const functionDeclaration = j.functionDeclaration(
        j.identifier(functionName),
        func.params,
        functionBody,
      )

      // Preserve async property
      if (func.async) {
        functionDeclaration.async = true
      }

      // Preserve TypeScript generic type parameters
      if (func.typeParameters) {
        functionDeclaration.typeParameters = func.typeParameters
      }

      // Preserve TypeScript return type annotation
      if (func.returnType) {
        functionDeclaration.returnType = func.returnType
      }

      // Preserve comments from the original variable declaration
      if (node.comments) {
        functionDeclaration.comments = node.comments
      }
      if (node.leadingComments) {
        functionDeclaration.leadingComments = node.leadingComments
      }
      if (node.trailingComments) {
        functionDeclaration.trailingComments = node.trailingComments
      }

      j(path).replaceWith(functionDeclaration)

      modified = true
    })

  return modified
}
