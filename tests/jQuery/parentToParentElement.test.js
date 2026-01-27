import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { parentToParentElement } from "../../src/jQuery/parentToParentElement.js"

suite("jQuery", () => {
  describe("parentToParentElement", () => {
    test("transform parent without selector", () => {
      const root = j("$(node).parent()")
      assert(parentToParentElement(root))
      assert.equal(root.toSource(), "$(node).parentElement")
    })

    test("transform parent with selector", () => {
      const root = j("$(node).parent('.class')")
      assert(parentToParentElement(root))
      const output = root.toSource()
      assert(output.includes("parentElement"))
      assert(output.includes("matches"))
    })

    test("skip when selector is not a string", () => {
      const root = j("$(node).parent(variable)")
      assert.equal(parentToParentElement(root), false)
      assert.equal(root.toSource(), "$(node).parent(variable)")
    })

    test("skip when not jQuery object", () => {
      const root = j("element.parent()")
      assert.equal(parentToParentElement(root), false)
      assert.equal(root.toSource(), "element.parent()")
    })
  })
})
