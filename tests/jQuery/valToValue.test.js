import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { valToValue } from "../../src/jQuery/valToValue.js"

suite("jQuery", () => {
  describe("valToValue", () => {
    test("transform val getter", () => {
      const root = j("$(node).val()")
      assert(valToValue(root))
      assert.equal(root.toSource(), "$(node).value")
    })

    test("transform val setter", () => {
      const root = j("$(node).val('text')")
      assert(valToValue(root))
      assert.equal(root.toSource(), "$(node).value = 'text'")
    })

    test("transform with jQuery alias getter", () => {
      const root = j("const el = $(node); el.val()")
      assert(valToValue(root))
      assert.equal(root.toSource(), "const el = $(node); el.value")
    })

    test("transform with jQuery alias setter", () => {
      const root = j('const el = $(node); el.val("value")')
      assert(valToValue(root))
      assert.equal(root.toSource(), 'const el = $(node); el.value = "value"')
    })

    test("skip when not jQuery object", () => {
      const root = j("element.val()")
      assert.equal(valToValue(root), false)
      assert.equal(root.toSource(), "element.val()")
    })
  })
})
