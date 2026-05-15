import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("objectKeysMapToValues", () => {
    test("transform arrow function with expression body", () => {
      const result = transform(`Object.keys(obj).map(key => obj[key])`)

      assert(result.modified)
      assert.match(result.code, /Object\.values\(obj\)/)
      assert.doesNotMatch(result.code, /Object\.keys/)
    })

    test("transform arrow function with block body and return", () => {
      const result = transform(`Object.keys(obj).map(key => { return obj[key]; })`)

      assert(result.modified)
      assert.match(result.code, /Object\.values\(obj\)/)
    })

    test("transform regular function expression", () => {
      const result = transform(
        `Object.keys(obj).map(function(key) { return obj[key]; })`,
      )

      assert(result.modified)
      assert.match(result.code, /Object\.values\(obj\)/)
    })

    test("transform when object is a member expression", () => {
      const result = transform(
        `Object.keys(config.options).map(key => config.options[key])`,
      )

      assert(result.modified)
      assert.match(result.code, /Object\.values\(config\.options\)/)
    })

    test("skip when key not used as index", () => {
      const result = transform(`Object.keys(obj).map(key => key.toUpperCase())`)

      assert(!result.modified)
    })

    test("skip when accessing different object", () => {
      const result = transform(`Object.keys(obj).map(key => other[key])`)

      assert(!result.modified)
    })

    test("skip when callback has multiple parameters", () => {
      const result = transform(
        `Object.keys(obj).map((key, index) => obj[key])`,
      )

      assert(!result.modified)
    })

    test("skip when block body has multiple statements", () => {
      const result = transform(
        `Object.keys(obj).map(key => { const v = obj[key]; return v; })`,
      )

      assert(!result.modified)
    })

    test("skip when map callback is a reference", () => {
      const result = transform(`Object.keys(obj).map(getter)`)

      assert(!result.modified)
    })

    test("skip when Object.keys called with multiple arguments", () => {
      const result = transform(`Object.keys(obj, extra).map(key => obj[key])`)

      assert(!result.modified)
    })

    test("skip when map called with thisArg", () => {
      const result = transform(`Object.keys(obj).map(key => obj[key], ctx)`)

      assert(!result.modified)
    })

    test("skip when map is not called on Object.keys()", () => {
      const result = transform(`[1, 2, 3].map(key => obj[key])`)

      assert(!result.modified)
    })

    test("transform when target object is a function call", () => {
      const result = transform(`Object.keys(getObj()).map(key => getObj()[key])`)

      assert(result.modified)
      assert.match(result.code, /Object\.values\(getObj\(\)\)/)
    })
  })
})
