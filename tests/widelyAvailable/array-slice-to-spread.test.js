import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("arraySliceToSpread", () => {
    test("arr.slice(0) - should not transform unknown identifier", () => {
      const result = transform(`const copy = arr.slice(0);`)

      assert(!result.modified, "skip arr.slice(0) on unknown identifier")
    })

    test("arr.slice() - should not transform unknown identifier", () => {
      const result = transform(`const copy = arr.slice();`)

      assert(!result.modified, "skip arr.slice() on unknown identifier")
    })

    test("array literal.slice(0)", () => {
      const result = transform(`const copy = [1, 2, 3].slice(0);`)

      assert(result.modified, "transform array literal.slice(0)")
      assert.match(result.code, /const copy = \[\.\..\[1, 2, 3\]\]/)
    })

    test("array literal.slice()", () => {
      const result = transform(`const copy = [1, 2, 3].slice();`)

      assert(result.modified, "transform array literal.slice()")
      assert.match(result.code, /const copy = \[\.\..\[1, 2, 3\]\]/)
    })

    test("arr.map().slice(0) - should not transform unknown chain", () => {
      const result = transform(`const copy = arr.map(x => x * 2).slice(0);`)

      assert(!result.modified, "skip slice on unknown method chain")
    })

    test("arr.filter().slice() - should not transform unknown chain", () => {
      const result = transform(`const copy = items.filter(x => x > 5).slice();`)

      assert(!result.modified, "skip slice on unknown method chain")
    })

    test("Array.from().slice(0)", () => {
      const result = transform(`const copy = Array.from(iterable).slice(0);`)

      assert(result.modified, "transform slice on Array.from()")
      // Note: Array.from() is transformed first to [...iterable], then .slice(0) transforms that
      assert.match(result.code, /const copy = \[\.\..\[\.\.\.iterable\]\]/)
    })

    test("new Array().slice()", () => {
      const result = transform(`const copy = new Array(5).slice();`)

      assert(result.modified, "transform slice on new Array()")
      assert.match(result.code, /const copy = \[\.\.\.new Array\(5\)\]/)
    })

    test("string literal split.slice(0)", () => {
      const result = transform(`const copy = "a,b,c".split(',').slice(0);`)

      assert(result.modified, "transform slice on string split result")
      assert.match(result.code, /const copy = \[\.\.\./)
      assert.match(result.code, /split\(','\)\]/)
    })

    test("arr.slice(1) - should not transform", () => {
      const result = transform(`const rest = arr.slice(1);`)

      assert(!result.modified, "skip arr.slice(1)")
    })

    test("arr.slice(0, 5) - should not transform", () => {
      const result = transform(`const partial = arr.slice(0, 5);`)

      assert(!result.modified, "skip arr.slice(0, 5)")
    })

    test("arr.slice(1, 3) - should not transform", () => {
      const result = transform(`const partial = arr.slice(1, 3);`)

      assert(!result.modified, "skip arr.slice(1, 3)")
    })

    test("string.slice(0) - should not transform", () => {
      const result = transform(`const copy = str.slice(0);`)

      assert(!result.modified, "skip string.slice(0)")
    })

    test("chained array methods with slice - should not transform", () => {
      const result = transform(
        `const result = arr.map(x => x * 2).filter(x => x > 5).slice(0);`,
      )

      assert(!result.modified, "skip slice on unknown method chain")
    })

    test("slice in arrow function - transforms arrow to function", () => {
      const result = transform(`const fn = arr => arr.map(x => x).slice(0);`)

      assert(result.modified, "transform arrow function to named function")
      assert.match(result.code, /function fn\(arr\)/)
      // slice(0) on method chain is not transformed
      assert.match(result.code, /arr\.map\(x => x\)\.slice\(0\)/)
    })

    test("multiple slice calls", () => {
      const result = transform(`const a = [1,2].slice(), b = [3,4].slice(0);`)

      assert(result.modified, "transform multiple slices")
      assert.match(result.code, /const a = \[\.\..\[1, ?2\]\]/)
      assert.match(result.code, /b = \[\.\..\[3, ?4\]\]/)
    })
  })
})
