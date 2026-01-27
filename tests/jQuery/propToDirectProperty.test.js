import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { propToDirectProperty } from "../../src/jQuery/propToDirectProperty.js"

suite("jQuery", () => {
  describe("propToDirectProperty", () => {
    test("transform prop getter with querySelector", () => {
      const root = j("$(document.querySelector('input')).prop('checked')")
      assert(propToDirectProperty(root))
      const output = root.toSource()
      assert(output.includes(".checked"))
    })

    test("transform prop setter with querySelector", () => {
      const root = j("$(document.querySelector('input')).prop('checked', true)")
      assert(propToDirectProperty(root))
      const output = root.toSource()
      assert(output.includes(".checked"))
      assert(output.includes("true"))
    })

    test("transform prop with getElementById", () => {
      const root = j("$(document.getElementById('input')).prop('disabled')")
      assert(propToDirectProperty(root))
      const output = root.toSource()
      assert(output.includes(".disabled"))
    })

    test("skip when selector string", () => {
      const root = j("$('input').prop('checked')")
      assert.equal(propToDirectProperty(root), false)
    })

    test("skip when not jQuery object", () => {
      const root = j("element.prop('checked')")
      assert.equal(propToDirectProperty(root), false)
    })

    test("transform prop with variable holding querySelector", () => {
      const root = j(
        "const el = document.querySelector('input'); $(el).prop('value', 'test')",
      )
      assert(propToDirectProperty(root))
      const output = root.toSource()
      assert(output.includes(".value"))
      assert(output.includes("'test'"))
    })

    test("skip when variable doesn't resolve to single element", () => {
      const root = j("const el = elements[0]; $(el).prop('checked')")
      assert.equal(propToDirectProperty(root), false)
    })

    test("skip when identifier has no declaration", () => {
      const root = j("$(unknownElement).prop('value')")
      assert.equal(propToDirectProperty(root), false)
    })

    test("skip when root of member expression is not an identifier", () => {
      const root = j("$(this.document.querySelector('input')).prop('checked')")
      assert.equal(propToDirectProperty(root), false)
    })
  })
})
