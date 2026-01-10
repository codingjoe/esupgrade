import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("arrayFromToSpread", () => {
    test("Array.from() with map()", () => {
      const result = transform(`const doubled = Array.from(numbers).map(n => n * 2);`)

      assert(result.modified, "transform Array.from() with map()")
      assert.match(result.code, /\[\.\.\.numbers\]\.map/)
      assert.doesNotMatch(result.code, /Array\.from/)
    })

    test("Array.from() with filter()", () => {
      const result = transform(`const filtered = Array.from(items).filter(x => x > 5);`)

      assert(result.modified, "transform Array.from() with filter()")
      assert.match(result.code, /\[\.\.\.items\]\.filter/)
    })

    test("Array.from() with some()", () => {
      const result = transform(
        `const hasValue = Array.from(collection).some(item => item.active);`,
      )

      assert(result.modified, "transform Array.from() with some()")
      assert.match(result.code, /\[\.\.\.collection\]\.some/)
    })

    test("Array.from() with every()", () => {
      const result = transform(
        `const allValid = Array.from(items).every(x => x.valid);`,
      )

      assert(result.modified, "transform Array.from() with every()")
      assert.match(result.code, /\[\.\.\.items\]\.every/)
    })

    test("Array.from() with find()", () => {
      const result = transform(
        `const found = Array.from(elements).find(el => el.id === 'target');`,
      )

      assert(result.modified, "transform Array.from() with find()")
      assert.match(result.code, /\[\.\.\.elements\]\.find/)
    })

    test("Array.from() with reduce()", () => {
      const result = transform(
        `const sum = Array.from(values).reduce((a, b) => a + b, 0);`,
      )

      assert(result.modified, "transform Array.from() with reduce()")
      assert.match(result.code, /\[\.\.\.values\]\.reduce/)
    })

    test("standalone Array.from()", () => {
      const result = transform(`const arr = Array.from(iterable);`)

      assert(result.modified, "transform standalone Array.from()")
      assert.match(result.code, /const arr = \[\.\.\.iterable\]/)
    })

    test("Array.from() with property access", () => {
      const result = transform(`const length = Array.from(items).length;`)

      assert(result.modified, "transform Array.from() with property access")
      assert.match(result.code, /\[\.\.\.items\]\.length/)
    })

    test("Array.from().forEach() prioritizes over spread", () => {
      const result = transform(`Array.from(items).forEach(item => console.log(item));`)

      assert(result.modified, "prioritize over spread")
      assert.match(result.code, /for \(const item of items\)/)
      assert.doesNotMatch(result.code, /\[\.\.\./)
    })

    test("Array.from() with mapping function", () => {
      const result = transform(`const doubled = Array.from(numbers, n => n * 2);`)

      assert(!result.modified, "skip Array.from() with mapping function")
    })

    test("Array.from() with thisArg", () => {
      const result = transform(
        `const result = Array.from(items, function(x) { return x * this.multiplier; }, context);`,
      )

      assert(!result.modified, "skip Array.from() with thisArg")
    })

    test("chained methods on Array.from()", () => {
      const result = transform(
        `const result = Array.from(set).map(x => x * 2).filter(x => x > 10);`,
      )

      assert(result.modified, "transform Array.from() with chained methods")
      assert.match(result.code, /\[\.\.\.set\]\.map/)
    })

    test("Array.from() with complex iterable", () => {
      const result = transform(
        `const arr = Array.from(document.querySelectorAll('.item'));`,
      )

      assert(result.modified, "transform Array.from() with complex iterable")
      assert.match(result.code, /\[\.\.\.document\.querySelectorAll\('\.item'\)\]/)
    })
  })
})
