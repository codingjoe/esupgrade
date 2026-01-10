import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("nullishCoalescingOperator", () => {
    test("basic null and undefined check", () => {
      const result = transform(
        `const value = x !== null && x !== undefined ? x : defaultValue;`,
      )

      assert(result.modified, "transform null/undefined check to ??")
      assert.match(result.code, /const value = x \?\? defaultValue/)
    })

    test("swapped order: undefined and null check", () => {
      const result = transform(
        `const value = x !== undefined && x !== null ? x : defaultValue;`,
      )

      assert(result.modified, "transform undefined/null check to ??")
      assert.match(result.code, /const value = x \?\? defaultValue/)
    })

    test("null on right side of comparison", () => {
      const result = transform(
        `const value = null !== x && undefined !== x ? x : defaultValue;`,
      )

      assert(result.modified, "transform with null/undefined on left")
      assert.match(result.code, /const value = x \?\? defaultValue/)
    })

    test("member expression", () => {
      const result = transform(
        `const value = obj.prop !== null && obj.prop !== undefined ? obj.prop : defaultValue;`,
      )

      assert(result.modified, "transform member expression null/undefined check")
      assert.match(result.code, /const value = obj\.prop \?\? defaultValue/)
    })

    test("nested member expression", () => {
      const result = transform(
        `const value = obj.a.b !== null && obj.a.b !== undefined ? obj.a.b : 0;`,
      )

      assert(result.modified, "transform nested member expression")
      assert.match(result.code, /const value = obj\.a\.b \?\? 0/)
    })

    test("default value is expression", () => {
      const result = transform(
        `const value = x !== null && x !== undefined ? x : getDefault();`,
      )

      assert(result.modified, "transform with expression as default")
      assert.match(result.code, /const value = x \?\? getDefault\(\)/)
    })

    test("default value is literal number", () => {
      const result = transform(
        `const value = count !== null && count !== undefined ? count : 0;`,
      )

      assert(result.modified, "transform with literal number default")
      assert.match(result.code, /const value = count \?\? 0/)
    })

    test("default value is literal string", () => {
      const result = transform(
        `const value = name !== null && name !== undefined ? name : 'unknown';`,
      )

      assert(result.modified, "transform with literal string default")
      assert.match(result.code, /const value = name \?\? 'unknown'/)
    })

    test("should not transform || operator", () => {
      const result = transform(`const value = x || defaultValue;`)

      assert(!result.modified, "skip || operator")
    })

    test("should not transform only null check", () => {
      const result = transform(`const value = x !== null ? x : defaultValue;`)

      assert(!result.modified, "skip only null check")
    })

    test("should not transform only undefined check", () => {
      const result = transform(`const value = x !== undefined ? x : defaultValue;`)

      assert(!result.modified, "skip only undefined check")
    })

    test("should not transform when consequent differs", () => {
      const result = transform(
        `const value = x !== null && x !== undefined ? y : defaultValue;`,
      )

      assert(!result.modified, "skip when consequent is different variable")
    })

    test("should not transform === checks", () => {
      const result = transform(
        `const value = x === null && x === undefined ? x : defaultValue;`,
      )

      assert(!result.modified, "skip === checks (wrong logic)")
    })

    test("should not transform mixed checks", () => {
      const result = transform(
        `const value = x !== null && y !== undefined ? x : defaultValue;`,
      )

      assert(!result.modified, "skip when checking different variables")
    })

    test("computed member expression", () => {
      const result = transform(
        `const value = obj[key] !== null && obj[key] !== undefined ? obj[key] : 0;`,
      )

      assert(result.modified, "transform computed member expression")
      assert.match(result.code, /const value = obj\[key\] \?\? 0/)
    })

    test("multiple transformations in same code", () => {
      const result = transform(`
      const a = x !== null && x !== undefined ? x : 1;
      const b = y !== null && y !== undefined ? y : 2;
    `)

      assert(result.modified, "transform multiple occurrences")
      assert.match(result.code, /const a = x \?\? 1/)
      assert.match(result.code, /const b = y \?\? 2/)
    })

    test("within function call", () => {
      const result = transform(
        `doSomething(value !== null && value !== undefined ? value : 'default');`,
      )

      assert(result.modified, "transform within function call")
      assert.match(result.code, /doSomething\(value \?\? 'default'\)/)
    })

    test("within return statement", () => {
      const result = transform(`
      function getValue(x) {
        return x !== null && x !== undefined ? x : 0;
      }
    `)

      assert(result.modified, "transform within return statement")
      assert.match(result.code, /return x \?\? 0/)
    })

    test("should not transform with === null (wrong operator)", () => {
      const result = transform(
        `const value = x === null && x === undefined ? x : defaultValue;`,
      )

      assert(!result.modified, "skip === checks")
    })

    test("should not transform with mixed operators", () => {
      const result = transform(
        `const value = x !== null && x === undefined ? x : defaultValue;`,
      )

      assert(!result.modified, "skip mixed !== and === checks")
    })

    test("should not transform === null with !== undefined", () => {
      const result = transform(
        `const value = x === null && x !== undefined ? x : defaultValue;`,
      )

      assert(!result.modified, "skip when first is ===")
    })

    test("should not transform swapped order with === operators", () => {
      const result = transform(
        `const value = x === undefined && x === null ? x : defaultValue;`,
      )

      assert(!result.modified, "skip swapped === checks")
    })

    test("should not transform swapped order with only one negated", () => {
      const result = transform(
        `const value = x !== undefined && x === null ? x : defaultValue;`,
      )

      assert(!result.modified, "skip swapped mixed operators")
    })

    test("should not transform when checking different properties", () => {
      const result = transform(
        `const value = obj.a !== null && obj.b !== undefined ? obj.a : defaultValue;`,
      )

      assert(!result.modified, "skip when properties differ")
    })

    test("should not transform with swapped different properties", () => {
      const result = transform(
        `const value = obj.b !== undefined && obj.a !== null ? obj.a : defaultValue;`,
      )

      assert(!result.modified, "skip swapped when properties differ")
    })

    test("should not transform when consequent differs", () => {
      const result = transform(
        `const value = x !== null && x !== undefined ? y : defaultValue;`,
      )

      assert(!result.modified, "skip when consequent is different variable")
    })

    test("should not transform swapped order when consequent differs", () => {
      const result = transform(
        `const value = x !== undefined && x !== null ? y : defaultValue;`,
      )

      assert(!result.modified, "skip swapped when consequent differs")
    })

    test("should not transform non-null/undefined comparisons", () => {
      const result = transform(
        `const value = x !== 0 && x !== false ? x : defaultValue;`,
      )

      assert(!result.modified, "skip non-null/undefined checks")
    })

    test("should not transform with non-binary expression", () => {
      const result = transform(`const value = x && y ? x : defaultValue;`)

      assert(!result.modified, "skip non-binary expressions")
    })

    test("deeply nested member expression with computed properties", () => {
      const result = transform(
        `const value = obj.a[b].c !== null && obj.a[b].c !== undefined ? obj.a[b].c : 0;`,
      )

      assert(result.modified, "transform deeply nested computed member expression")
      assert.match(result.code, /const value = obj\.a\[b\]\.c \?\? 0/)
    })

    test("multiple computed properties", () => {
      const result = transform(
        `const value = obj[a][b] !== null && obj[a][b] !== undefined ? obj[a][b] : 0;`,
      )

      assert(result.modified, "transform multiple computed properties")
      assert.match(result.code, /const value = obj\[a\]\[b\] \?\? 0/)
    })

    test("should not transform computed vs non-computed member expression", () => {
      const result = transform(
        `const value = obj.a !== null && obj[a] !== undefined ? obj.a : 0;`,
      )

      assert(!result.modified, "skip when computed property differs")
    })

    test("should not transform when nested objects differ", () => {
      const result = transform(
        `const value = obj1.prop !== null && obj2.prop !== undefined ? obj1.prop : 0;`,
      )

      assert(!result.modified, "skip when nested objects differ")
    })

    test("should not transform computed vs non-computed for same property name", () => {
      const result = transform(
        `const value = obj.prop !== null && obj[prop] !== undefined ? obj.prop : 0;`,
      )

      assert(!result.modified, "skip when one is computed and one is not")
    })

    test("both computed with same key should transform", () => {
      const result = transform(
        `const value = obj[key] !== null && obj[key] !== undefined ? obj[key] : 0;`,
      )

      assert(result.modified, "transform when both are computed with same key")
      assert.match(result.code, /const value = obj\[key\] \?\? 0/)
    })

    test("triple nested member expression", () => {
      const result = transform(
        `const value = obj.a.b.c !== null && obj.a.b.c !== undefined ? obj.a.b.c : 0;`,
      )

      assert(result.modified, "transform triple nested member expression")
      assert.match(result.code, /const value = obj\.a\.b\.c \?\? 0/)
    })

    test("should not transform with different function callees", () => {
      const result = transform(
        `const value = fn1() !== null && fn2() !== undefined ? fn1() : defaultValue;`,
      )

      assert(!result.modified, "skip when function callees differ")
    })

    test("should not transform with different function argument counts", () => {
      const result = transform(
        `const value = fn(a) !== null && fn(a, b) !== undefined ? fn(a) : defaultValue;`,
      )

      assert(!result.modified, "skip when function argument counts differ")
    })

    test("should not transform with different function argument values", () => {
      const result = transform(
        `const value = fn(a) !== null && fn(b) !== undefined ? fn(a) : defaultValue;`,
      )

      assert(!result.modified, "skip when function argument values differ")
    })
  })
})
