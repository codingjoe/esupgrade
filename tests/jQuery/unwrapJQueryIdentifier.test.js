import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { unwrapJQueryIdentifier } from "../../src/jQuery/unwrapJQueryIdentifier.js"

suite("jQuery", () => {
  describe("unwrapJQueryIdentifier", () => {
    test("unwraps when chain uses allowed properties", () => {
      const root = j("$(el).value = 'x'")
      assert(unwrapJQueryIdentifier(root))
      assert.equal(root.toSource(), "el.value = 'x'")
    })

    test("unwraps when chain uses allowed methods", () => {
      const root = j("$(el).focus()")
      assert(unwrapJQueryIdentifier(root))
      assert.equal(root.toSource(), "el.focus()")
    })

    test("skips when chain contains disallowed method", () => {
      const root = j("$(node).notResolved()")
      assert.equal(unwrapJQueryIdentifier(root), false)
      assert.equal(root.toSource(), "$(node).notResolved()")
    })
  })
})
