import jscodeshift from "jscodeshift"
import * as widelyAvailable from "./widelyAvailable.js"
import * as newlyAvailable from "./newlyAvailable.js"

/**
 * Result of a transformation.
 * @typedef {Object} TransformResult
 * @property {string} code - The transformed code
 * @property {boolean} modified - Whether the code was modified
 * @property {Array} changes - List of changes made
 */

/**
 * Transform JavaScript code using the specified transformers.
 * @param {string} code - The source code to transform.
 * @param {string} baseline - Baseline level ('widely-available' or 'newly-available').
 * @returns {TransformResult} Object with transformed code, modification status, and changes.
 */
export function transform(code, baseline = "widely-available") {
  const j = jscodeshift.withParser("tsx")
  const root = j(code)

  let modified = false
  const allChanges = []

  const transformers =
    baseline === "newly-available"
      ? { ...widelyAvailable, ...newlyAvailable }
      : widelyAvailable

  for (const transformer of Object.values(transformers)) {
    const result = transformer(j, root)
    if (result.modified) {
      modified = true
      allChanges.push(...result.changes)
    }
  }

  return {
    code: root.toSource(),
    modified,
    changes: allChanges,
  }
}
