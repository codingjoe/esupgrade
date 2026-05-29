import { default as j } from "jscodeshift"
import { NodeTest } from "../types.js"

const REGEXP_META_CHARACTERS = /[\\^$.*+?()[\]{}|]/

function isKnownString(node) {
  return new NodeTest(node).hasIndexOfAndIncludes()
}

function isStringLiteralNode(node) {
  return (
    (j.StringLiteral.check(node) || j.Literal.check(node)) &&
    typeof node.value === "string"
  )
}

function isEmptyString(node) {
  if (isStringLiteralNode(node)) {
    return node.value === ""
  }

  return (
    j.TemplateLiteral.check(node) &&
    node.expressions.length === 0 &&
    node.quasis.length === 1 &&
    node.quasis[0].value.cooked === ""
  )
}

function isFunctionExpression(node) {
  return j.FunctionExpression.check(node) || j.ArrowFunctionExpression.check(node)
}

function isSplitCall(node) {
  return (
    j.CallExpression.check(node) &&
    j.MemberExpression.check(node.callee) &&
    j.Identifier.check(node.callee.property) &&
    node.callee.property.name === "split"
  )
}

function isJoinCall(node) {
  return (
    j.CallExpression.check(node) &&
    j.MemberExpression.check(node.callee) &&
    j.Identifier.check(node.callee.property) &&
    node.callee.property.name === "join"
  )
}

function isReplaceCall(node) {
  return (
    j.CallExpression.check(node) &&
    j.MemberExpression.check(node.callee) &&
    j.Identifier.check(node.callee.property) &&
    node.callee.property.name === "replace"
  )
}

function isLiteralGlobalRegExp(node) {
  return (
    j.RegExpLiteral.check(node) &&
    node.flags === "g" &&
    !REGEXP_META_CHARACTERS.test(node.pattern)
  )
}

function extractReplaceAllComponents(node) {
  if (isJoinCall(node)) {
    const splitCall = node.callee.object

    if (
      !isSplitCall(splitCall) ||
      splitCall.arguments.length !== 1 ||
      node.arguments.length !== 1 ||
      !isKnownString(splitCall.callee.object) ||
      isEmptyString(splitCall.arguments[0]) ||
      isFunctionExpression(node.arguments[0])
    ) {
      return null
    }

    return {
      receiver: splitCall.callee.object,
      searchValue: splitCall.arguments[0],
      replaceValue: node.arguments[0],
    }
  }

  if (
    !isReplaceCall(node) ||
    node.arguments.length !== 2 ||
    !isKnownString(node.callee.object)
  ) {
    return null
  }

  const searchValue = node.arguments[0]

  if (!isLiteralGlobalRegExp(searchValue) || isFunctionExpression(node.arguments[1])) {
    return null
  }

  return {
    receiver: node.callee.object,
    searchValue: j.stringLiteral(searchValue.pattern),
    replaceValue: node.arguments[1],
  }
}

/**
 * Transform string replacement patterns to replaceAll().
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll
 */
export function replaceAll(root) {
  let modified = false

  root.find(j.CallExpression).forEach((path) => {
    const replaceAllComponents = extractReplaceAllComponents(path.node)

    if (!replaceAllComponents) {
      return
    }

    j(path).replaceWith(
      j.callExpression(
        j.memberExpression(
          replaceAllComponents.receiver,
          j.identifier("replaceAll"),
          false,
        ),
        [replaceAllComponents.searchValue, replaceAllComponents.replaceValue],
      ),
    )

    modified = true
  })

  return modified
}
replaceAll.baselineDate = new Date(Date.UTC(2020, 7, 27))
