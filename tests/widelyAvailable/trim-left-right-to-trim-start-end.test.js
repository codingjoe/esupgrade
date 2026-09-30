import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("trimLeftRightToTrimStartEnd", () => {
    describe("basic transformations", () => {
      test("rename trimLeft on a string literal", () => {
        const result = transform(`const trimmed = "  hello  ".trimLeft();`)

        assert(result.modified, "rename trimLeft to trimStart")
        assert.match(result.code, /const trimmed = " {2}hello {2}"\.trimStart\(\)/)
        assert.doesNotMatch(result.code, /trimLeft/)
      })

      test("rename trimRight on a string literal", () => {
        const result = transform(`const trimmed = "  hello  ".trimRight();`)

        assert(result.modified, "rename trimRight to trimEnd")
        assert.match(result.code, /const trimmed = " {2}hello {2}"\.trimEnd\(\)/)
        assert.doesNotMatch(result.code, /trimRight/)
      })

      test("rename trimLeft on a template literal", () => {
        const result = transform("const trimmed = `  hello  `.trimLeft();")

        assert(result.modified, "rename trimLeft on a template literal")
        assert.match(result.code, /const trimmed = ` {2}hello {2}`\.trimStart\(\)/)
        assert.doesNotMatch(result.code, /trimLeft/)
      })

      test("rename trimLeft after another string method call", () => {
        const result = transform(`const trimmed = "  x  ".trim().trimLeft();`)

        assert(result.modified, "rename trimLeft after trim()")
        assert.match(
          result.code,
          /const trimmed = " {2}x {2}"\.trim\(\)\.trimStart\(\)/,
        )
        assert.doesNotMatch(result.code, /trimLeft/)
      })

      test("rename every alias call in a file", () => {
        const result = transform(`
const left = "  hello  ".trimLeft();
const right = "  world  ".trimRight();
`)

        assert(result.modified, "rename all aliases in the file")
        assert.match(result.code, /const left = " {2}hello {2}"\.trimStart\(\)/)
        assert.match(result.code, /const right = " {2}world {2}"\.trimEnd\(\)/)
        assert.doesNotMatch(result.code, /trimLeft|trimRight/)
      })
    })

    describe("skipped receivers", () => {
      test("skip trimLeft on a variable", () => {
        const result = transform(`const trimmed = value.trimLeft();`)

        assert(!result.modified, "skip unverified receivers")
      })

      test("skip trimRight on an object property", () => {
        const result = transform(`const trimmed = obj.value.trimRight();`)

        assert(!result.modified, "skip object properties")
      })

      test("skip trimLeft on a function call result", () => {
        const result = transform(`const trimmed = getValue().trimLeft();`)

        assert(!result.modified, "skip function call results")
      })
    })

    describe("skipped references", () => {
      test("skip already-standard trimStart and trimEnd calls", () => {
        const result = transform(`
const left = "  a  ".trimStart();
const right = "  a  ".trimEnd();
`)

        assert(!result.modified, "skip standard method names")
      })

      test("skip computed member access", () => {
        const result = transform(`const trimmed = "a"["trimLeft"]();`)

        assert(!result.modified, "skip computed access")
      })

      test("skip a method reference without a call", () => {
        const result = transform(`const fn = "a".trimLeft;`)

        assert(!result.modified, "skip method references")
      })

      test("skip calling a detached method reference", () => {
        const result = transform(`const trimmed = "a".trimLeft.call(null);`)

        assert(!result.modified, "skip call() on a method reference")
      })

      test("skip a call with a non-member callee", () => {
        const result = transform(`foo();`)

        assert(!result.modified, "skip callees that are not member expressions")
      })

      test("skip a private method with the alias name", () => {
        const result = transform(`
class Trimmer {
  #trimLeft() {}
  run() { return this.#trimLeft(); }
}
`)

        assert(!result.modified, "skip private members")
      })
    })

    describe("optional chaining", () => {
      test("skip an optional chained trimLeft call", () => {
        const result = transform(`const trimmed = value?.trimLeft();`)

        assert(!result.modified, "skip optional chained calls")
      })

      test("skip an optional chained trimRight call", () => {
        const result = transform(`const trimmed = value?.trimRight?.();`)

        assert(!result.modified, "skip optional chained calls")
      })

      test("skip calling a parenthesized optional member", () => {
        const result = transform(`const trimmed = (value?.trimLeft)();`)

        assert(!result.modified, "skip optional member callees")
      })
    })

    describe("composition", () => {
      test("rename trimLeft inside a console.log call", () => {
        const result = transform(`console.log("  a  ".trimLeft());`)

        assert(result.modified, "rename inside a call argument")
        assert.match(result.code, /console\.info\(" {2}a {2}"\.trimStart\(\)\)/)
        assert.doesNotMatch(result.code, /console\.log/)
        assert.doesNotMatch(result.code, /trimLeft/)
      })
    })
  })
})
