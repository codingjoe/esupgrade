import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { siblingsToSiblingsArray } from "../../src/jQuery/siblingsToSiblingsArray.js"

suite("jQuery", () => {
  describe("siblingsToSiblingsArray", () => {
    test("transform siblings without selector", () => {
      const root = j("$(node).siblings()")
      assert(siblingsToSiblingsArray(root))
      const output = root.toSource()
      assert(output.includes("Array.from"))
      assert(output.includes("parentElement"))
      assert(output.includes("filter"))
    })

    test("skip when selector is not a string", () => {
      const root = j("$(node).siblings(variable)")
      assert.equal(siblingsToSiblingsArray(root), false)
      assert.equal(root.toSource(), "$(node).siblings(variable)")
    })

    test("transform siblings with selector", () => {
      const root = j("$(node).siblings('.class')")
      assert(siblingsToSiblingsArray(root))
      const output = root.toSource()
      assert(output.includes("Array.from"))
      assert(output.includes("filter"))
      assert(output.includes("matches"))
    })
  })
})
