import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { onToAddEventListener } from "../../src/jQuery/onToAddEventListener.js"

suite("jQuery", () => {
  describe("onToAddEventListener", () => {
    test("transform on with event and handler", () => {
      const root = j("$(node).on('click', handler)")
      assert(onToAddEventListener(root))
      assert.equal(root.toSource(), "$(node).addEventListener('click', handler)")
    })

    test("skip delegated events with selector", () => {
      const root = j("$(node).on('click', '.selector', handler)")
      assert.equal(onToAddEventListener(root), false)
      assert.equal(root.toSource(), "$(node).on('click', '.selector', handler)")
    })

    test("skip when missing handler", () => {
      const root = j("$(node).on('click')")
      assert.equal(onToAddEventListener(root), false)
      assert.equal(root.toSource(), "$(node).on('click')")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.on("click", handler)')
      assert(onToAddEventListener(root))
      assert.equal(
        root.toSource(),
        'const el = $(node); el.addEventListener("click", handler)',
      )
    })

    test("skip when not jQuery object", () => {
      const root = j("element.on('click', handler)")
      assert.equal(onToAddEventListener(root), false)
      assert.equal(root.toSource(), "element.on('click', handler)")
    })
  })
})
