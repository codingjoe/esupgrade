import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("arrayFilterToFind", () => {
    test("array literal with named function", () => {
      const result = transform(`const first = [1, 2, 3].filter(isPositive)[0];`)

      assert(result.modified, "transform filter()[0] on array literal")
      assert.match(result.code, /\[1, 2, 3\]\.find\(isPositive\)/)
      assert.doesNotMatch(result.code, /filter/)
    })

    test("array literal with arrow function", () => {
      const result = transform(`const first = [1, 2, 3].filter(x => x > 0)[0];`)

      assert(result.modified, "transform filter()[0] with arrow function")
      assert.match(result.code, /\[1, 2, 3\]\.find\(x => x > 0\)/)
      assert.doesNotMatch(result.code, /filter/)
    })

    test("new Array() with predicate", () => {
      const result = transform(`const first = new Array(1, 2, 3).filter(fn)[0];`)

      assert(result.modified, "transform filter()[0] on new Array()")
      assert.match(result.code, /new Array\(1, 2, 3\)\.find\(fn\)/)
      assert.doesNotMatch(result.code, /filter/)
    })

    test("chained array method", () => {
      const result = transform(`const first = [1, 2, 3].map(x => x * 2).filter(fn)[0];`)

      assert(result.modified, "transform filter()[0] on chained array method")
      assert.match(result.code, /\.find\(fn\)/)
      assert.doesNotMatch(result.code, /filter/)
    })

    test("nested filter chain", () => {
      const result = transform(`const first = [1, 2, 3].filter(isEven).filter(fn)[0];`)

      assert(result.modified, "transform filter()[0] on nested filter chain")
      assert.match(result.code, /\.find\(fn\)/)
    })

    test("non-filter method with [0] - should not transform", () => {
      const result = transform(`const first = [1, 2, 3].sort(fn)[0];`)

      assert(!result.modified, "skip [0] access on non-filter method call")
    })

    test("function call result with [0] - should not transform", () => {
      const result = transform(`const first = getItems()[0];`)

      assert(!result.modified, "skip [0] access on plain function call result")
    })

    test("unknown identifier - should not transform", () => {
      const result = transform(`const first = arr.filter(fn)[0];`)

      assert(!result.modified, "skip filter()[0] on unknown identifier")
    })

    test("non-zero index - should not transform", () => {
      const result = transform(`const second = [1, 2, 3].filter(fn)[1];`)

      assert(!result.modified, "skip filter()[1] - not index 0")
    })

    test("variable index - should not transform", () => {
      const result = transform(`const item = [1, 2, 3].filter(fn)[n];`)

      assert(!result.modified, "skip filter()[n] - computed variable index")
    })

    test("no arguments to filter - should not transform", () => {
      const result = transform(`const first = [1, 2, 3].filter()[0];`)

      assert(!result.modified, "skip filter()[0] with no filter arguments")
    })

    test("two arguments to filter - should not transform", () => {
      const result = transform(`const first = [1, 2, 3].filter(fn, thisArg)[0];`)

      assert(!result.modified, "skip filter()[0] with two filter arguments")
    })
  })
})
