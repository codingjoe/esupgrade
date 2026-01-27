import { default as j } from "jscodeshift"

/**
 * Transform $(el).prop('checked') to el.checked, and setter to assignment.
 * Only applies when the inner target can be proven to be a single HTMLElement
 * (for example document.querySelector(...) or document.getElementById(...)
 * or an identifier initialized from such a call). Avoid transforming when the
 * argument is a selector string or otherwise unknown.
 *
 * @param {import('jscodeshift').Collection} root
 * @returns {boolean}
 */
export function propToDirectProperty(root) {
  let modified = false

  function getRootIdentifierName(memberExpr) {
    let node = memberExpr
    while (j.MemberExpression.check(node)) {
      node = node.object
    }
    if (j.Identifier.check(node)) return node.name
    return null
  }

  function isDocumentSingleElementCall(node) {
    if (!j.CallExpression.check(node)) return false
    const callee = node.callee
    if (!j.MemberExpression.check(callee)) return false
    // property must be querySelector or getElementById
    if (!j.Identifier.check(callee.property)) return false
    if (!["querySelector", "getElementById"].includes(callee.property.name))
      return false
    // walk to root identifier (allow window.document.querySelector)
    const rootName = getRootIdentifierName(callee)
    return rootName === "document"
  }

  function resolveToSingleElement(root, node) {
    // Direct call like document.querySelector(...) or document.getElementById(...)
    if (isDocumentSingleElementCall(node)) return node

    // If it's an identifier, try to find its declaration and inspect init
    if (j.Identifier.check(node)) {
      const name = node.name
      const decls = root.find(j.VariableDeclarator, { id: { name } })
      if (decls.size() === 0) return null
      let init = null
      decls.forEach((p) => {
        if (!init) init = p.node.init
      })
      if (init && isDocumentSingleElementCall(init)) return init
    }

    return null
  }

  const allowedProps = new Set([
    "checked",
    "value",
    "disabled",
    "htmlFor",
    "id",
    "name",
    "className",
    "textContent",
    "innerHTML",
    "selected",
    "required",
    "readOnly",
  ])

  const propNameMap = new Map([["for", "htmlFor"]])

  root
    .find(j.CallExpression, {
      callee: { type: "MemberExpression" },
    })
    .filter((path) => {
      const node = path.node
      const member = node.callee
      if (!member.property || member.property.name !== "prop") return false
      if (!node.arguments || node.arguments.length === 0) return false

      const obj = member.object
      let target = null

      // Handle direct jQuery call
      if (
        j.CallExpression.check(obj) &&
        j.Identifier.check(obj.callee) &&
        (obj.callee.name === "$" || obj.callee.name === "jQuery")
      ) {
        target = obj.arguments?.[0]
        if (!target) return false

        // Do not transform when the argument is a selector string.
        if (
          (target.type === "Literal" && typeof target.value === "string") ||
          target.type === "StringLiteral"
        ) {
          return false
        }
      }

      // Handle identifier alias (like $el)
      if (j.Identifier.check(obj)) {
        // For identifiers, we need to resolve them but also check if they point to single elements
        // This is handled below
        target = obj
      }

      if (!target) return false

      // Resolve the target to a single-element-producing expression, if possible.
      const resolved = resolveToSingleElement(root, target)
      if (!resolved) return false

      // Ensure the requested property is a literal and maps to a known HTMLElement property
      const propArg = node.arguments[0]
      if (!propArg || !(propArg.type === "Literal" || propArg.type === "StringLiteral"))
        return false
      const rawProp = propArg.value
      const mapped = propNameMap.has(rawProp) ? propNameMap.get(rawProp) : rawProp
      if (!allowedProps.has(mapped)) return false

      // Attach resolved and mapped info for use in the forEach
      path.__resolvedTarget = resolved
      path.__mappedProp = mapped
      return true
    })
    .forEach((path) => {
      const node = path.node
      // resolvedTarget may be a CallExpression (document.querySelector(...))
      // or an Identifier init; use the original target expression where possible
      const obj = node.callee.object
      const target = path.__resolvedTarget || obj.arguments[0]

      if (node.arguments.length === 1) {
        const replacement = j.memberExpression(target, j.identifier(path.__mappedProp))
        j(path).replaceWith(replacement)
        modified = true
      } else if (node.arguments.length === 2) {
        const assignment = j.assignmentExpression(
          "=",
          j.memberExpression(target, j.identifier(path.__mappedProp)),
          node.arguments[1],
        )
        j(path).replaceWith(assignment)
        modified = true
      }
    })
  return modified
}
