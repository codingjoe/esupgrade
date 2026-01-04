import jscodeshift from "jscodeshift"
import * as widelyAvailable from "./widelyAvailable.js"
import * as newlyAvailable from "./newlyAvailable.js"

/**
 * Result of a transformation.
 * @typedef {Object} TransformResult
 * @property {string} code - The transformed code
 * @property {boolean} modified - Whether the code was modified
 */

/**
 * Transform JavaScript code using the specified transformers.
 * @param {string} code - The source code to transform.
 * @param {string} baseline - Baseline level ('widely-available' or 'newly-available').
 * @returns {TransformResult} Object with transformed code and modification status.
 */
export function transform(code, baseline = "widely-available") {
  const j = jscodeshift.withParser("tsx")
  const root = j(code)

  let modified = false

  const transformers =
    baseline === "newly-available"
      ? { ...widelyAvailable, ...newlyAvailable }
      : widelyAvailable

  for (const transformer of Object.values(transformers)) {
    const wasModified = transformer(j, root)
    if (wasModified) {
      modified = true
    }
  }

  return {
    code: root.toSource(),
    modified,
  }
}
