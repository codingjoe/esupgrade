import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { inArrayToIncludes } from "../../src/jQuery/inArrayToIncludes.js"

suite("jQuery", () => {
  describe("inArrayToIncludes", () => {
    test("transform $.inArray call", () => {
      const root = j("$.inArray(value, array)")
      assert(inArrayToIncludes(root))
      assert.equal(root.toSource(), "array.includes(value)")
    })

    test("transform jQuery.inArray call", () => {
      const root = j("jQuery.inArray(value, array)")
      assert(inArrayToIncludes(root))
      assert.equal(root.toSource(), "array.includes(value)")
    })

    test("skip when missing arguments", () => {
      const root = j("$.inArray(value)")
      assert.equal(inArrayToIncludes(root), false)
      assert.equal(root.toSource(), "$.inArray(value)")
    })

    test("transform $.inArray in !== -1 comparison", () => {
      const root = j("if ($.inArray(value, array) !== -1) { }")
      assert(inArrayToIncludes(root))
      // Transforms the call but leaves the comparison
      assert.equal(root.toSource(), "if (array.includes(value) !== -1) { }")
    })

    test("transform jQuery.inArray in !== -1 comparison", () => {
      const root = j("if (jQuery.inArray(item, list) !== -1) { }")
      assert(inArrayToIncludes(root))
      assert.equal(root.toSource(), "if (list.includes(item) !== -1) { }")
    })

    test("skip binary expression without left side", () => {
      const root = j("if (null !== -1) { }")
      assert.equal(inArrayToIncludes(root), false)
    })

    test("skip binary expression with non-call left side", () => {
      const root = j("if (someVar !== -1) { }")
      assert.equal(inArrayToIncludes(root), false)
    })

    test("skip call expression without proper callee", () => {
      const root = j("if (func() !== -1) { }")
      assert.equal(inArrayToIncludes(root), false)
    })

    test("skip call expression with wrong method name", () => {
      const root = j("if ($.indexOf(value, array) !== -1) { }")
      assert.equal(inArrayToIncludes(root), false)
    })

    test("skip call expression with non-jQuery object", () => {
      const root = j("if (lodash.inArray(value, array) !== -1) { }")
      assert.equal(inArrayToIncludes(root), false)
    })

    test("skip inArray call in comparison without both arguments", () => {
      const root = j("if ($.inArray(value) !== -1) { }")
      assert.equal(inArrayToIncludes(root), false)
    })
  })
})
