import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { addClassToClassList } from "../../src/jQuery/addClassToClassList.js"

suite("jQuery", () => {
  describe("addClassToClassList", () => {
    test("add single class", () => {
      const root = j("$(node).addClass('a')")
      assert(addClassToClassList(root))
      assert.equal(root.toSource(), '$(node).classList.add("a")')
    })
    test("add multiple classes", () => {
      const root = j("$(node).addClass('a b')")
      assert(addClassToClassList(root))
      assert.equal(root.toSource(), '$(node).classList.add("a", "b")')
    })

    test("assigned to variable", () => {
      const root = j('const el = $(node); el.addClass("class1 class2")')
      assert(addClassToClassList(root))
      assert.equal(
        root.toSource(),
        'const el = $(node); el.classList.add("class1", "class2")',
      )
    })

    test("add class with variable argument", () => {
      const root = j("$(node).addClass(className)")
      assert(addClassToClassList(root))
      assert.equal(root.toSource(), "$(node).classList.add(className)")
    })
  })
})
