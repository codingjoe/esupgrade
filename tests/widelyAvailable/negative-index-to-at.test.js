import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("negativeIndexToAt", () => {
    describe("transformable patterns", () => {
      test("last element with literal 1", () => {
        assert.match(
          transform(`const last = Array.of(1, 2, 3)[Array.of(1, 2, 3).length - 1];`)
            .code,
          /Array\.of\(1, 2, 3\)\.at\(-1\)/,
        )
      })

      test("second to last with literal 2", () => {
        assert.match(
          transform(`const item = Array.of(1, 2, 3)[Array.of(1, 2, 3).length - 2];`)
            .code,
          /Array\.of\(1, 2, 3\)\.at\(-2\)/,
        )
      })

      test("variable offset", () => {
        assert.match(
          transform(`const item = Array.of(1, 2, 3)[Array.of(1, 2, 3).length - n];`)
            .code,
          /Array\.of\(1, 2, 3\)\.at\(-n\)/,
        )
      })

      test("removes length-based indexing", () => {
        assert.doesNotMatch(
          transform(`const last = Array.of(1, 2, 3)[Array.of(1, 2, 3).length - 1];`)
            .code,
          /\.length/,
        )
      })
    })

    describe("skip patterns", () => {
      test("skip unknown receiver", () => {
        const result = transform(`const x = arr[arr.length - 1];`)
        assert(!result.modified)
      })

      test("skip different objects", () => {
        const result = transform(
          `const x = Array.of(1, 2, 3)[Array.of(1, 2).length - 1];`,
        )
        assert(!result.modified)
      })

      test("skip zero offset", () => {
        const result = transform(
          `const x = Array.of(1, 2, 3)[Array.of(1, 2, 3).length - 0];`,
        )
        assert(!result.modified)
      })

      test("skip negative literal on right side", () => {
        const result = transform(
          `const x = Array.of(1, 2, 3)[Array.of(1, 2, 3).length - -1];`,
        )
        assert(!result.modified)
      })

      test("skip non-subtraction operator", () => {
        const result = transform(
          `const x = Array.of(1, 2, 3)[Array.of(1, 2, 3).length + 1];`,
        )
        assert(!result.modified)
      })

      test("skip non-length property", () => {
        const result = transform(
          `const x = Array.of(1, 2, 3)[Array.of(1, 2, 3).size - 1];`,
        )
        assert(!result.modified)
      })

      test("skip non-computed length access", () => {
        const result = transform(
          `const x = Array.of(1, 2, 3)[Array.of(1, 2, 3)["length"] - 1];`,
        )
        assert(!result.modified)
      })

      test("skip simple positive index", () => {
        const result = transform(`const x = arr[0];`)
        assert(!result.modified)
      })
    })
  })
})
