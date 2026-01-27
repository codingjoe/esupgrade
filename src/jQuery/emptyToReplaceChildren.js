import { default as j } from "jscodeshift"
import { isJQueryObject } from "./utils.js"

/**
 * Replace $(el).empty() with el.replaceChildren() fallback to innerHTML = ''.
 *
 * @param {import('jscodeshift').Collection} root - The root AST collection.
 * @returns {boolean} True if code was modified.
 */
export function emptyToReplaceChildren(root) {
  let modified = false
  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .forEach((path) => {
      const { node } = path
      const member = node.callee
      if (!member.property || member.property.name !== "empty") return

      if (!isJQueryObject(root, member.object)) return

      // Use replaceChildren() when available, else innerHTML = ''
      const call = j.callExpression(
        j.memberExpression(member.object, j.identifier("replaceChildren")),
        [],
      )
      // We will conservatively use replaceChildren(); if environment doesn't support it user must polyfill
      j(path).replaceWith(call)
      modified = true
    })
  return modified
}
