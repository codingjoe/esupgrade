import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { nextToNextElementSibling } from "../../src/jQuery/nextToNextElementSibling.js"

suite("jQuery", () => {
  describe("nextToNextElementSibling", () => {
    test("transform next without selector", () => {
      const root = j("$(node).next()")
      assert(nextToNextElementSibling(root))
      assert.equal(root.toSource(), "node.nextElementSibling")
    })

    test("skip when selector is not a string", () => {
      const root = j("$(node).next(variable)")
      assert.equal(nextToNextElementSibling(root), false)
      assert.equal(root.toSource(), "$(node).next(variable)")
    })

    test("transform next with selector", () => {
      const root = j("$(node).next('.class')")
      assert(nextToNextElementSibling(root))
      const output = root.toSource()
      assert(output.includes("nextElementSibling"))
      assert(output.includes("matches"))
    })

    test("transform next with selector includes null check", () => {
      const root = j("$(node).next('.class')")
      assert(nextToNextElementSibling(root))
      const output = root.toSource()
      // Verify null check is present in while condition
      assert(output.includes("n &&"), "should include null check in while condition")
      assert(output.includes("!n.matches"), "should check matches after null check")
    })
  })
})
