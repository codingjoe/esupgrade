import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { hasClassToClassListContains } from "../../src/jQuery/hasClassToClassListContains.js"

suite("jQuery", () => {
  describe("hasClassToClassListContains", () => {
    test("transform hasClass", () => {
      const root = j("$(node).hasClass('active')")
      assert(hasClassToClassListContains(root))
      assert.equal(root.toSource(), "$(node).classList.contains('active')")
    })

    test("skip when no arguments", () => {
      const root = j("$(node).hasClass()")
      assert.equal(hasClassToClassListContains(root), false)
      assert.equal(root.toSource(), "$(node).hasClass()")
    })

    test("skip when multiple arguments", () => {
      const root = j("$(node).hasClass('a', 'b')")
      assert.equal(hasClassToClassListContains(root), false)
      assert.equal(root.toSource(), "$(node).hasClass('a', 'b')")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.hasClass("active")')
      assert(hasClassToClassListContains(root))
      assert.equal(
        root.toSource(),
        'const el = $(node); el.classList.contains("active")',
      )
    })

    test("skip when not jQuery object", () => {
      const root = j("element.hasClass('active')")
      assert.equal(hasClassToClassListContains(root), false)
      assert.equal(root.toSource(), "element.hasClass('active')")
    })
  })
})
