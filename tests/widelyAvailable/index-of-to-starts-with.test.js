import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("indexOfToStartsWith", () => {
    describe("transformable patterns", () => {
      test("string literal with indexOf === 0", () => {
        const result = transform(`const found = "hello world".indexOf("hello") === 0;`)

        assert(result.modified, "transform indexOf === 0")
        assert.match(result.code, /"hello world"\.startsWith\("hello"\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("string literal with 0 === indexOf", () => {
        const result = transform(`const found = 0 === "hello world".indexOf("hello");`)

        assert(result.modified, "transform 0 === indexOf")
        assert.match(result.code, /"hello world"\.startsWith\("hello"\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("string literal with indexOf !== 0", () => {
        const result = transform(
          `const notFound = "hello world".indexOf("goodbye") !== 0;`,
        )

        assert(result.modified, "transform indexOf !== 0")
        assert.match(result.code, /!"hello world"\.startsWith\("goodbye"\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("template literal with indexOf === 0", () => {
        const result = transform("const found = `hello world`.indexOf('hello') === 0;")

        assert(result.modified, "transform template literal indexOf")
        assert.match(result.code, /`hello world`\.startsWith\('hello'\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("string method chain with indexOf === 0", () => {
        const result = transform(
          `const found = "HELLO".toLowerCase().indexOf("hello") === 0;`,
        )

        assert(result.modified, "transform string method chain indexOf")
        assert.match(result.code, /"HELLO"\.toLowerCase\(\)\.startsWith\("hello"\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("nested string method chain with indexOf === 0", () => {
        const result = transform(
          `const found = "HELLO".trim().toLowerCase().indexOf("hello") === 0;`,
        )

        assert(result.modified, "transform nested string chain indexOf")
        assert.match(
          result.code,
          /"HELLO"\.trim\(\)\.toLowerCase\(\)\.startsWith\("hello"\)/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("template literal method chain with indexOf === 0", () => {
        const result = transform("const found = `hello`.trim().indexOf(prefix) === 0;")

        assert(result.modified, "transform template literal chain indexOf")
        assert.match(result.code, /`hello`\.trim\(\)\.startsWith\(prefix\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })

    describe("non-transformable patterns", () => {
      test("indexOf with two arguments", () => {
        const result = transform(`const found = str.indexOf("test", 5) === 0;`)

        assert(!result.modified, "skip indexOf with fromIndex")
      })

      test("indexOf on unknown variable", () => {
        const result = transform(`const found = str.indexOf("test") === 0;`)

        assert(!result.modified, "skip indexOf on unknown variable")
      })

      test("indexOf compared to non-zero", () => {
        const result = transform(`const found = "test".indexOf("e") === 1;`)

        assert(!result.modified, "skip indexOf === 1")
      })

      test("computed indexOf member name", () => {
        const result = transform(
          `const indexOf = "lastIndexOf"\nconst found = "abc"[indexOf]("a") === 0;`,
        )

        assert(!result.modified, "skip computed indexOf member name")
      })

      test("imported Array binding", () => {
        const result = transform(
          `import Array from "./array.js"\nconst found = Array.of(1, 2).indexOf(2) === 0;`,
        )

        assert(!result.modified, "skip indexOf on an imported Array binding")
      })
    })
  })
})
