import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { clickToAddEventListener } from "../../src/jQuery/clickToAddEventListener.js"

suite("jQuery", () => {
  describe("clickToAddEventListener", () => {
    test("transform click handler", () => {
      const root = j("$(node).click(handler)")
      assert(clickToAddEventListener(root))
      assert.equal(root.toSource(), 'node.addEventListener("click", handler)')
    })

    test("transform with function expression", () => {
      const root = j("$(node).click(function() { console.log('hi') })")
      assert(clickToAddEventListener(root))
      assert.equal(
        root.toSource(),
        "node.addEventListener(\"click\", function() { console.log('hi') })",
      )
    })

    test("skip when no handler", () => {
      const root = j("$(node).click()")
      assert.equal(clickToAddEventListener(root), false)
      assert.equal(root.toSource(), "$(node).click()")
    })

    test("transform with jQuery alias", () => {
      const root = j("const el = $(node); el.click(handler)")
      assert(clickToAddEventListener(root))
      assert.equal(
        root.toSource(),
        'const el = $(node); node.addEventListener("click", handler)',
      )
    })

    test("skip when not jQuery object", () => {
      const root = j("element.click(handler)")
      assert.equal(clickToAddEventListener(root), false)
      assert.equal(root.toSource(), "element.click(handler)")
    })
  })
})
