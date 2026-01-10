import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("lastIndexOfToEndsWith", () => {
    describe("transformable patterns", () => {
      test("lastIndexOf === str.length - suffix.length", () => {
        const result = transform(
          `const matches = "hello world".lastIndexOf(suffix) === "hello world".length - suffix.length;`,
        )

        assert(result.modified, "transform lastIndexOf suffix check")
        assert.match(result.code, /"hello world"\.endsWith\(suffix\)/)
        assert.doesNotMatch(result.code, /lastIndexOf/)
      })

      test("str.length - suffix.length === lastIndexOf", () => {
        const result = transform(
          `const matches = "test".length - suffix.length === "test".lastIndexOf(suffix);`,
        )

        assert(result.modified, "transform reversed lastIndexOf check")
        assert.match(result.code, /"test"\.endsWith\(suffix\)/)
        assert.doesNotMatch(result.code, /lastIndexOf/)
      })

      test("lastIndexOf !== str.length - suffix.length", () => {
        const result = transform(
          `const noMatch = "test".lastIndexOf(suffix) !== "test".length - suffix.length;`,
        )

        assert(result.modified, "transform lastIndexOf !== suffix check")
        assert.match(result.code, /!"test"\.endsWith\(suffix\)/)
        assert.doesNotMatch(result.code, /lastIndexOf/)
      })

      test("lastIndexOf with string literal suffix", () => {
        const result = transform(
          `const matches = "hello world".lastIndexOf("world") === "hello world".length - "world".length;`,
        )

        assert(result.modified, "transform lastIndexOf with literal suffix")
        assert.match(result.code, /"hello world"\.endsWith\("world"\)/)
        assert.doesNotMatch(result.code, /lastIndexOf/)
      })

      test("lastIndexOf on string literal with identifier suffix", () => {
        const result = transform(
          'const matches = "test string".lastIndexOf(suffix) === "test string".length - suffix.length;',
        )

        assert(result.modified, "transform lastIndexOf on string literal")
        assert.match(result.code, /"test string"\.endsWith\(suffix\)/)
        assert.doesNotMatch(result.code, /lastIndexOf/)
      })
    })

    describe("non-transformable patterns", () => {
      test("lastIndexOf with non-subtraction comparison", () => {
        const result = transform(`const matches = "test".lastIndexOf(suffix) === 5;`)

        assert(!result.modified, "skip lastIndexOf with non-subtraction")
      })

      test("lastIndexOf with wrong operator in subtraction", () => {
        const result = transform(
          `const matches = "test".lastIndexOf(suffix) === "test".length + suffix.length;`,
        )

        assert(!result.modified, "skip lastIndexOf with addition")
      })

      test("lastIndexOf with subtraction of non-length property", () => {
        const result = transform(
          `const matches = "test".lastIndexOf(suffix) === "test".length - suffix.size;`,
        )

        assert(!result.modified, "skip lastIndexOf with wrong property")
      })

      test("lastIndexOf with two arguments", () => {
        const result = transform(
          `const found = str.lastIndexOf("test", 5) === str.length - "test".length;`,
        )

        assert(!result.modified, "skip lastIndexOf with fromIndex")
      })

      test("lastIndexOf on unknown variable", () => {
        const result = transform(
          `const matches = str.lastIndexOf(suffix) === str.length - suffix.length;`,
        )

        assert(!result.modified, "skip lastIndexOf on unknown variable")
      })

      test("lastIndexOf with wrong subtraction pattern", () => {
        const result = transform(
          `const matches = "test".lastIndexOf(suffix) === 10 - suffix.length;`,
        )

        assert(!result.modified, "skip lastIndexOf with wrong subtraction")
      })

      test("lastIndexOf with mismatched string references", () => {
        const result = transform(
          `const matches = str1.lastIndexOf(suffix) === str2.length - suffix.length;`,
        )

        assert(!result.modified, "skip lastIndexOf with mismatched strings")
      })

      test("lastIndexOf with mismatched suffix references", () => {
        const result = transform(
          `const matches = "test".lastIndexOf(suffix1) === "test".length - suffix2.length;`,
        )

        assert(!result.modified, "skip lastIndexOf with mismatched suffixes")
      })
    })
  })
})
