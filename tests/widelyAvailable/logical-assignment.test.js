import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("logicalAssignment", () => {
    test("transforms nullish assignment pattern", () => {
      assert.match(transform(`x = x ?? y`).code, /x \?\?= y/)
    })

    test("transforms logical OR assignment pattern", () => {
      assert.match(transform(`x = x || y`).code, /x \|\|= y/)
    })

    test("transforms logical AND assignment pattern", () => {
      assert.match(transform(`x = x && y`).code, /x &&= y/)
    })

    test("transforms member expression", () => {
      assert.match(transform(`obj.prop = obj.prop ?? y`).code, /obj\.prop \?\?= y/)
    })

    test("transforms computed member expression", () => {
      assert.match(transform(`obj[key] = obj[key] ?? y`).code, /obj\[key\] \?\?= y/)
    })

    test("transforms if null or undefined check", () => {
      assert.match(
        transform(`if (x === null || x === undefined) x = y`).code,
        /x \?\?= y/,
      )
    })

    test("transforms if undefined or null check (swapped order)", () => {
      assert.match(
        transform(`if (x === undefined || x === null) x = y`).code,
        /x \?\?= y/,
      )
    })

    test("transforms if null or undefined check with member expression", () => {
      assert.match(
        transform(`if (obj.prop === null || obj.prop === undefined) obj.prop = y`).code,
        /obj\.prop \?\?= y/,
      )
    })

    test("skips when left and right differ", () => {
      assert(!transform(`x = y ?? z`).modified)
    })

    test("skips plain assignment", () => {
      assert(!transform(`x = 5`).modified)
    })

    test("skips when left differs from logical left for OR", () => {
      assert(!transform(`x = y || z`).modified)
    })

    test("skips when left differs from logical left for AND", () => {
      assert(!transform(`x = y && z`).modified)
    })

    test("skips already transformed nullish assignment", () => {
      assert(!transform(`x ??= y`).modified)
    })

    test("skips already transformed OR assignment", () => {
      assert(!transform(`x ||= y`).modified)
    })

    test("skips already transformed AND assignment", () => {
      assert(!transform(`x &&= y`).modified)
    })

    test("skips if statement with alternate branch", () => {
      assert(!transform(`if (x === null || x === undefined) x = y; else z()`).modified)
    })

    test("skips if null check only", () => {
      assert(!transform(`if (x === null) x = y`).modified)
    })

    test("skips if && instead of || in if statement", () => {
      assert(!transform(`if (x === null && x === undefined) x = y`).modified)
    })

    test("skips if undefined check only", () => {
      assert(!transform(`if (x === undefined) x = y`).modified)
    })

    test("skips if neither null nor undefined in || checks", () => {
      assert(!transform(`if (x === 5 || x === 10) x = y`).modified)
    })

    test("skips if only null checks in || (no undefined)", () => {
      assert(!transform(`if (x === null || x === null) x = y`).modified)
    })

    test("skips if mixed negated: null === and undefined !==", () => {
      assert(!transform(`if (x === null || x !== undefined) x = y`).modified)
    })

    test("skips if different variables checked and assigned", () => {
      assert(!transform(`if (x === null || x === undefined) y = z`).modified)
    })

    test("skips if !== null used (negated)", () => {
      assert(!transform(`if (x !== null || x !== undefined) x = y`).modified)
    })

    test("skips if different variables in null/undefined checks", () => {
      assert(!transform(`if (x === null || y === undefined) x = z`).modified)
    })

    test("skips if consequent is a block statement", () => {
      assert(!transform(`if (x === null || x === undefined) { x = y; }`).modified)
    })

    test("skips if consequent is not a simple assignment", () => {
      assert(!transform(`if (x === null || x === undefined) doSomething()`).modified)
    })

    test("skips if consequent is compound assignment", () => {
      assert(!transform(`if (x === null || x === undefined) x += y`).modified)
    })

    test("transforms multiple logical assignment patterns in same code", () => {
      const result = transform(`x = x ?? a;\ny = y || b;`)
      assert.match(result.code, /x \?\?= a/)
      assert.match(result.code, /y \|\|= b/)
    })
  })
})
