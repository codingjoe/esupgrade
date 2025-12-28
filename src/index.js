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
 * Transform JavaScript code using the specified transformers
 * @param {string} code - The source code to transform
 * @param {string} baseline - Baseline level ('widely-available' or 'newly-available')
 * @returns {TransformResult} - Object with { code, modified, changes }
 */
export function transform(code, baseline = "widely-available") {
  const j = jscodeshift.withParser("tsx")
  const root = j(code)

  let modified = false
  const allChanges = []
  let transformers = widelyAvailable
  if (baseline === "newly-available")
    transformers = { ...widelyAvailable, ...newlyAvailable }
  for (const name in transformers) {
    const result = transformers[name](j, root)
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
