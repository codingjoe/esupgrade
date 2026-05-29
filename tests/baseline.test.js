import assert from "node:assert/strict"
import { suite, test } from "node:test"
import * as newlyAvailable from "../src/newlyAvailable.js"
import * as widelyAvailable from "../src/widelyAvailable.js"

/**
 * Calculate the date 30 months after the given date.
 *
 * @param {Date} date - The starting date.
 * @returns {Date} The date 30 months later.
 */
function widelyAvailableAt(date) {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() + 30)
  return result
}

const currentReleaseDate = new Date(Date.UTC(2025, 0, 1))

suite("baseline", () => {
  test("all transformers have a baselineDate", () => {
    for (const [name, transformer] of Object.entries({
      ...widelyAvailable,
      ...newlyAvailable,
    })) {
      assert(transformer.baselineDate instanceof Date, `${name} must have a baselineDate`)
    }
  })

  test("widelyAvailable transformers have been released for at least 30 months", () => {
    for (const [name, transformer] of Object.entries(widelyAvailable)) {
      assert(
        widelyAvailableAt(transformer.baselineDate) <= currentReleaseDate,
        `${name} (${transformer.baselineDate.toISOString().slice(0, 10)}) should be released for at least 30 months`,
      )
    }
  })

  test("newlyAvailable transformers are not yet widely available", () => {
    for (const [name, transformer] of Object.entries(newlyAvailable)) {
      assert(
        widelyAvailableAt(transformer.baselineDate) > currentReleaseDate,
        `${name} (${transformer.baselineDate.toISOString().slice(0, 10)}) should be moved to widelyAvailable`,
      )
    }
  })
})
