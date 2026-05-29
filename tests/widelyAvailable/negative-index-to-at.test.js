import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("negativeIndexToAt", () => {
    describe("transformable patterns", () => {
      test("last element with literal 1", () => {
        assert.match(
          transform(`const last = arr[arr.length - 1];`).code,
          /arr\.at\(-1\)/,
        )
      })

      test("second to last with literal 2", () => {
        assert.match(
          transform(`const item = arr[arr.length - 2];`).code,
          /arr\.at\(-2\)/,
        )
      })

      test("variable offset", () => {
        assert.match(
          transform(`const item = arr[arr.length - n];`).code,
          /arr\.at\(-n\)/,
        )
      })

      test("member expression object", () => {
        assert.match(
          transform(`const last = obj.arr[obj.arr.length - 1];`).code,
          /obj\.arr\.at\(-1\)/,
        )
      })

      test("removes length-based indexing", () => {
        assert.doesNotMatch(
          transform(`const last = arr[arr.length - 1];`).code,
          /arr\.length/,
        )
      })
    })

    describe("skip patterns", () => {
      test("skip different objects", () => {
        const result = transform(`const x = arr[other.length - 1];`)
        assert(!result.modified)
      })

      test("skip zero offset", () => {
        const result = transform(`const x = arr[arr.length - 0];`)
        assert(!result.modified)
      })

      test("skip negative literal on right side", () => {
        const result = transform(`const x = arr[arr.length - -1];`)
        assert(!result.modified)
      })

      test("skip non-subtraction operator", () => {
        const result = transform(`const x = arr[arr.length + 1];`)
        assert(!result.modified)
      })

      test("skip non-length property", () => {
        const result = transform(`const x = arr[arr.size - 1];`)
        assert(!result.modified)
      })

      test("skip non-computed length access", () => {
        const result = transform(`const x = arr[arr["length"] - 1];`)
        assert(!result.modified)
      })

      test("skip simple positive index", () => {
        const result = transform(`const x = arr[0];`)
        assert(!result.modified)
      })
    })
  })
})
