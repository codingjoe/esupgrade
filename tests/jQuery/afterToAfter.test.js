import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { afterToAfter } from "../../src/jQuery/afterToAfter.js"

suite("jQuery", () => {
  describe("afterToAfter", () => {
    test("transform direct jQuery call", () => {
      const root = j("$(node).after('text')")
      assert(afterToAfter(root))
      assert.equal(root.toSource(), "node.after('text')")
    })

    test("transform with element node", () => {
      const root = j("$(node).after(otherNode)")
      assert(afterToAfter(root))
      assert.equal(root.toSource(), "node.after(otherNode)")
    })

    test("skip when no arguments", () => {
      const root = j("$(node).after()")
      assert.equal(afterToAfter(root), false)
      assert.equal(root.toSource(), "$(node).after()")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.after("text")')
      assert(afterToAfter(root))
      assert.equal(root.toSource(), 'const el = $(node); node.after("text")')
    })

    test("skip when not a jQuery call", () => {
      const root = j("element.after('text')")
      assert.equal(afterToAfter(root), false)
      assert.equal(root.toSource(), "element.after('text')")
    })
  })
})
