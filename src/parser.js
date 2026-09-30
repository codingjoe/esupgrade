import { parse } from "@babel/parser"
// The TypeScript JSX parser of jscodeshift ignores custom options, so esupgrade parses
// with @babel/parser directly and reuses the plugin options to accept the same syntax.
import typeScriptOptions from "jscodeshift/parser/tsOptions.js"

/**
 * Parser options for source files in the standard TypeScript context.
 */
const standardOptions = {
  ...typeScriptOptions,
  plugins: ["jsx", ...typeScriptOptions.plugins],
}

/**
 * Parser options for TypeScript declaration files, which accept ambient
 * declarations such as a `const` without initializer.
 */
const declarationOptions = {
  ...standardOptions,
  plugins: standardOptions.plugins.map(enableDeclarationContext),
}

/**
 * Enable the declaration context of the TypeScript plugin.
 *
 * @param {string | [string, Object]} plugin - Babel parser plugin entry.
 * @returns {string | [string, Object]} Plugin entry using the declaration context.
 */
function enableDeclarationContext(plugin) {
  return plugin === "typescript" ? ["typescript", { dts: true }] : plugin
}

/**
 * Parse TypeScript source, retrying in the declaration context when the
 * standard context rejects it. Rethrow the standard context error when both
 * contexts fail, so code that already fails to parse reports the same error.
 *
 * @param {string} code - Source code to parse.
 * @returns {import("@babel/parser").ParseResult<import("@babel/types").File>} Parsed Babel syntax tree.
 */
export function parseTypeScript(code) {
  try {
    return parse(code, standardOptions)
  } catch (error) {
    try {
      return parse(code, declarationOptions)
    } catch {
      throw error
    }
  }
}
