import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { closestToClosest } from "../../src/jQuery/closestToClosest.js"

suite("jQuery", () => {
  describe("closestToClosest", () => {
    test("transform closest with selector", () => {
      const root = j("$(node).closest('.class')")
      assert(closestToClosest(root))
      assert.equal(root.toSource(), "$(node).closest('.class')")
    })

    test("skip when no selector", () => {
      const root = j("$(node).closest()")
      assert.equal(closestToClosest(root), false)
      assert.equal(root.toSource(), "$(node).closest()")
    })

    test("skip when selector is not a string", () => {
      const root = j("$(node).closest(variable)")
      assert.equal(closestToClosest(root), false)
      assert.equal(root.toSource(), "$(node).closest(variable)")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.closest(".class")')
      assert(closestToClosest(root))
      assert.equal(root.toSource(), 'const el = $(node); el.closest(".class")')
    })

    test("skip when not jQuery object", () => {
      const root = j("element.closest('.class')")
      assert.equal(closestToClosest(root), false)
      assert.equal(root.toSource(), "element.closest('.class')")
    })
  })
})
