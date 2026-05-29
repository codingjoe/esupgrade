import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("Object.hasOwn", () => {
    test("transform Object.prototype.hasOwnProperty.call", () => {
      const result = transform(
        `Object.prototype.hasOwnProperty.call(obj, prop)`,
        "widely-available",
      )

      assert(result.modified, "transform Object.prototype.hasOwnProperty.call")
      assert.match(result.code, /Object\.hasOwn\(obj, prop\)/)
      assert.doesNotMatch(result.code, /hasOwnProperty/)
    })

    test("transform object literal hasOwnProperty.call", () => {
      const result = transform(`({}).hasOwnProperty.call(obj, prop)`, "widely-available")

      assert(result.modified, "transform empty object literal hasOwnProperty.call")
      assert.match(result.code, /Object\.hasOwn\(obj, prop\)/)
      assert.doesNotMatch(result.code, /hasOwnProperty/)
    })

    test("skip non-call access", () => {
      const result = transform(
        `Object.prototype.hasOwnProperty.apply(obj, [prop])`,
        "widely-available",
      )

      assert(!result.modified, "skip non-call hasOwnProperty access")
    })

    test("skip unsupported receiver", () => {
      const result = transform(`dict.hasOwnProperty.call(obj, prop)`, "widely-available")

      assert(!result.modified, "skip unknown hasOwnProperty receiver")
    })

    test("skip non-empty object literal receiver", () => {
      const result = transform(
        `({ value: true }).hasOwnProperty.call(obj, prop)`,
        "widely-available",
      )

      assert(!result.modified, "skip non-empty object literal receiver")
    })

    test("skip unsupported argument count", () => {
      const result = transform(
        `Object.prototype.hasOwnProperty.call(obj, prop, extra)`,
        "widely-available",
      )

      assert(!result.modified, "skip unsupported argument count")
    })

    test("skip when Object is shadowed", () => {
      const result = transform(
        `function foo(Object) { return ({}).hasOwnProperty.call(obj, prop); }`,
        "widely-available",
      )

      assert(!result.modified, "skip when Object is shadowed by a parameter")
    })
  })
})
