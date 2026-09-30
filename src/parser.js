import { parse } from "@babel/parser"
// The TypeScript JSX parser of jscodeshift ignores custom options.
import typeScriptOptions from "jscodeshift/parser/tsOptions.js"

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
 * Parse TypeScript source, retrying in the declaration context when the standard
 * context rejects it. Keep the standard context error when both contexts fail.
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
