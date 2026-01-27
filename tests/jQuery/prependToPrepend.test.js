import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { prependToPrepend } from "../../src/jQuery/prependToPrepend.js"

suite("jQuery", () => {
  describe("prependToPrepend", () => {
    test("transform element prepend", () => {
      const root = j("$(parent).prepend(child)")
      assert(prependToPrepend(root))
      assert.equal(root.toSource(), "parent.prepend(child)")
    })

    test("skip when no arguments", () => {
      const root = j("$(parent).prepend()")
      assert.equal(prependToPrepend(root), false)
      assert.equal(root.toSource(), "$(parent).prepend()")
    })

    test("transform with jQuery alias", () => {
      const root = j("const el = $(parent); el.prepend(child)")
      assert(prependToPrepend(root))
      assert.equal(root.toSource(), "const el = $(parent); parent.prepend(child)")
    })

    test("skip when not jQuery object", () => {
      const root = j("element.prepend(child)")
      assert.equal(prependToPrepend(root), false)
      assert.equal(root.toSource(), "element.prepend(child)")
    })
  })
})
