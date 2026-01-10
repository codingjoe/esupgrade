import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("indexOfToIncludes", () => {
    describe("array indexOf patterns", () => {
      test("[].indexOf(item) !== -1", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) !== -1;`)

        assert(result.modified, "transform indexOf !== -1")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("[].indexOf(item) > -1", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) > -1;`)

        assert(result.modified, "transform indexOf > -1")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("[].indexOf(item) >= 0", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) >= 0;`)

        assert(result.modified, "transform indexOf >= 0")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 !== [].indexOf(item)", () => {
        const result = transform(`const found = -1 !== [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform -1 !== indexOf")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 < [].indexOf(item)", () => {
        const result = transform(`const found = -1 < [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform -1 < indexOf")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: 0 <= [].indexOf(item)", () => {
        const result = transform(`const found = 0 <= [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform 0 <= indexOf")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })

    describe("negated patterns", () => {
      test("[].indexOf(item) === -1", () => {
        const result = transform(`const notFound = [1, 2, 3].indexOf(item) === -1;`)

        assert(result.modified, "transform indexOf === -1")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("[].indexOf(item) <= -1", () => {
        const result = transform(`const notFound = [1, 2, 3].indexOf(item) <= -1;`)

        assert(result.modified, "transform indexOf <= -1")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("[].indexOf(item) < 0", () => {
        const result = transform(`const notFound = [1, 2, 3].indexOf(item) < 0;`)

        assert(result.modified, "transform indexOf < 0")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 === [].indexOf(item)", () => {
        const result = transform(`const notFound = -1 === [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform -1 === indexOf")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 >= [].indexOf(item)", () => {
        const result = transform(`const notFound = -1 >= [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform -1 >= indexOf")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: 0 > [].indexOf(item)", () => {
        const result = transform(`const notFound = 0 > [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform 0 > indexOf")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })

    describe("string indexOf patterns", () => {
      test("''.indexOf(substr) !== -1", () => {
        const result = transform(`const found = "hello".indexOf(substr) !== -1;`)

        assert(result.modified, "transform string indexOf !== -1")
        assert.match(result.code, /const found = "hello"\.includes\(substr\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("''.indexOf(substr) > -1", () => {
        const result = transform(`const found = "hello".indexOf(substr) > -1;`)

        assert(result.modified, "transform string indexOf > -1")
        assert.match(result.code, /const found = "hello"\.includes\(substr\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("''.indexOf(substr) >= 0", () => {
        const result = transform(`const found = "hello".indexOf(substr) >= 0;`)

        assert(result.modified, "transform string indexOf >= 0")
        assert.match(result.code, /const found = "hello"\.includes\(substr\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("''.indexOf('literal') !== -1", () => {
        const result = transform(`if ("test".indexOf('hello') !== -1) { }`)

        assert(result.modified, "transform string indexOf with literal")
        assert.match(result.code, /if \("test"\.includes\('hello'\)\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("template literal indexOf", () => {
        const result = transform("const found = `hello`.indexOf(item) !== -1;")

        assert(result.modified, "transform template literal indexOf")
        assert.match(result.code, /const found = `hello`\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })

    describe("complex expressions", () => {
      test("array method chain", () => {
        const result = transform(
          `const found = [1,2,3].map(x => x).indexOf(item) !== -1;`,
        )

        assert(result.modified, "transform with array method chain")
        assert.match(
          result.code,
          /const found = \[1, ?2, ?3\]\.map\(x => x\)\.includes\(item\)/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("string method chain", () => {
        const result = transform(
          `const found = "hello".toUpperCase().indexOf(item) !== -1;`,
        )

        assert(result.modified, "transform with string method chain")
        assert.match(
          result.code,
          /const found = "hello"\.toUpperCase\(\)\.includes\(item\)/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("in if condition with array literal", () => {
        const result = transform(
          `if ([1, 2, 3].indexOf(item) !== -1) { console.log('found'); }`,
        )

        assert(result.modified, "transform in if condition")
        assert.match(result.code, /if \(\[1, 2, 3\]\.includes\(item\)\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("in ternary expression with array literal", () => {
        const result = transform(
          `const result = [1, 2, 3].indexOf(item) !== -1 ? 'yes' : 'no';`,
        )

        assert(result.modified, "transform in ternary expression")
        assert.match(
          result.code,
          /const result = \[1, 2, 3\]\.includes\(item\) \? 'yes' : 'no'/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("negated in if condition with array literal", () => {
        const result = transform(
          `if ([1, 2, 3].indexOf(item) === -1) { console.log('not found'); }`,
        )

        assert(result.modified, "transform negated in if condition")
        assert.match(result.code, /if \(!\[1, 2, 3\]\.includes\(item\)\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("Array.from() with indexOf", () => {
        const result = transform(
          `const found = Array.from(items).indexOf(item) !== -1;`,
        )

        assert(result.modified, "transform Array.from() with indexOf")
        assert.match(result.code, /const found = \[\.\.\.items\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("new Array() with indexOf", () => {
        const result = transform(
          `const found = new Array(1, 2, 3).indexOf(item) !== -1;`,
        )

        assert(result.modified, "transform new Array() with indexOf")
        assert.match(
          result.code,
          /const found = new Array\(1, 2, 3\)\.includes\(item\)/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })

    describe("skip patterns", () => {
      test("identifier - unknown type", () => {
        const result = transform(`const found = arr.indexOf(item) !== -1;`)

        assert(!result.modified, "skip unknown type (identifier)")
      })
      test("indexOf with fromIndex parameter", () => {
        const result = transform(`const found = arr.indexOf(item, 5) !== -1;`)

        assert(!result.modified, "skip indexOf with fromIndex")
      })

      test("indexOf without comparison", () => {
        const result = transform(`const index = arr.indexOf(item);`)

        assert(!result.modified, "skip indexOf without comparison")
      })

      test("indexOf compared to other values", () => {
        const result = transform(`const found = arr.indexOf(item) > 0;`)

        assert(!result.modified, "skip indexOf compared to other values")
      })

      test("indexOf compared to variable", () => {
        const result = transform(`const found = arr.indexOf(item) !== someValue;`)

        assert(!result.modified, "skip indexOf compared to variable")
      })

      test("indexOf with invalid operators for -1", () => {
        const result = transform(`const found = arr.indexOf(item) < -1;`)

        assert(!result.modified, "skip invalid operators")
      })

      test("indexOf with invalid operators for 0", () => {
        const result = transform(`const found = arr.indexOf(item) > 0;`)

        assert(!result.modified, "skip > 0 comparison")
      })

      test("indexOf with == operator", () => {
        const result = transform(`const found = arr.indexOf(item) == -1;`)

        assert(!result.modified, "skip loose equality")
      })

      test("indexOf with != operator", () => {
        const result = transform(`const found = arr.indexOf(item) != -1;`)

        assert(!result.modified, "skip loose inequality")
      })

      test("[].indexOf(item) <= -1", () => {
        const result = transform(`const notFound = [1, 2, 3].indexOf(item) <= -1;`)

        assert(result.modified, "transform indexOf <= -1")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 <= [].indexOf(item) (invalid for -1)", () => {
        const result = transform(`const notFound = -1 <= [1, 2, 3].indexOf(item);`)

        assert(!result.modified, "skip -1 <= indexOf comparison")
      })

      test("[].indexOf(item) < -1 (invalid for -1)", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) < -1;`)

        assert(!result.modified, "skip < -1 comparison")
      })

      test("[].indexOf(item) >= -1 (invalid for -1)", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) >= -1;`)

        assert(!result.modified, "skip >= -1 comparison")
      })

      test("[].indexOf(item) < 0 (negated, transforms)", () => {
        const result = transform(`const notFound = [1, 2, 3].indexOf(item) < 0;`)

        assert(result.modified, "transform indexOf < 0")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("[].indexOf(item) > 0 (invalid for 0)", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) > 0;`)

        assert(!result.modified, "skip > 0 comparison")
      })

      test("reversed: -1 !== [].indexOf(item) (valid)", () => {
        const result = transform(`const found = -1 !== [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform -1 !== indexOf")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 > [].indexOf(item) (invalid for reversed -1)", () => {
        const result = transform(`const found = -1 > [1, 2, 3].indexOf(item);`)

        assert(!result.modified, "skip -1 > indexOf comparison")
      })

      test("reversed: 0 < [].indexOf(item) (invalid for reversed 0)", () => {
        const result = transform(`const found = 0 < [1, 2, 3].indexOf(item);`)

        assert(!result.modified, "skip 0 < indexOf comparison")
      })

      test("reversed: 0 >= [].indexOf(item) (invalid for reversed 0)", () => {
        const result = transform(`const found = 0 >= [1, 2, 3].indexOf(item);`)

        assert(!result.modified, "skip 0 >= indexOf comparison")
      })

      test("[].indexOf(item) compared to variable", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) !== x;`)

        assert(!result.modified, "skip indexOf compared to variable")
      })

      test("[].indexOf(item) compared to non-numeric constant", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) !== 'zero';`)

        assert(!result.modified, "skip indexOf compared to non-numeric value")
      })
    })

    describe("real-world patterns", () => {
      test("combined with logical operators", () => {
        const result = transform(
          `const valid = [1, 2, 3].indexOf(item) !== -1 && [1, 2, 3].length > 0;`,
        )

        assert(result.modified, "transform with logical operators")
        assert.match(
          result.code,
          /const valid = \[1, 2, 3\]\.includes\(item\) && \[1, 2, 3\]\.length > 0/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("multiple indexOf checks", () => {
        const result = transform(
          `const found = [1, 2].indexOf(x) !== -1 || [3, 4].indexOf(y) !== -1;`,
        )

        assert(result.modified, "transform multiple indexOf checks")
        assert.match(
          result.code,
          /const found = \[1, 2\]\.includes\(x\) \|\| \[3, 4\]\.includes\(y\)/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("in return statement", () => {
        const result = transform(`return [1, 2, 3].indexOf(target) !== -1;`)

        assert(result.modified, "transform in return statement")
        assert.match(result.code, /return \[1, 2, 3\]\.includes\(target\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("assigned to variable", () => {
        const result = transform(`const hasItem = [1, 2, 3].indexOf(searchValue) >= 0;`)

        assert(result.modified, "transform assigned to variable")
        assert.match(
          result.code,
          /const hasItem = \[1, 2, 3\]\.includes\(searchValue\)/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })
  })
})
