import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { beforeToBefore } from "../../src/jQuery/beforeToBefore.js"

suite("jQuery", () => {
  describe("beforeToBefore", () => {
    test("transform string before to insertAdjacentHTML", () => {
      const root = j("$(node).before('text')")
      assert(beforeToBefore(root))
      assert.equal(
        root.toSource(),
        "$(node).insertAdjacentHTML(\"beforebegin\", 'text')",
      )
    })

    test("transform element before", () => {
      const root = j("$(node).before(otherNode)")
      assert(beforeToBefore(root))
      assert.equal(root.toSource(), "$(node).before(otherNode)")
    })

    test("skip when no arguments", () => {
      const root = j("$(node).before()")
      assert.equal(beforeToBefore(root), false)
      assert.equal(root.toSource(), "$(node).before()")
    })

    test("transform with jQuery alias", () => {
      const root = j('const el = $(node); el.before("text")')
      assert(beforeToBefore(root))
      assert.equal(
        root.toSource(),
        'const el = $(node); el.insertAdjacentHTML("beforebegin", "text")',
      )
    })

    test("skip when not jQuery object", () => {
      const root = j("element.before('text')")
      assert.equal(beforeToBefore(root), false)
      assert.equal(root.toSource(), "element.before('text')")
    })
  })
})
