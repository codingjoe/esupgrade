import jscodeshift from "jscodeshift"
import * as newlyAvailable from "./newlyAvailable.js"
import { parseTypeScript } from "./parser.js"
import { matchesPrefilter } from "./prefilters.js"
import * as widelyAvailable from "./widelyAvailable.js"

/**
 * Transformer function type.
 *
 * @typedef {function(import('jscodeshift').Collection): boolean} Transformer
 */

/**
 * Named transformer, keyed by the name it is exported under.
 *
 * @typedef {[string, Transformer]} NamedTransformer
 */

/**
 * Result of a transformation.
 *
 * @typedef {Object} TransformResult
 * @property {string} code - The transformed code
 * @property {boolean} modified - Whether the code was modified
 */

/**
 * Apply transformers to code recursively until no changes occur.
 *
 * @param {string} code - The source code to transform.
 * @param {import('jscodeshift').JSCodeshift} j - jscodeshift instance.
 * @param {NamedTransformer[]} transformers - Named transformer functions.
 * @param {boolean} globalModified - Whether any modifications have occurred.
 * @returns {TransformResult} Object with transformed code and modification status.
 */
function applyTransformersRecursively(code, j, transformers, globalModified = false) {
  const root = j(code)
  let passModified = false

  for (const [name, transformer] of transformers) {
    if (!matchesPrefilter(name, code)) {
      continue
    }

    passModified = transformer(root) || passModified
  }

  if (passModified) {
    return applyTransformersRecursively(root.toSource(), j, transformers, passModified)
  }

  return {
    code,
    modified: globalModified,
  }
}

/**
 * Transform JavaScript or TypeScript code using the specified transformers.
 *
 * TypeScript declaration files parse in the declaration context, which accepts
 * ambient declarations such as a `const` without initializer.
 *
 * @param {string} code - The source code to transform.
 * @param {string} baseline - Baseline level ('widely-available' or 'newly-available').
 * @returns {TransformResult} Object with transformed code and modification status.
 */
export function transform(code, baseline = "widely-available") {
  const j = jscodeshift.withParser({ parse: parseTypeScript })

  const transformers =
    baseline === "newly-available"
      ? { ...widelyAvailable, ...newlyAvailable }
      : widelyAvailable

  return applyTransformersRecursively(code, j, Object.entries(transformers))
}
