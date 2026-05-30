import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("replaceAll", () => {
    describe("transformable patterns", () => {
      test("split().join()", () => {
        const result = transform(`const value = "a,b,c".split(",").join(".");`)

        assert(result.modified, "transform split().join() to replaceAll()")
        assert.match(result.code, /"a,b,c"\.replaceAll\(",", "\."\)/)
        assert.doesNotMatch(result.code, /\.split\(|\.join\(/)
      })

      test("replace() with global literal regex", () => {
        const result = transform(`const value = "foo".replace(/o/g, "a");`)

        assert(result.modified, "transform replace() to replaceAll()")
        assert.match(result.code, /"foo"\.replaceAll\("o", "a"\)/)
        assert.doesNotMatch(result.code, /\.replace\(/)
      })

      test("split().join() on known string method chain", () => {
        const result = transform(`const value = "a,b,c".trim().split(",").join(".");`)

        assert(result.modified, "transform split().join() on known string chain")
        assert.match(result.code, /"a,b,c"\.trim\(\)\.replaceAll\(",", "\."\)/)
      })

      test("split().join() with template literal search string", () => {
        const result = transform('const value = "a,b,c".split(`,`).join(".");')

        assert(result.modified, "transform split().join() with template literal search")
        assert.match(result.code, /"a,b,c"\.replaceAll\(`,`, "\."\)/)
      })
    })

    describe("non-transformable patterns", () => {
      test("split().join() on unknown variable", () => {
        const result = transform(`const value = str.split(search).join(replace);`)

        assert(!result.modified, "skip split().join() on unknown variable")
      })

      test("split() with empty string", () => {
        const result = transform(`const value = "abc".split("").join("-");`)

        assert(!result.modified, "skip split() with empty search string")
      })

      test("split() with empty template literal", () => {
        const result = transform('const value = "abc".split(``).join("-");')

        assert(!result.modified, "skip split() with empty template literal")
      })

      test("split() with limit", () => {
        const result = transform(`const value = "a,b,c".split(",", 2).join(".");`)

        assert(!result.modified, "skip split() with limit")
      })

      test("join() with function expression", () => {
        const result = transform(`
          const value = "a,b,c".split(",").join(function separator() {
            return ".";
          });
        `)

        assert(!result.modified, "skip join() with function expression")
      })

      test("replace() on unknown variable", () => {
        const result = transform(`const value = str.replace(/o/g, "a");`)

        assert(!result.modified, "skip replace() on unknown variable")
      })

      test("replace() with regex syntax", () => {
        const result = transform(`const value = "foo".replace(/f.o/g, "bar");`)

        assert(!result.modified, "skip regex replacement with special syntax")
      })

      test("replace() with additional flags", () => {
        const result = transform(`const value = "foo".replace(/o/gi, "a");`)

        assert(!result.modified, "skip regex replacement with additional flags")
      })

      test("replace() with function expression", () => {
        const result = transform(`
          const value = "foo".replace(/o/g, function replacement() {
            return "a";
          });
        `)

        assert(!result.modified, "skip replace() with function expression")
      })

      test("split() with regexp separator", () => {
        const result = transform(`const value = "a,b,c".split(/,/).join(".");`)

        assert(!result.modified, "skip split().join() with regexp separator")
      })

      test("split() with unknown separator", () => {
        const result = transform(
          `const value = "undefined".split(separator).join("-");`,
        )

        assert(!result.modified, "skip split().join() with unknown separator")
      })

      test("join() with $ in replacement", () => {
        const result = transform(`const value = "a,b,c".split(",").join("$&");`)

        assert(!result.modified, "skip split().join() with $ in replacement")
      })

      test("join() with $ in template literal replacement", () => {
        const result = transform('const value = "a,b,c".split(",").join(`$&`);')

        assert(
          !result.modified,
          "skip split().join() with $ in template literal replacement",
        )
      })

      test("join() with unknown replacement", () => {
        const result = transform(`const value = "a,b,c".split(",").join(separator);`)

        assert(!result.modified, "skip split().join() with unknown replacement")
      })

      test("split() with computed property access", () => {
        const result = transform('const value = "a,b,c"[split](",").join(".");')

        assert(!result.modified, "skip computed split() property access")
      })

      test("join() with computed property access", () => {
        const result = transform('const value = "a,b,c".split(",")[join](".");')

        assert(!result.modified, "skip computed join() property access")
      })

      test("replace() with computed property access", () => {
        const result = transform('const value = "foo"[replace](/o/g, "a");')

        assert(!result.modified, "skip computed replace() property access")
      })
    })
  })
})
