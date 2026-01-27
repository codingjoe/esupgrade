import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { emptyToReplaceChildren } from "../../src/jQuery/emptyToReplaceChildren.js"

suite("jQuery", () => {
  describe("emptyToReplaceChildren", () => {
    test("transform empty call", () => {
      const root = j("$(node).empty()")
      assert(emptyToReplaceChildren(root))
      assert.equal(root.toSource(), "$(node).replaceChildren()")
    })

    test("transform with jQuery alias", () => {
      const root = j("const el = $(node); el.empty()")
      assert(emptyToReplaceChildren(root))
      assert.equal(root.toSource(), "const el = $(node); el.replaceChildren()")
    })

    test("skip when not jQuery object", () => {
      const root = j("element.empty()")
      assert.equal(emptyToReplaceChildren(root), false)
      assert.equal(root.toSource(), "element.empty()")
    })
  })
})
