import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("objectAssignToSpread", () => {
    test("to object spread", () => {
      const result = transform(`const obj = Object.assign({}, obj1, obj2);`)

      assert(result.modified, "transform Object.assign")
      assert.match(result.code, /\.\.\.obj1/)
      assert.match(result.code, /\.\.\.obj2/)
    })

    test("non-empty first arg", () => {
      const result = transform(`const obj = Object.assign({ a: 1 }, obj1);`)

      assert(!result.modified, "skip Object.assign with non-empty first arg")
    })

    test("non-object first arg", () => {
      const result = transform(`const obj = Object.assign(target, obj1);`)

      assert(!result.modified, "skip Object.assign with non-object first arg")
    })

    test("only empty object", () => {
      const result = transform(`const obj = Object.assign({});`)

      assert(result.modified, "transform Object.assign with only empty object")
      assert.match(result.code, /\{\}/)
    })
  })
})
