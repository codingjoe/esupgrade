import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("mathPowToExponentiation", () => {
    test("to **", () => {
      const result = transform(`const result = Math.pow(2, 3);`)

      assert(result.modified, "transform Math.pow()")
      assert.match(result.code, /2 \*\* 3/)
    })

    test("with variables", () => {
      const result = transform(`const power = Math.pow(base, exponent);`)

      assert(result.modified, "transform Math.pow() with variables")
      assert.match(result.code, /base \*\* exponent/)
    })

    test("with complex expressions", () => {
      const result = transform(`const result = Math.pow(x + 1, y * 2);`)

      assert(result.modified, "transform Math.pow() with complex expressions")
      assert.match(result.code, /\(x \+ 1\) \*\* \(y \* 2\)/)
    })

    test("in expressions", () => {
      const result = transform(`const area = Math.PI * Math.pow(radius, 2);`)

      assert(result.modified, "transform Math.pow() in expressions")
      assert.match(result.code, /Math\.PI \* radius \*\* 2/)
    })

    test("wrong number of arguments", () => {
      const result = transform(`const result = Math.pow(2);`)

      assert(!result.modified, "skip Math.pow() with wrong number of arguments")
    })

    test("nested calls", () => {
      const result = transform(`const result = Math.pow(Math.pow(2, 3), 4);`)

      assert(result.modified, "transform nested Math.pow() in multiple passes")
      assert.match(result.code, /2 \*\* 3 \*\* 4/)
    })
  })
})
