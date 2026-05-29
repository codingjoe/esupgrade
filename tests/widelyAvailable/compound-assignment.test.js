import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("compoundAssignment", () => {
    test("transforms addition assignment", () => {
      assert.match(transform(`x = x + y`).code, /x \+= y/)
    })

    test("transforms subtraction assignment", () => {
      assert.match(transform(`x = x - y`).code, /x -= y/)
    })

    test("transforms multiplication assignment", () => {
      assert.match(transform(`x = x * y`).code, /x \*= y/)
    })

    test("transforms division assignment", () => {
      assert.match(transform(`x = x / y`).code, /x \/= y/)
    })

    test("transforms remainder assignment", () => {
      assert.match(transform(`x = x % y`).code, /x %= y/)
    })

    test("transforms exponentiation assignment", () => {
      assert.match(transform(`x = x ** y`).code, /x \*\*= y/)
    })

    test("transforms member expression addition", () => {
      assert.match(transform(`obj.prop = obj.prop + y`).code, /obj\.prop \+= y/)
    })

    test("transforms computed member expression addition", () => {
      assert.match(transform(`obj[key] = obj[key] + y`).code, /obj\[key\] \+= y/)
    })

    test("transforms x = x + 1 statement to x++", () => {
      assert.match(transform(`x = x + 1`).code, /x\+\+/)
    })

    test("transforms x = x - 1 statement to x--", () => {
      assert.match(transform(`x = x - 1`).code, /x--/)
    })

    test("keeps x += 1 form when x = x + 1 is used as expression", () => {
      const result = transform(`y = (x = x + 1)`)
      assert.match(result.code, /x \+= 1/)
      assert.doesNotMatch(result.code, /x\+\+/)
    })

    test("keeps x -= 1 form when x = x - 1 is used as expression", () => {
      const result = transform(`y = (x = x - 1)`)
      assert.match(result.code, /x -= 1/)
      assert.doesNotMatch(result.code, /x--/)
    })

    test("skips when left and right differ", () => {
      assert(!transform(`x = y + z`).modified)
    })

    test("skips plain assignment", () => {
      assert(!transform(`x = 5`).modified)
    })

    test("skips already transformed addition assignment", () => {
      assert(!transform(`x += y`).modified)
    })

    test("skips already transformed subtraction assignment", () => {
      assert(!transform(`x -= y`).modified)
    })

    test("skips already transformed increment", () => {
      assert(!transform(`x++`).modified)
    })

    test("skips already transformed decrement", () => {
      assert(!transform(`x--`).modified)
    })

    test("transforms multiple compound patterns in same code", () => {
      const result = transform(`x = x + a;\ny = y * b;`)
      assert.match(result.code, /x \+= a/)
      assert.match(result.code, /y \*= b/)
    })
  })
})
