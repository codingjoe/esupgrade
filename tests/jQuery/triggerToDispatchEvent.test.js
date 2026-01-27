import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { triggerToDispatchEvent } from "../../src/jQuery/triggerToDispatchEvent.js"

suite("jQuery", () => {
  describe("triggerToDispatchEvent", () => {
    test("transform trigger with event name", () => {
      const root = j("$(node).trigger('click')")
      assert(triggerToDispatchEvent(root))
      const output = root.toSource()
      assert(output.includes("dispatchEvent"))
      assert(output.includes("Event"))
    })

    test("skip when no arguments", () => {
      const root = j("$(node).trigger()")
      assert.equal(triggerToDispatchEvent(root), false)
      assert.equal(root.toSource(), "$(node).trigger()")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.trigger("click")')
      assert(triggerToDispatchEvent(root))
      const output = root.toSource()
      assert(output.includes("dispatchEvent"))
      assert(output.includes("Event"))
    })

    test("skip when not jQuery object", () => {
      const root = j("element.trigger('click')")
      assert.equal(triggerToDispatchEvent(root), false)
      assert.equal(root.toSource(), "element.trigger('click')")
    })

    test("transform with variable event name", () => {
      const root = j("$(node).trigger(eventName)")
      assert(triggerToDispatchEvent(root))
      const output = root.toSource()
      assert(output.includes("dispatchEvent"))
      assert(output.includes("CustomEvent"))
      assert(output.includes("eventName"))
    })
  })
})
