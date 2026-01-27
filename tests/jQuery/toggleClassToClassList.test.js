import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { toggleClassToClassList } from "../../src/jQuery/toggleClassToClassList.js"

suite("jQuery", () => {
  describe("toggleClassToClassList", () => {
    test("transform toggleClass", () => {
      const root = j("$(node).toggleClass('active')")
      assert(toggleClassToClassList(root))
      assert.equal(root.toSource(), "$(node).classList.toggle('active')")
    })

    test("skip when no arguments", () => {
      const root = j("$(node).toggleClass()")
      assert.equal(toggleClassToClassList(root), false)
      assert.equal(root.toSource(), "$(node).toggleClass()")
    })

    test("skip when multiple arguments", () => {
      const root = j("$(node).toggleClass('a', 'b')")
      assert.equal(toggleClassToClassList(root), false)
      assert.equal(root.toSource(), "$(node).toggleClass('a', 'b')")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.toggleClass("active")')
      assert(toggleClassToClassList(root))
      assert.equal(root.toSource(), 'const el = $(node); el.classList.toggle("active")')
    })

    test("skip when not jQuery object", () => {
      const root = j("element.toggleClass('active')")
      assert.equal(toggleClassToClassList(root), false)
      assert.equal(root.toSource(), "element.toggleClass('active')")
    })
  })
})
