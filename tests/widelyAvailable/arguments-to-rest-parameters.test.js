import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("argumentsToRestParameters", () => {
    test("Array.from(arguments) in function declaration", () => {
      const result = transform(`
function fn() {
  const args = Array.from(arguments);
  console.log(args);
}
    `)

      assert(result.modified, "transform Array.from(arguments)")
      assert.match(result.code, /function fn\(\.\.\.args\)/)
      assert.doesNotMatch(result.code, /Array\.from\(arguments\)/)
      assert.doesNotMatch(result.code, /const args/)
    })

    test("[].slice.call(arguments) in function declaration", () => {
      const result = transform(`
function fn() {
  const args = [].slice.call(arguments);
  process(args);
}
    `)

      assert(result.modified, "transform [].slice.call(arguments)")
      assert.match(result.code, /function fn\(\.\.\.args\)/)
      assert.doesNotMatch(result.code, /\[\]\.slice\.call\(arguments\)/)
      assert.doesNotMatch(result.code, /const args/)
    })

    test("Array.from(arguments) in function expression", () => {
      const result = transform(`
const myFunc = function() {
  const args = Array.from(arguments);
  return args.length;
};
    `)

      assert(result.modified, "transform Array.from(arguments) in function expression")
      // Note: namedArrowFunctionToNamedFunction converts this to a named function declaration
      assert.match(result.code, /function myFunc\(\.\.\.args\)/)
      assert.doesNotMatch(result.code, /Array\.from\(arguments\)/)
    })

    test("skip if arguments is used elsewhere", () => {
      const result = transform(`
function fn() {
  const args = Array.from(arguments);
  console.log(arguments.length);
}
    `)

      // arrayFromToSpread will convert Array.from(arguments) to [...arguments]
      // but argumentsToRestParameters should NOT add rest params because arguments is used elsewhere
      assert(result.modified, "other transformers run")
      assert.doesNotMatch(result.code, /\.\.\.args\)/, "should NOT add rest parameter")
      assert.match(result.code, /\[\.\.\.arguments\]/, "should keep [...arguments]")
      assert.match(result.code, /arguments\.length/, "arguments is still used")
    })

    test("skip if function already has rest parameters", () => {
      const result = transform(`
function fn(...existing) {
  const args = Array.from(arguments);
  console.log(args);
}
    `)

      // arrayFromToSpread will convert Array.from(arguments) to [...arguments]
      // but argumentsToRestParameters should NOT add another rest parameter
      assert(result.modified, "other transformers run")
      assert.match(
        result.code,
        /\.\.\.existing\)/,
        "should keep existing rest parameter",
      )
      assert.doesNotMatch(
        result.code,
        /\.\.\.args\)/,
        "should NOT add another rest parameter",
      )
      assert.match(result.code, /\[\.\.\.arguments\]/, "should keep [...arguments]")
    })

    test("skip arrow functions", () => {
      const result = transform(`
const fn = () => {
  const args = Array.from(arguments);
  console.log(args);
};
    `)

      // Arrow functions don't have arguments, so this pattern shouldn't exist in real code
      // but we should skip it anyway
      assert(result.modified, "other transformers run")
      assert.doesNotMatch(
        result.code,
        /\.\.\.args\)/,
        "should NOT add rest parameter to arrow",
      )
    })

    test("function with existing parameters", () => {
      const result = transform(`
function fn(a, b) {
  const args = Array.from(arguments);
  return args;
}
    `)

      assert(result.modified, "transform with existing parameters")
      assert.match(result.code, /function fn\(a, b, \.\.\.args\)/)
      assert.doesNotMatch(result.code, /Array\.from\(arguments\)/)
    })

    test("multiple variable declarations", () => {
      const result = transform(`
function fn() {
  const args = Array.from(arguments);
  const x = 1;
  return args;
}
    `)

      assert(result.modified, "transform with multiple declarations")
      assert.match(result.code, /function fn\(\.\.\.args\)/)
      assert.match(result.code, /const x = 1/)
      assert.doesNotMatch(result.code, /const args/)
    })

    test("skip if arguments is in nested function", () => {
      const result = transform(`
function fn() {
  const args = Array.from(arguments);
  function nested() {
console.log(arguments);
  }
  return args;
}
    `)

      assert(result.modified, "transform outer function")
      assert.match(result.code, /function fn\(\.\.\.args\)/)
      assert.match(
        result.code,
        /console\.info\(arguments\)/,
        "nested function keeps its arguments",
      )
    })

    test("skip if Array.from has mapping function", () => {
      const result = transform(`
function fn() {
  const args = Array.from(arguments, x => x * 2);
  return args;
}
    `)

      assert(!result.modified, "skip Array.from with mapping function")
    })

    test("skip [].slice.call with additional arguments", () => {
      const result = transform(`
function fn() {
  const args = [].slice.call(arguments, 1);
  return args;
}
    `)

      assert(!result.modified, "skip [].slice.call with additional arguments")
    })

    test("variable with different name", () => {
      const result = transform(`
function fn() {
  const myArgs = Array.from(arguments);
  return myArgs;
}
    `)

      assert(result.modified, "transform with different variable name")
      assert.match(result.code, /function fn\(\.\.\.myArgs\)/)
      assert.doesNotMatch(result.code, /Array\.from\(arguments\)/)
    })

    test("multiple declarators in same statement", () => {
      const result = transform(`
function fn() {
  const args = Array.from(arguments), x = 1, y = 2;
  return args;
}
    `)

      assert(result.modified, "transform preserving other declarators")
      assert.match(result.code, /function fn\(\.\.\.args\)/)
      assert.match(
        result.code,
        /const x = 1, y = 2/,
        "should preserve other declarators",
      )
      assert.doesNotMatch(result.code, /const args/)
    })
  })
})
