import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { textToTextContent } from "../../src/jQuery/textToTextContent.js"

suite("jQuery", () => {
  describe("textToTextContent", () => {
    test("transform text getter", () => {
      const root = j("$(node).text()")
      assert(textToTextContent(root))
      assert.equal(root.toSource(), "$(node).textContent")
    })

    test("transform text setter", () => {
      const root = j("$(node).text('hello')")
      assert(textToTextContent(root))
      assert.equal(root.toSource(), "$(node).textContent = 'hello'")
    })

    test("transform with jQuery alias getter", () => {
      const root = j("const el = $(node); el.text()")
      assert(textToTextContent(root))
      assert.equal(root.toSource(), "const el = $(node); el.textContent")
    })

    test("transform with jQuery alias setter", () => {
      const root = j('const el = $(node); el.text("text")')
      assert(textToTextContent(root))
      assert.equal(root.toSource(), 'const el = $(node); el.textContent = "text"')
    })

    test("skip when not jQuery object", () => {
      const root = j("element.text()")
      assert.equal(textToTextContent(root), false)
      assert.equal(root.toSource(), "element.text()")
    })
  })
})
