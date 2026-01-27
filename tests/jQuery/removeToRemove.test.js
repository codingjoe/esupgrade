import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { removeToRemove } from "../../src/jQuery/removeToRemove.js"

suite("jQuery", () => {
  describe("removeToRemove", () => {
    test("transform remove call", () => {
      const root = j("$(node).remove()")
      assert(removeToRemove(root))
      assert.equal(root.toSource(), "node.remove()")
    })

    test("transform with jQuery alias", () => {
      const root = j("const el = $(node); el.remove()")
      assert(removeToRemove(root))
      assert.equal(root.toSource(), "const el = $(node); node.remove()")
    })

    test("skip when not jQuery object", () => {
      const root = j("element.remove()")
      assert.equal(removeToRemove(root), false)
      assert.equal(root.toSource(), "element.remove()")
    })
  })
})
