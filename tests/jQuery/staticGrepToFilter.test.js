import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { staticGrepToFilter } from "../../src/jQuery/staticGrepToFilter.js"

suite("jQuery", () => {
  describe("staticGrepToFilter", () => {
    test("transform $.grep with function expression", () => {
      const root = j("$.grep(arr, function(item) { return item > 5; })")
      assert(staticGrepToFilter(root))
      assert.equal(root.toSource(), "arr.filter(function(item) { return item > 5; })")
    })

    test("transform $.grep with arrow function", () => {
      const root = j("$.grep(arr, item => item > 5)")
      assert(staticGrepToFilter(root))
      assert.equal(root.toSource(), "arr.filter(item => item > 5)")
    })

    test("transform with complex array expression", () => {
      const root = j("$.grep(data.items, (x) => x.active)")
      assert(staticGrepToFilter(root))
      assert.equal(root.toSource(), "data.items.filter((x) => x.active)")
    })

    test("skip when missing array argument", () => {
      const root = j("$.grep()")
      assert.equal(staticGrepToFilter(root), false)
      assert.equal(root.toSource(), "$.grep()")
    })

    test("skip when missing function argument", () => {
      const root = j("$.grep(arr)")
      assert.equal(staticGrepToFilter(root), false)
      assert.equal(root.toSource(), "$.grep(arr)")
    })

    test("skip when not jQuery object", () => {
      const root = j("lodash.grep(arr, fn)")
      assert.equal(staticGrepToFilter(root), false)
      assert.equal(root.toSource(), "lodash.grep(arr, fn)")
    })

    test("transform with callback identifier", () => {
      const root = j("$.grep(items, filterFn)")
      assert(staticGrepToFilter(root))
      assert.equal(root.toSource(), "items.filter(filterFn)")
    })
  })
})
