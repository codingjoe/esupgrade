import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { trimToStringTrim } from "../../src/jQuery/trimToStringTrim.js"

suite("jQuery", () => {
  describe("trimToStringTrim", () => {
    test("transform $.trim", () => {
      const root = j("$.trim(str)")
      assert(trimToStringTrim(root))
      assert.equal(root.toSource(), "str.trim()")
    })

    test("transform jQuery.trim", () => {
      const root = j("jQuery.trim(str)")
      assert(trimToStringTrim(root))
      assert.equal(root.toSource(), "str.trim()")
    })

    test("skip when no arguments", () => {
      const root = j("$.trim()")
      assert.equal(trimToStringTrim(root), false)
      assert.equal(root.toSource(), "$.trim()")
    })

    test("skip when not jQuery static method", () => {
      const root = j("str.trim()")
      assert.equal(trimToStringTrim(root), false)
      assert.equal(root.toSource(), "str.trim()")
    })
  })
})
