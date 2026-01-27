import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { staticEachToForEach } from "../../src/jQuery/staticEachToForEach.js"

suite("jQuery", () => {
  describe("staticEachToForEach", () => {
    test("transform $.each with function expression", () => {
      const root = j("$.each(arr, function(index, value) { console.log(value); })")
      assert(staticEachToForEach(root))
      assert.equal(
        root.toSource(),
        "arr.forEach(function(index, value) { console.log(value); })",
      )
    })

    test("transform $.each with arrow function", () => {
      const root = j("$.each(arr, (index, value) => { console.log(value); })")
      assert(staticEachToForEach(root))
      assert.equal(
        root.toSource(),
        "arr.forEach((index, value) => { console.log(value); })",
      )
    })

    test("transform jQuery.each with function expression", () => {
      const root = j("jQuery.each(items, function(i, item) { doWork(item); })")
      assert(staticEachToForEach(root))
      assert.equal(
        root.toSource(),
        "items.forEach(function(i, item) { doWork(item); })",
      )
    })

    test("transform with single parameter function", () => {
      const root = j("$.each(arr, function(index) { console.log(index); })")
      assert(staticEachToForEach(root))
      assert.equal(
        root.toSource(),
        "arr.forEach(function(index) { console.log(index); })",
      )
    })

    test("transform with no parameter function", () => {
      const root = j("$.each(arr, function() { console.log('item'); })")
      assert(staticEachToForEach(root))
      assert.equal(root.toSource(), "arr.forEach(function() { console.log('item'); })")
    })

    test("skip when missing array argument", () => {
      const root = j("$.each()")
      assert.equal(staticEachToForEach(root), false)
      assert.equal(root.toSource(), "$.each()")
    })

    test("skip when missing function argument", () => {
      const root = j("$.each(arr)")
      assert.equal(staticEachToForEach(root), false)
      assert.equal(root.toSource(), "$.each(arr)")
    })

    test("skip when function is not a function expression", () => {
      const root = j("$.each(arr, callback)")
      assert.equal(staticEachToForEach(root), false)
      assert.equal(root.toSource(), "$.each(arr, callback)")
    })

    test("skip when not jQuery object", () => {
      const root = j("lodash.each(arr, fn)")
      assert.equal(staticEachToForEach(root), false)
      assert.equal(root.toSource(), "lodash.each(arr, fn)")
    })

    test("skip when callee is not member expression", () => {
      const root = j("each(arr, fn)")
      assert.equal(staticEachToForEach(root), false)
      assert.equal(root.toSource(), "each(arr, fn)")
    })
  })
})
