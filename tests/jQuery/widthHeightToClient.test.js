import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { widthHeightToClient } from "../../src/jQuery/widthHeightToClient.js"

suite("jQuery", () => {
  describe("widthHeightToClient", () => {
    test("transform width", () => {
      const root = j("$(node).width()")
      assert(widthHeightToClient(root))
      assert.equal(root.toSource(), "node.clientWidth")
    })

    test("transform height", () => {
      const root = j("$(node).height()")
      assert(widthHeightToClient(root))
      assert.equal(root.toSource(), "node.clientHeight")
    })

    test("transform with jQuery alias width", () => {
      const root = j("const el = $(node); el.width()")
      assert(widthHeightToClient(root))
      assert.equal(root.toSource(), "const el = $(node); node.clientWidth")
    })

    test("transform with jQuery alias height", () => {
      const root = j("const el = $(node); el.height()")
      assert(widthHeightToClient(root))
      assert.equal(root.toSource(), "const el = $(node); node.clientHeight")
    })

    test("skip when not jQuery object", () => {
      const root = j("element.width()")
      assert.equal(widthHeightToClient(root), false)
      assert.equal(root.toSource(), "element.width()")
    })
  })
})
