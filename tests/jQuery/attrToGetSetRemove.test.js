import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { attrToGetSetRemove } from "../../src/jQuery/attrToGetSetRemove.js"

suite("jQuery", () => {
  describe("attrToGetSetRemove", () => {
    test("transform getAttribute", () => {
      const root = j("$(node).attr('id')")
      assert(attrToGetSetRemove(root))
      assert.equal(root.toSource(), "$(node).getAttribute('id')")
    })

    test("transform setAttribute", () => {
      const root = j('$(node).attr("data-value", "123")')
      assert(attrToGetSetRemove(root))
      assert.equal(root.toSource(), '$(node).setAttribute("data-value", "123")')
    })

    test("transform removeAttribute", () => {
      const root = j('$(node).removeAttr("disabled")')
      assert(attrToGetSetRemove(root))
      assert.equal(root.toSource(), '$(node).removeAttribute("disabled")')
    })

    test("skip when no arguments", () => {
      const root = j("$(node).attr()")
      assert.equal(attrToGetSetRemove(root), false)
      assert.equal(root.toSource(), "$(node).attr()")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.attr("id")')
      assert(attrToGetSetRemove(root))
      assert.equal(root.toSource(), 'const el = $(node); el.getAttribute("id")')
    })

    test("skip when not jQuery object", () => {
      const root = j("element.attr('id')")
      assert.equal(attrToGetSetRemove(root), false)
      assert.equal(root.toSource(), "element.attr('id')")
    })
  })
})
