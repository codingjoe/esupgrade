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

  let currentCode = code
  let globalModified = false
  let passModified = true

  // Run transformers repeatedly until no further changes occur
  while (passModified) {
    passModified = false
    const root = j(currentCode)

    for (const transformer of Object.values(transformers)) {
      if (transformer(root)) {
        passModified = true
        globalModified = true
      }
    }

    if (passModified) {
      currentCode = root.toSource()
    }
  }

  return {
    code: currentCode,
    modified: globalModified,
  }
}
