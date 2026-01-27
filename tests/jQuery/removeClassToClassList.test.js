import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { removeClassToClassList } from "../../src/jQuery/removeClassToClassList.js"

suite("jQuery", () => {
  describe("removeClassToClassList", () => {
    test("remove single class", () => {
      const root = j("$(node).removeClass('a')")
      assert(removeClassToClassList(root))
      assert.equal(root.toSource(), '$(node).classList.remove("a")')
    })

    test("remove multiple classes", () => {
      const root = j("$(node).removeClass('a b')")
      assert(removeClassToClassList(root))
      assert.equal(root.toSource(), '$(node).classList.remove("a", "b")')
    })

    test("skip when no arguments", () => {
      const root = j("$(node).removeClass()")
      assert.equal(removeClassToClassList(root), false)
      assert.equal(root.toSource(), "$(node).removeClass()")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.removeClass("class1 class2")')
      assert(removeClassToClassList(root))
      assert.equal(
        root.toSource(),
        'const el = $(node); el.classList.remove("class1", "class2")',
      )
    })

    test("skip when not jQuery object", () => {
      const root = j("element.removeClass('a')")
      assert.equal(removeClassToClassList(root), false)
      assert.equal(root.toSource(), "element.removeClass('a')")
    })

    test("remove class with variable argument", () => {
      const root = j("$(node).removeClass(className)")
      assert(removeClassToClassList(root))
      assert.equal(root.toSource(), "$(node).classList.remove(className)")
    })
  })
})
