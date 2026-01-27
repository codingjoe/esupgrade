import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { cssToStyleAndComputed } from "../../src/jQuery/cssToStyleAndComputed.js"

suite("jQuery", () => {
  describe("cssToStyleAndComputed", () => {
    test("transform css getter", () => {
      const root = j("$(node).css('color')")
      assert(cssToStyleAndComputed(root))
      assert.equal(root.toSource(), "getComputedStyle(node).color")
    })

    test("transform css setter", () => {
      const root = j("$(node).css('color', 'red')")
      assert(cssToStyleAndComputed(root))
      assert.equal(root.toSource(), "node.style.color = 'red'")
    })

    test("skip when no arguments", () => {
      const root = j("$(node).css()")
      assert.equal(cssToStyleAndComputed(root), false)
      assert.equal(root.toSource(), "$(node).css()")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.css("color")')
      assert(cssToStyleAndComputed(root))
      assert.equal(root.toSource(), "const el = $(node); getComputedStyle(node).color")
    })

    test("skip when not jQuery object", () => {
      const root = j("element.css('color')")
      assert.equal(cssToStyleAndComputed(root), false)
      assert.equal(root.toSource(), "element.css('color')")
    })

    test("transform css with object argument", () => {
      const root = j("$(node).css({ color: 'red', fontSize: '14px' })")
      assert(cssToStyleAndComputed(root))
      assert.equal(
        root.toSource(),
        "{\n  node.style.color = 'red';\n  node.style.fontSize = '14px';\n};",
      )
    })

    test("transform css with single property object", () => {
      const root = j("$(node).css({ display: 'none' })")
      assert(cssToStyleAndComputed(root))
      assert.equal(root.toSource(), "{\n  node.style.display = 'none';\n};")
    })

    test("skip css with empty object", () => {
      const root = j("$(node).css({})")
      assert.equal(cssToStyleAndComputed(root), false)
      assert.equal(root.toSource(), "$(node).css({})")
    })

    test("transform css object in expression context wraps in IIFE", () => {
      const root = j("const result = $(node).css({ color: 'red' })")
      assert(cssToStyleAndComputed(root))
      const output = root.toSource()
      // In expression context, should wrap in arrow function IIFE
      assert(output.includes("() =>"), "should wrap in arrow function for expression context")
      assert(output.includes("node.style.color = 'red'"), "should include assignment")
    })
  })
})
