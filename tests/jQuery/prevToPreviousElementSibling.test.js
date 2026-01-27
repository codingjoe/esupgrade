import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { prevToPreviousElementSibling } from "../../src/jQuery/prevToPreviousElementSibling.js"

suite("jQuery", () => {
  describe("prevToPreviousElementSibling", () => {
    test("transform prev without selector", () => {
      const root = j("$(node).prev()")
      assert(prevToPreviousElementSibling(root))
      assert.equal(root.toSource(), "node.previousElementSibling")
    })

    test("skip when selector is not a string", () => {
      const root = j("$(node).prev(variable)")
      assert.equal(prevToPreviousElementSibling(root), false)
      assert.equal(root.toSource(), "$(node).prev(variable)")
    })

    test("transform prev with selector", () => {
      const root = j("$(node).prev('.class')")
      assert(prevToPreviousElementSibling(root))
      const output = root.toSource()
      assert(output.includes("previousElementSibling"))
      assert(output.includes("matches"))
    })
  })
})
