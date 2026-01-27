import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { eachToForOf } from "../../src/jQuery/eachToForOf.js"

suite("jQuery", () => {
  describe("eachToForOf", () => {
    test("transform each with function expression", () => {
      const root = j("$(selector).each(function(el) { console.log(el) })")
      assert(eachToForOf(root))
      const output = root.toSource()
      assert(output.includes("querySelectorAll"))
      assert(output.includes("forEach"))
    })

    test("skip when no callback", () => {
      const root = j("$(selector).each()")
      assert.equal(eachToForOf(root), false)
      assert.equal(root.toSource(), "$(selector).each()")
    })

    test("transform with jQuery alias", () => {
      const root = j(
        "const el = $(selector); el.each(function(item) { console.log(item) })",
      )
      assert(eachToForOf(root))
      const output = root.toSource()
      assert(output.includes("querySelectorAll"))
      assert(output.includes("forEach"))
    })

    test("skip when not jQuery object", () => {
      const root = j("collection.each(fn)")
      assert.equal(eachToForOf(root), false)
      assert.equal(root.toSource(), "collection.each(fn)")
    })

    test("transform callback without parameters", () => {
      const root = j("$(selector).each(function() { console.log('item') })")
      assert(eachToForOf(root))
      const output = root.toSource()
      assert(output.includes("querySelectorAll"))
      assert(output.includes("forEach"))
      assert(output.includes("function(el)"))
    })

    test("transform callback using this", () => {
      const root = j("$(selector).each(function(item) { console.log(this.value) })")
      assert(eachToForOf(root))
      const output = root.toSource()
      assert(output.includes("querySelectorAll"))
      assert(output.includes("forEach"))
      assert(output.includes("item.value"))
      assert(!output.includes("this"))
    })
  })
})
