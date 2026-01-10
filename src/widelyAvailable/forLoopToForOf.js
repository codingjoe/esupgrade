import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

/**
 * Transform traditional for loops to for...of where safe. Converts: for (let i = 0; i <
 * arr.length; i++) { const item = arr[i]; ... } To: for (const item of arr) { ... }
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
 */
export function forLoopToForOf(root) {
  let modified = false

  root
    .find(j.ForStatement)
    .filter((path) => {
      const node = path.node

      // Check init: must be let/const i = 0
      if (!j.VariableDeclaration.check(node.init)) {
        return false
      }
      if (node.init.declarations.length !== 1) {
        return false
      }
      const initDeclarator = node.init.declarations[0]
      if (!j.Identifier.check(initDeclarator.id)) {
        return false
      }
      const indexVar = initDeclarator.id.name
      if (!j.Literal.check(initDeclarator.init) || initDeclarator.init.value !== 0) {
        return false
      }

      // Check test: must be i < arr.length
      if (!j.BinaryExpression.check(node.test)) {
        return false
      }
      if (node.test.operator !== "<") {
        return false
      }
      if (!j.Identifier.check(node.test.left) || node.test.left.name !== indexVar) {
        return false
      }
      if (!j.MemberExpression.check(node.test.right)) {
        return false
      }
      if (
        !j.Identifier.check(node.test.right.property) ||
        node.test.right.property.name !== "length"
      ) {
        return false
      }
      if (!j.Identifier.check(node.test.right.object)) {
        return false
      }
      const arrayVar = node.test.right.object.name

      // Check update: must be i++ or ++i
      if (j.UpdateExpression.check(node.update)) {
        if (
          !j.Identifier.check(node.update.argument) ||
          node.update.argument.name !== indexVar ||
          node.update.operator !== "++"
        ) {
          return false
        }
      } else {
        return false
      }

      // Check body: must be a block statement
      if (!j.BlockStatement.check(node.body)) {
        return false
      }

      // Look for first statement that assigns arr[i] to a variable
      if (node.body.body.length === 0) {
        return false
      }

      const firstStmt = node.body.body[0]
      if (!j.VariableDeclaration.check(firstStmt)) {
        return false
      }
      if (firstStmt.declarations.length !== 1) {
        return false
      }
      const varDeclarator = firstStmt.declarations[0]
      if (!j.Identifier.check(varDeclarator.id)) {
        return false
      }
      if (!j.MemberExpression.check(varDeclarator.init)) {
        return false
      }
      if (
        !j.Identifier.check(varDeclarator.init.object) ||
        varDeclarator.init.object.name !== arrayVar
      ) {
        return false
      }
      if (
        !j.Identifier.check(varDeclarator.init.property) ||
        varDeclarator.init.property.name !== indexVar ||
        varDeclarator.init.computed !== true
      ) {
        return false
      }

      // Check that the index variable is not used elsewhere in the body
      const bodyWithoutFirst = node.body.body.slice(1)
      const indexVarUsed = bodyWithoutFirst.some((stmt) =>
        new NodeTest(stmt).usesIdentifier(indexVar),
      )

      return !indexVarUsed
    })
    .forEach((path) => {
      const node = path.node
      const arrayVar = node.test.right.object.name
      const itemVar = node.body.body[0].declarations[0].id.name
      const itemKind = node.body.body[0].kind

      // Create new body without the first declaration
      const newBody = j.blockStatement(node.body.body.slice(1))

      // Create for...of loop
      const forOfLoop = j.forOfStatement(
        j.variableDeclaration(itemKind, [j.variableDeclarator(j.identifier(itemVar))]),
        j.identifier(arrayVar),
        newBody,
      )

      j(path).replaceWith(forOfLoop)

      modified = true
    })

  return modified
}
