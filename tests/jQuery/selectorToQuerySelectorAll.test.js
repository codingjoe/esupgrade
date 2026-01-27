import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { selectorToQuerySelectorAll } from "../../src/jQuery/selectorToQuerySelectorAll.js"

suite("jQuery", () => {
  describe("selectorToQuerySelectorAll", () => {
    test("transform class selector", () => {
      const root = j("$('.myclass')")
      assert(selectorToQuerySelectorAll(root))
      assert.equal(root.toSource(), "document.querySelectorAll('.myclass')")
    })

    test("skip when selector is not class", () => {
      const root = j("$('div')")
      assert.equal(selectorToQuerySelectorAll(root), false)
      assert.equal(root.toSource(), "$('div')")
    })

    test("skip when not a string selector", () => {
      const root = j("$(variable)")
      assert.equal(selectorToQuerySelectorAll(root), false)
      assert.equal(root.toSource(), "$(variable)")
    })

    test("skip when followed by .each()", () => {
      const root = j("$('.class').each(fn)")
      assert.equal(selectorToQuerySelectorAll(root), false)
    })

    test("skip when followed by complex chain", () => {
      const root = j("$('.class').unknown()")
      assert.equal(selectorToQuerySelectorAll(root), false)
    })
  })
})
