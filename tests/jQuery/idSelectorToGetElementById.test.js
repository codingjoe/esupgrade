import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { idSelectorToGetElementById } from "../../src/jQuery/idSelectorToGetElementById.js"

suite("jQuery", () => {
  describe("idSelectorToGetElementById", () => {
    test("transform id selector", () => {
      const root = j("$('#myid')")
      assert(idSelectorToGetElementById(root))
      assert.equal(root.toSource(), 'document.getElementById("myid")')
    })

    test("skip when selector is not id", () => {
      const root = j("$('.class')")
      assert.equal(idSelectorToGetElementById(root), false)
      assert.equal(root.toSource(), "$('.class')")
    })

    test("skip when not a string selector", () => {
      const root = j("$(variable)")
      assert.equal(idSelectorToGetElementById(root), false)
      assert.equal(root.toSource(), "$(variable)")
    })

    test("skip when followed by complex chain", () => {
      const root = j("$('#id').unknown()")
      assert.equal(idSelectorToGetElementById(root), false)
    })
  })
})
