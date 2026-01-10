import { default as j } from "jscodeshift"

/**
 * Remove 'use strict' directives from modules. Modules are strict by default, making
 * these directives redundant.
 *
 * @param {import("jscodeshift").Collection} root - The root AST collection
 * @returns {boolean} True if code was modified
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode#strict_mode_for_modules
 */
export function removeUseStrictFromModules(root) {
  let modified = false

  // Check if the file is a module by looking for import/export statements
  const hasImports = root.find(j.ImportDeclaration).length > 0
  const hasExports =
    root.find(j.ExportNamedDeclaration).length > 0 ||
    root.find(j.ExportDefaultDeclaration).length > 0 ||
    root.find(j.ExportAllDeclaration).length > 0

  const isModule = hasImports || hasExports

  // Only proceed if this is a module
  if (!isModule) {
    return modified
  }

  // Find and remove 'use strict' directives
  root.find(j.Program).forEach((programPath) => {
    const program = programPath.node

    // Check directives array (Babel/TSX parser stores directives here)
    if (program.directives && Array.isArray(program.directives)) {
      let i = 0
      while (i < program.directives.length) {
        const directive = program.directives[i]
        if (directive.value && directive.value.value === "use strict") {
          // This is a 'use strict' directive - remove it
          program.directives.splice(i, 1)
          modified = true
          // Don't increment i since we removed an element
        } else {
          i++
        }
      }
    }

    // Note: 'use strict' directives are typically stored in program.directives (for example with the tsx parser).
    // This transformer currently only handles directives represented in the directives array, not as body expressions.
  })

  return modified
}
