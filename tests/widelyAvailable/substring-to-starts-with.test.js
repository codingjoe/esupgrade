import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("substringToStartsWith", () => {
    describe("transformable patterns", () => {
      test("substring(0, prefix.length) === prefix", () => {
        const result = transform(
          `const matches = "hello world".substring(0, prefix.length) === prefix;`,
        )

        assert(result.modified, "transform substring prefix check")
        assert.match(result.code, /"hello world"\.startsWith\(prefix\)/)
        assert.doesNotMatch(result.code, /substring/)
      })

      test("prefix === substring(0, prefix.length)", () => {
        const result = transform(
          `const matches = prefix === "hello world".substring(0, prefix.length);`,
        )

        assert(result.modified, "transform reversed substring prefix check")
        assert.match(result.code, /"hello world"\.startsWith\(prefix\)/)
        assert.doesNotMatch(result.code, /substring/)
      })

      test("substring(0, prefix.length) !== prefix", () => {
        const result = transform(
          `const noMatch = "hello world".substring(0, prefix.length) !== prefix;`,
        )

        assert(result.modified, "transform substring !== prefix")
        assert.match(result.code, /!"hello world"\.startsWith\(prefix\)/)
        assert.doesNotMatch(result.code, /substring/)
      })

      test("substring with string literal prefix", () => {
        const result = transform(
          `const matches = "hello world".substring(0, "hello".length) === "hello";`,
        )

        assert(result.modified, "transform substring with literal prefix")
        assert.match(result.code, /"hello world"\.startsWith\("hello"\)/)
        assert.doesNotMatch(result.code, /substring/)
      })

      test("substring on template literal", () => {
        const result = transform(
          "const matches = `test`.substring(0, prefix.length) === prefix;",
        )

        assert(result.modified, "transform substring on template literal")
        assert.match(result.code, /`test`\.startsWith\(prefix\)/)
        assert.doesNotMatch(result.code, /substring/)
      })
    })

    describe("non-transformable patterns", () => {
      test("substring with wrong argument count", () => {
        const result = transform(`const sub = "hello".substring(0) === prefix;`)

        assert(!result.modified, "skip substring with one argument")
      })

      test("substring with non-zero start", () => {
        const result = transform(
          `const sub = "hello".substring(1, prefix.length) === prefix;`,
        )

        assert(!result.modified, "skip substring with non-zero start")
      })

      test("substring without length comparison", () => {
        const result = transform(`const sub = "hello".substring(0, 3) === "hel";`)

        assert(!result.modified, "skip substring without .length")
      })

      test("substring on unknown variable", () => {
        const result = transform(
          `const matches = str.substring(0, prefix.length) === prefix;`,
        )

        assert(!result.modified, "skip substring on unknown variable")
      })

      test("substring with wrong length reference", () => {
        const result = transform(
          `const matches = "test".substring(0, other.length) === prefix;`,
        )

        assert(!result.modified, "skip substring with mismatched length")
      })
    })
  })
})
