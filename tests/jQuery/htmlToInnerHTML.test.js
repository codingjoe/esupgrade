import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { htmlToInnerHTML } from "../../src/jQuery/htmlToInnerHTML.js"

suite("jQuery", () => {
  describe("htmlToInnerHTML", () => {
    test("transform html getter", () => {
      const root = j("$(node).html()")
      assert(htmlToInnerHTML(root))
      assert.equal(root.toSource(), "node.innerHTML")
    })

    test("transform html setter", () => {
      const root = j("$(node).html('<div>content</div>')")
      assert(htmlToInnerHTML(root))
      assert.equal(root.toSource(), "node.innerHTML = '<div>content</div>'")
    })

    test("transform with jQuery alias getter", () => {
      const root = j("const el = $(node); el.html()")
      assert(htmlToInnerHTML(root))
      assert.equal(root.toSource(), "const el = $(node); el.innerHTML")
    })

    test("transform with jQuery alias setter", () => {
      const root = j('const el = $(node); el.html("<p>text</p>")')
      assert(htmlToInnerHTML(root))
      assert.equal(root.toSource(), 'const el = $(node); el.innerHTML = "<p>text</p>"')
    })

    test("skip when not jQuery object", () => {
      const root = j("element.html()")
      assert.equal(htmlToInnerHTML(root), false)
      assert.equal(root.toSource(), "element.html()")
    })
  })
})
