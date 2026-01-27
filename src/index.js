import jscodeshift from "jscodeshift"
import * as newlyAvailable from "./newlyAvailable.js"
import * as widelyAvailable from "./widelyAvailable.js"
import * as jQueryTransformers from "./jQuery.js"

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
 * @param {Object} transformers - Transformer functions.
 * @param {boolean} globalModified - Whether any modifications have occurred.
 * @returns {TransformResult} Object with transformed code and modification status.
 */
function applyTransformersRecursively(code, j, transformers, globalModified) {
  const root = j(code)
  let passModified = false

  for (const transformer of Object.values(transformers)) {
    if (transformer(root)) {
      passModified = true
    }
  }

  switch (passModified) {
    case true:
      return applyTransformersRecursively(
        root.toSource(),
        j,
        transformers,
        true,
      )
    default:
      return {
        code,
        modified: globalModified,
      }
  }
}

/**
 * Transform JavaScript code using the specified transformers.
 *
 * @param {string} code - The source code to transform.
 * @param {string} baseline - Baseline level ('widely-available' or 'newly-available').
 * @param {boolean} jQuery - Whether to include jQuery transformers.
 * @returns {TransformResult} Object with transformed code and modification status.
 */
export function transform(code, baseline = "widely-available", jQuery) {
  const j = jscodeshift.withParser("tsx")

  let transformers =
    baseline === "newly-available"
      ? { ...widelyAvailable, ...newlyAvailable }
      : widelyAvailable

  if (jQuery) {
    transformers = { ...transformers, ...jQueryTransformers }
  }

  return applyTransformersRecursively(code, j, transformers, false)
}
