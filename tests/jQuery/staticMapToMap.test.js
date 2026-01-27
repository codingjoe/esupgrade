import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { staticMapToMap } from "../../src/jQuery/staticMapToMap.js"

suite("jQuery", () => {
  describe("staticMapToMap", () => {
    test("transform $.map with function expression", () => {
      const root = j("$.map(arr, function(item) { return item * 2; })")
      assert(staticMapToMap(root))
      assert.equal(root.toSource(), "arr.map(function(item) { return item * 2; })")
    })

    test("transform $.map with arrow function", () => {
      const root = j("$.map(arr, item => item * 2)")
      assert(staticMapToMap(root))
      assert.equal(root.toSource(), "arr.map(item => item * 2)")
    })

    test("transform jQuery.map", () => {
      const root = j("jQuery.map(items, (x) => x.name)")
      assert(staticMapToMap(root))
      assert.equal(root.toSource(), "items.map((x) => x.name)")
    })

    test("transform with complex array expression", () => {
      const root = j("$.map(data.items, item => item.id)")
      assert(staticMapToMap(root))
      assert.equal(root.toSource(), "data.items.map(item => item.id)")
    })

    test("skip when missing array argument", () => {
      const root = j("$.map()")
      assert.equal(staticMapToMap(root), false)
      assert.equal(root.toSource(), "$.map()")
    })

    test("skip when missing function argument", () => {
      const root = j("$.map(arr)")
      assert.equal(staticMapToMap(root), false)
      assert.equal(root.toSource(), "$.map(arr)")
    })

    test("skip when not jQuery object", () => {
      const root = j("lodash.map(arr, fn)")
      assert.equal(staticMapToMap(root), false)
      assert.equal(root.toSource(), "lodash.map(arr, fn)")
    })

    test("transform with callback identifier", () => {
      const root = j("$.map(items, mapFn)")
      assert(staticMapToMap(root))
      assert.equal(root.toSource(), "items.map(mapFn)")
    })
  })
})
