import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("arrayConcatToSpread", () => {
    test("[].concat(other)", () => {
      const result = transform(`const result = [1, 2].concat(other);`)

      assert(result.modified, "transform [].concat(other)")
      assert.match(result.code, /\[\.\..\[1, 2\], \.\.\.other\]/)
    })

    test("[].concat([1, 2, 3])", () => {
      const result = transform(`const result = [].concat([1, 2, 3]);`)

      assert(result.modified, "transform [].concat() with array literal")
      assert.match(result.code, /\[\.\..\[\], \.\.\.\[1, 2, 3\]\]/)
    })

    test("[].concat(item1, item2, item3)", () => {
      const result = transform(`const result = [].concat(other1, other2, other3);`)

      assert(result.modified, "transform [].concat() with multiple arguments")
      assert.match(
        result.code,
        /\[\.\..\[\], \.\.\.other1, \.\.\.other2, \.\.\.other3\]/,
      )
    })

    test("in expression", () => {
      const result = transform(`const length = [].concat(other).length;`)

      assert(result.modified, "transform concat in expression")
      assert.match(result.code, /\[\.\..\[\], \.\.\.other\]\.length/)
    })

    test("with method call result", () => {
      const result = transform(`const result = [].concat(getItems());`)

      assert(result.modified, "transform concat with method call result")
      assert.match(result.code, /\[\.\..\[\], \.\.\.getItems\(\)\]/)
    })

    test("no arguments", () => {
      const result = transform(`const copy = arr.concat();`)

      assert(!result.modified, "skip concat with no arguments")
    })
    test("in arrow function", () => {
      const result = transform(`const fn = (arr, other) => [1, 2].concat(other);`)

      assert(result.modified, "transform concat in arrow function")
      assert.match(result.code, /\[\.\..\[1, 2\], \.\.\.other\]/)
    })

    test("nested array", () => {
      const result = transform(`const result = [[1, 2]].concat([[3, 4]]);`)

      assert(result.modified, "transform nested array with concat")
      assert.match(result.code, /\[\.\..\[\[1, 2\]\], \.\.\.\[\[3, 4\]\]\]/)
    })

    test("string.concat()", () => {
      const result = transform(`const result = str.concat("hello");`)

      assert(!result.modified, "skip string.concat()")
    })

    test("unknown identifier", () => {
      const result = transform(`const result = arr.concat(other);`)

      assert(!result.modified, "skip concat on unknown identifier")
    })

    test("array literal", () => {
      const result = transform(`const result = [1, 2, 3].concat([4, 5, 6]);`)

      assert(result.modified, "transform concat on array literal")
      assert.match(result.code, /\[\.\..\[1, 2, 3\], \.\.\.\[4, 5, 6\]\]/)
    })

    test("Array.from()", () => {
      const result = transform(`const result = Array.from(items).concat(more);`)

      assert(result.modified, "transform concat on Array.from()")
      assert.match(result.code, /\[\.\..\[\.\.\.items\], \.\.\.more\]/)
    })

    test("String.slice() result", () => {
      const result = transform(
        `const result = "lorem ipsum".slice(0, 10).concat(more);`,
      )

      assert(result.modified, "transform concat on String.slice() result")
      assert.match(result.code, /\[\.\.\."lorem ipsum"\.slice\(0, 10\), \.\.\.more\]/)
    })

    test("String.split() result", () => {
      const result = transform(`const result = "foo,bar".split(',').concat(more);`)

      assert(result.modified, "transform concat on String.split() result")
      assert.match(result.code, /\[\.\.\."foo,bar"\.split\(','\), \.\.\.more\]/)
    })

    test("new Array()", () => {
      const result = transform(`const result = new Array(5).concat(more);`)

      assert(result.modified, "transform concat on new Array()")
      assert.match(result.code, /\[\.\.\.new Array\(5\), \.\.\.more\]/)
    })
  })
})
