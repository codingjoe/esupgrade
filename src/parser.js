import { parse } from "@babel/parser"
// The TypeScript JSX parser of jscodeshift ignores custom options.
import typeScriptOptions from "jscodeshift/parser/tsOptions.js"

const removedPlugins = new Set(["pipelineOperator"])

const typeScriptPlugins = typeScriptOptions.plugins.filter(isSupportedPlugin)

const standardOptions = {
  ...typeScriptOptions,
  plugins: ["jsx", ...typeScriptPlugins],
}

/**
 * Parser options without JSX, which accept generic arrow functions carrying a
 * single unconstrained type parameter. The JSX parser reads such a parameter as
 * a JSX element, for example in `<T>(value: T) => value`.
 */
const typeScriptOnlyOptions = {
  ...typeScriptOptions,
  plugins: typeScriptPlugins,
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
 * Parser option sets, tried in order until one accepts the source.
 */
const parserContexts = [standardOptions, declarationOptions, typeScriptOnlyOptions]

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
 * Get the name of a Babel parser plugin entry.
 *
 * @param {string | [string, Object]} plugin - Babel parser plugin entry.
 * @returns {string} Plugin name.
 */
function getPluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin
}

/**
 * Check whether @babel/parser accepts a plugin entry inherited from jscodeshift.
 *
 * @param {string | [string, Object]} plugin - Babel parser plugin entry.
 * @returns {boolean} Whether the parser accepts the plugin entry.
 */
function isSupportedPlugin(plugin) {
  return !removedPlugins.has(getPluginName(plugin))
}

/**
 * Parse TypeScript source, retrying in each remaining context when a context
 * rejects it. Keep the standard context error when every context fails.
 *
 * @param {string} code - Source code to parse.
 * @returns {import("@babel/parser").ParseResult<import("@babel/types").File>} Parsed Babel syntax tree.
 */
export function parseTypeScript(code) {
  const [standardContext, ...fallbackContexts] = parserContexts

  try {
    return parse(code, standardContext)
  } catch (error) {
    return parseInContexts(code, fallbackContexts, error)
  }
}

/**
 * Parse source in the first context that accepts it, reporting the standard
 * context error when every context rejects the source.
 *
 * @param {string} code - Source code to parse.
 * @param {Object[]} contexts - Parser option sets, tried in order.
 * @param {Error} standardError - Error of the standard context.
 * @returns {import("@babel/parser").ParseResult<import("@babel/types").File>} Parsed Babel syntax tree.
 */
function parseInContexts(code, contexts, standardError) {
  const [context, ...remaining] = contexts

  try {
    return parse(code, context)
  } catch {
    if (remaining.length === 0) {
      throw standardError
    }

    return parseInContexts(code, remaining, standardError)
  }
}
