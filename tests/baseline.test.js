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
  result.setMonth(result.getMonth() + 30)
  return result
}

const currentReleaseDate = new Date("2025-01-01")

suite("baseline", () => {
  test("all transformers have a baselineDate", () => {
    for (const [name, transformer] of Object.entries({
      ...widelyAvailable,
      ...newlyAvailable,
    })) {
      assert(transformer.baselineDate, `${name} must have a baselineDate`)
    }
  })

  test("widelyAvailable transformers have been released for at least 30 months", () => {
    for (const [name, transformer] of Object.entries(widelyAvailable)) {
      assert(
        widelyAvailableAt(new Date(transformer.baselineDate)) <= currentReleaseDate,
        `${name} (${transformer.baselineDate}) should be released for at least 30 months`,
      )
    }
  })

  test("newlyAvailable transformers are not yet widely available", () => {
    for (const [name, transformer] of Object.entries(newlyAvailable)) {
      assert(
        widelyAvailableAt(new Date(transformer.baselineDate)) > currentReleaseDate,
        `${name} (${transformer.baselineDate}) should be moved to widelyAvailable`,
      )
    }
  })
})
