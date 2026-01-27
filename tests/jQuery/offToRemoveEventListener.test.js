import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { offToRemoveEventListener } from "../../src/jQuery/offToRemoveEventListener.js"

suite("jQuery", () => {
  describe("offToRemoveEventListener", () => {
    test("transform off with event and handler", () => {
      const root = j("$(node).off('click', handler)")
      assert(offToRemoveEventListener(root))
      assert.equal(root.toSource(), "$(node).removeEventListener('click', handler)")
    })

    test("transform off with event only", () => {
      const root = j("$(node).off('click')")
      assert(offToRemoveEventListener(root))
      const output = root.toSource()
      assert(output.includes("removeEventListener"))
      assert(output.includes("undefined"))
    })

    test("skip when no arguments", () => {
      const root = j("$(node).off()")
      assert.equal(offToRemoveEventListener(root), false)
      assert.equal(root.toSource(), "$(node).off()")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.off("click", handler)')
      assert(offToRemoveEventListener(root))
      assert.equal(
        root.toSource(),
        'const el = $(node); el.removeEventListener("click", handler)',
      )
    })

    test("skip when not jQuery object", () => {
      const root = j("element.off('click', handler)")
      assert.equal(offToRemoveEventListener(root), false)
      assert.equal(root.toSource(), "element.off('click', handler)")
    })
  })
})
