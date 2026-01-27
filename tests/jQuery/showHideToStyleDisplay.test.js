import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { showHideToStyleDisplay } from "../../src/jQuery/showHideToStyleDisplay.js"

suite("jQuery", () => {
  describe("showHideToStyleDisplay", () => {
    test("transform show", () => {
      const root = j("$(node).show()")
      assert(showHideToStyleDisplay(root))
      assert.equal(root.toSource(), 'node.style.display = ""')
    })

    test("transform hide", () => {
      const root = j("$(node).hide()")
      assert(showHideToStyleDisplay(root))
      assert.equal(root.toSource(), 'node.style.display = "none"')
    })

    test("transform with jQuery alias show", () => {
      const root = j("const el = $(node); el.show()")
      assert(showHideToStyleDisplay(root))
      assert.equal(root.toSource(), 'const el = $(node); node.style.display = ""')
    })

    test("transform with jQuery alias hide", () => {
      const root = j("const el = $(node); el.hide()")
      assert(showHideToStyleDisplay(root))
      assert.equal(root.toSource(), 'const el = $(node); node.style.display = "none"')
    })

    test("skip when not jQuery object", () => {
      const root = j("element.show()")
      assert.equal(showHideToStyleDisplay(root), false)
      assert.equal(root.toSource(), "element.show()")
    })
  })
})
