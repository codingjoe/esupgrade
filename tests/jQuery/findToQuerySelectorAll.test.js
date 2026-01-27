import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { findToQuerySelectorAll } from "../../src/jQuery/findToQuerySelectorAll.js"

suite("jQuery", () => {
  describe("findToQuerySelectorAll", () => {
    test("transform find with selector", () => {
      const root = j("$(node).find('.class')")
      assert(findToQuerySelectorAll(root))
      assert.equal(root.toSource(), "node.querySelectorAll('.class')")
    })

    test("skip when no selector", () => {
      const root = j("$(node).find()")
      assert.equal(findToQuerySelectorAll(root), false)
      assert.equal(root.toSource(), "$(node).find()")
    })

    test("skip when selector is not a string", () => {
      const root = j("$(node).find(variable)")
      assert.equal(findToQuerySelectorAll(root), false)
      assert.equal(root.toSource(), "$(node).find(variable)")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.find(".class")')
      assert(findToQuerySelectorAll(root))
      assert.equal(
        root.toSource(),
        'const el = $(node); node.querySelectorAll(".class")',
      )
    })

    test("skip when not jQuery object", () => {
      const root = j("element.find('.class')")
      assert.equal(findToQuerySelectorAll(root), false)
      assert.equal(root.toSource(), "element.find('.class')")
    })

    test("skip when object is complex expression", () => {
      const root = j("obj.prop.find('.class')")
      assert.equal(findToQuerySelectorAll(root), false)
      assert.equal(root.toSource(), "obj.prop.find('.class')")
    })
  })
})
