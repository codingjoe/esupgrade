import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("defaultParameterValues", () => {
    test("skip x = x || defaultValue pattern (unsafe)", () => {
      const result = transform(`
function fn(x) {
  x = x || 42;
  console.log(x);
}
      `)

      assert.doesNotMatch(result.code, /function fn\(x = 42\)/)
      assert.match(result.code, /x = x \|\| 42/)
    })

    test("if (x === undefined) x = defaultValue pattern", () => {
      const result = transform(`
function fn(x) {
  if (x === undefined) x = 42;
  console.log(x);
}
      `)

      assert(result.modified, "transform if (x === undefined) x = defaultValue")
      assert.match(result.code, /function fn\(x = 42\)/)
      assert.doesNotMatch(result.code, /if \(x === undefined\)/)
    })

    test("if (x === undefined) { x = defaultValue; } pattern", () => {
      const result = transform(`
function fn(x) {
  if (x === undefined) {
    x = 42;
  }
  console.log(x);
}
      `)

      assert(result.modified, "transform if (x === undefined) { x = defaultValue; }")
      assert.match(result.code, /function fn\(x = 42\)/)
      assert.doesNotMatch(result.code, /if \(x === undefined\)/)
    })

    test("multiple parameters with defaults", () => {
      const result = transform(`
function fn(x, y, z) {
  if (x === undefined) x = 1;
  if (y === undefined) y = 2;
  if (z === undefined) {
    z = 3;
  }
  console.log(x, y, z);
}
      `)

      assert(result.modified, "transform multiple parameters")
      assert.match(result.code, /function fn\(x = 1, y = 2, z = 3\)/)
      assert.doesNotMatch(result.code, /if \(x === undefined\)/)
      assert.doesNotMatch(result.code, /if \(y === undefined\)/)
      assert.doesNotMatch(result.code, /if \(z === undefined\)/)
    })

    test("arrow function with if undefined pattern", () => {
      const result = transform(`
const fn = (x) => {
  if (x === undefined) x = 42;
  return x;
};
      `)

      assert(result.modified, "transform arrow function")
      // Note: arrow function becomes a function declaration due to namedArrowFunctionToNamedFunction
      assert.match(result.code, /function fn\(x = 42\)/)
      assert.doesNotMatch(result.code, /if \(x === undefined\)/)
    })

    test("function expression with default", () => {
      const result = transform(`
const fn = function(x) {
  if (x === undefined) x = 42;
  return x;
};
      `)

      assert(result.modified, "transform function expression")
      // Note: function expression becomes a function declaration due to namedArrowFunctionToNamedFunction
      assert.match(result.code, /function fn\(x = 42\)/)
      assert.doesNotMatch(result.code, /if \(x === undefined\)/)
    })

    test("complex default value", () => {
      const result = transform(`
function fn(config) {
  if (config === undefined) config = { timeout: 1000, retries: 3 };
  return config;
}
      `)

      assert(result.modified, "transform with complex default")
      assert.match(
        result.code,
        /function fn\(config = \{ timeout: 1000, retries: 3 \}\)/,
      )
    })

    test("identifier default value", () => {
      const result = transform(`
function fn(x) {
  if (x === undefined) x = defaultValue;
  return x;
}
      `)

      assert(result.modified, "transform with identifier default")
      assert.match(result.code, /function fn\(x = defaultValue\)/)
    })

    test("default value is expression", () => {
      const result = transform(`
function fn(x) {
  if (x === undefined) x = getValue();
  return x;
}
      `)

      assert(result.modified, "transform with expression default")
      assert.match(result.code, /function fn\(x = getValue\(\)\)/)
    })

    test("skip when not a parameter", () => {
      const result = transform(`
function fn() {
  let x;
  if (x === undefined) x = 42;
  return x;
}
      `)

      assert(!result.modified, "skip when not a parameter")
    })

    test("skip when parameter already has default", () => {
      const result = transform(`
function fn(x = 10) {
  if (x === undefined) x = 42;
  return x;
}
      `)

      assert(!result.modified, "skip when parameter already has default")
    })

    test("skip when not at beginning of function", () => {
      const result = transform(`
function fn(x) {
  const y = 1;
  if (x === undefined) x = 42;
  return x;
}
      `)

      // Should not transform - if statement is not at the beginning
      assert(!result.modified, "skip when not at beginning")
      assert.match(result.code, /if \(x === undefined\) x = 42/)
    })

    test("skip destructured parameters", () => {
      const result = transform(`
function fn({ x }) {
  if (x === undefined) x = 42;
  return x;
}
      `)

      assert(!result.modified, "skip destructured parameters")
    })

    test("skip rest parameters", () => {
      const result = transform(`
function fn(...x) {
  if (x === undefined) x = [];
  return x;
}
      `)

      assert(!result.modified, "skip rest parameters")
    })

    test("skip when variable name doesn't match parameter", () => {
      const result = transform(`
function fn(x) {
  if (y === undefined) y = 42;
  return x;
}
      `)

      assert(!result.modified, "skip when variable doesn't match parameter")
    })

    test("skip arrow function without block body", () => {
      const result = transform(`
const fn = (x) => x || 42;
      `)

      // The arrow function will be converted to a function declaration
      // but the default parameter transformation should NOT apply
      // because the original arrow function didn't have a block body
      assert.doesNotMatch(result.code, /x = 42/)
    })

    test("mixed patterns - if undefined only", () => {
      const result = transform(`
function fn(x, y) {
  if (x === undefined) x = 1;
  if (y === undefined) y = 2;
  console.log(x, y);
}
      `)

      assert(result.modified, "transform if undefined patterns")
      assert.match(result.code, /function fn\(x = 1, y = 2\)/)
      assert.match(result.code, /console\.info\(x, y\)/)
    })

    test("skip wrong comparison operator", () => {
      const result = transform(`
function fn(x) {
  if (x == undefined) x = 42;
  return x;
}
      `)

      assert(!result.modified, "skip when using == instead of ===")
    })

    test("skip when comparing to null", () => {
      const result = transform(`
function fn(x) {
  if (x === null) x = 42;
  return x;
}
      `)

      assert(!result.modified, "skip when comparing to null")
    })

    test("skip if statement with else branch", () => {
      const result = transform(`
function fn(x) {
  if (x === undefined) x = 42;
  else x = 10;
  return x;
}
      `)

      assert(!result.modified, "skip if statement with else branch")
    })

    test("skip different left side in || pattern", () => {
      const result = transform(`
function fn(x) {
  x = y || 42;
  return x;
}
      `)

      assert(!result.modified, "skip when left side doesn't match")
    })

    test("TypeScript function with type annotations", () => {
      const result = transform(`
function fn(x: number) {
  if (x === undefined) x = 42;
  return x;
}
      `)

      assert(result.modified, "transform TypeScript function")
      assert.match(result.code, /function fn\(x: number = 42\)/)
    })

    test("multiple parameters, only some have defaults", () => {
      const result = transform(`
function fn(a, b, c) {
  if (a === undefined) a = 1;
  console.log(a, b, c);
}
      `)

      assert(result.modified, "transform only parameters with defaults")
      assert.match(result.code, /function fn\(a = 1, b, c\)/)
      assert.match(result.code, /console\.info\(a, b, c\)/)
    })
  })
})
