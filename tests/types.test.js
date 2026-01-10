import { default as j } from "jscodeshift"
import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../src/index.js"
import { NodeTest, findEnclosingFunction } from "../src/types.js"

suite("types", () => {
  describe("NodeTest", () => {
    test("getIndexOfInfo returns null for non-binary expressions", () => {
      const node = j.literal(1)
      assert(!j.BinaryExpression.check(node))
      const test = new NodeTest(node)
      assert.equal(test.getIndexOfInfo(), null)
    })
  })

  describe("patternContainsIdentifier with null/undefined", () => {
    test("array destructuring with holes (null elements)", () => {
      const result = transform(`
    var [a, , b] = arr;
  `)

      assert(result.modified, "transform var with array holes")
      assert.match(result.code, /const \[a, , b\] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring with holes and reassignment", () => {
      const result = transform(`
    var [a, , b] = arr;
    a = 5;
  `)

      assert(result.modified, "transform var with array holes and reassignment")
      assert.match(result.code, /let \[a, , b\]/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring assignment with hole", () => {
      const result = transform(`
    var a, b;
    [a, , b] = arr;
  `)

      assert(
        result.modified,
        "transform vars reassigned via array destructuring with hole",
      )
      assert.match(result.code, /let a/)
      assert.match(result.code, /let b/)
    })

    test("nested array destructuring with holes", () => {
      const result = transform(`
    var [[x, , y], , z] = nestedArr;
  `)

      assert(result.modified, "transform var with nested array holes")
      assert.match(result.code, /const \[\[x, , y\], , z\] = nestedArr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring with multiple consecutive holes", () => {
      const result = transform(`
    var [a, , , b] = arr;
  `)

      assert(result.modified, "transform var with multiple consecutive holes")
      assert.match(result.code, /const \[a, , , b\] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring with trailing hole", () => {
      const result = transform(`
    var [a, b, ] = arr;
  `)

      assert(result.modified, "transform var with trailing hole")
      assert.match(result.code, /const \[a, b, \] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring with leading hole", () => {
      const result = transform(`
    var [ , a, b] = arr;
  `)

      assert(result.modified, "transform var with leading hole")
      assert.match(result.code, /const \[ , a, b\] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })
  })

  describe("findEnclosingFunction", () => {
    test("returns null when path has no parent", () => {
      const code = `function test() { return 42; }`
      const root = j(code)
      const program = root.find(j.Program).paths()[0]

      const result = findEnclosingFunction(program)

      assert.strictEqual(
        result,
        null,
        "should return null for path with no parent function",
      )
    })
  })
})
