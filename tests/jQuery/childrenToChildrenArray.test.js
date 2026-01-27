import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { childrenToChildrenArray } from "../../src/jQuery/childrenToChildrenArray.js"

suite("jQuery", () => {
  describe("childrenToChildrenArray", () => {
    test("transform direct jQuery call", () => {
      const root = j("$(node).children()")
      assert(childrenToChildrenArray(root))
      assert.equal(root.toSource(), "Array.from(node.children)")
    })

    test("transform with selector argument", () => {
      const root = j("$(node).children('selector')")
      assert(childrenToChildrenArray(root))
      assert.equal(root.toSource(), "Array.from(node.children)")
    })

    test("transform with jQuery alias", () => {
      const root = j("const el = $(node); el.children()")
      assert(childrenToChildrenArray(root))
      assert.equal(root.toSource(), "const el = $(node); Array.from(node.children)")
    })

    test("skip when not jQuery object", () => {
      const root = j("element.children()")
      assert.equal(childrenToChildrenArray(root), false)
      assert.equal(root.toSource(), "element.children()")
    })
  })
})
