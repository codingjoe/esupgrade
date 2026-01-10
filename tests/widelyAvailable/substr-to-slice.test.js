import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("substrToSlice", () => {
    describe("basic transformations", () => {
      test("substr(start, length) on string literal", () => {
        const result = transform(`const result = "hello world".substr(0, 5);`)

        assert(result.modified, "transform substr with start and length")
        assert.match(result.code, /const result = "hello world"\.slice\(0, 0 \+ 5\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr(start) on string literal", () => {
        const result = transform(`const result = "hello world".substr(6);`)

        assert(result.modified, "transform substr with only start")
        assert.match(result.code, /const result = "hello world"\.slice\(6\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr() with no arguments", () => {
        const result = transform(`const result = "hello".substr();`)

        assert(result.modified, "transform substr with no arguments")
        assert.match(result.code, /const result = "hello"\.slice\(\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr with variables", () => {
        const result = transform(`const result = str.substr(start, length);`)

        assert(!result.modified, "skip substr on unknown type")
      })

      test("substr on template literal", () => {
        const result = transform("const result = `hello world`.substr(0, 5);")

        assert(result.modified, "transform substr on template literal")
        assert.match(result.code, /const result = `hello world`\.slice\(0, 0 \+ 5\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr on string method chain", () => {
        const result = transform(`const result = "hello".toUpperCase().substr(0, 3);`)

        assert(result.modified, "transform substr on string method chain")
        assert.match(
          result.code,
          /const result = "hello"\.toUpperCase\(\)\.slice\(0, 0 \+ 3\)/,
        )
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr with literal arguments", () => {
        const result = transform(`const s = "test string".substr(5, 6);`)

        assert(result.modified, "transform substr with literal arguments")
        assert.match(result.code, /const s = "test string"\.slice\(5, 5 \+ 6\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr with expression arguments", () => {
        const result = transform(
          `const s = "hello world".substr(offset, limit - offset);`,
        )

        assert(result.modified, "transform substr with expression arguments")
        assert.match(
          result.code,
          /const s = "hello world"\.slice\(offset, offset \+ \(limit - offset\)\)/,
        )
        assert.doesNotMatch(result.code, /substr/)
      })
    })

    describe("chained methods", () => {
      test("substr().trim()", () => {
        const result = transform(`const s = "hello world".substr(0, 5).trim();`)

        assert(result.modified, "transform substr in method chain")
        assert.match(
          result.code,
          /const s = "hello world"\.slice\(0, 0 \+ 5\)\.trim\(\)/,
        )
        assert.doesNotMatch(result.code, /substr/)
      })

      test("trim().substr()", () => {
        const result = transform(`const s = "  hello  ".trim().substr(0, 3);`)

        assert(result.modified, "transform substr after trim")
        assert.match(result.code, /const s = "  hello  "\.trim\(\)\.slice\(0, 0 \+ 3\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("multiple string method chains", () => {
        const result = transform(
          `const s = "hello".toLowerCase().substr(1, 3).toUpperCase();`,
        )

        assert(result.modified, "transform substr in complex chain")
        assert.match(
          result.code,
          /const s = "hello"\.toLowerCase\(\)\.slice\(1, 1 \+ 3\)\.toUpperCase\(\)/,
        )
        assert.doesNotMatch(result.code, /substr/)
      })
    })

    describe("edge cases", () => {
      test("substr with negative start", () => {
        const result = transform(`const s = "hello".substr(-3, 2);`)

        assert(result.modified, "transform substr with negative start")
        assert.match(result.code, /const s = "hello"\.slice\(-3, -3 \+ 2\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr with more than 2 arguments", () => {
        const result = transform(`const s = "hello".substr(0, 3, extra);`)

        assert(result.modified, "transform substr even with extra arguments")
        assert.match(result.code, /const s = "hello"\.slice\(0, 0 \+ 3\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("multiple substr calls", () => {
        const result = transform(`
        const a = "hello".substr(0, 2);
        const b = "world".substr(1, 3);
      `)

        assert(result.modified, "transform multiple substr calls")
        assert.match(result.code, /"hello"\.slice\(0, 0 \+ 2\)/)
        assert.match(result.code, /"world"\.slice\(1, 1 \+ 3\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr in expression", () => {
        const result = transform(
          `const result = "prefix" + "hello".substr(0, 3) + "suffix";`,
        )

        assert(result.modified, "transform substr in expression")
        assert.match(result.code, /"hello"\.slice\(0, 0 \+ 3\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr in function call", () => {
        const result = transform(`console.log("test".substr(1, 2));`)

        assert(result.modified, "transform substr in function call")
        assert.match(result.code, /console\.info\("test"\.slice\(1, 1 \+ 2\)\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr in return statement", () => {
        const result = transform(`function get() { return "value".substr(0, 3); }`)

        assert(result.modified, "transform substr in return")
        assert.match(result.code, /return "value"\.slice\(0, 0 \+ 3\)/)
        assert.doesNotMatch(result.code, /substr/)
      })
    })

    describe("non-transformable patterns", () => {
      test("substr on unknown variable", () => {
        const result = transform(`const s = str.substr(0, 5);`)

        assert(!result.modified, "skip substr on unknown variable")
      })

      test("substr on object property", () => {
        const result = transform(`const s = obj.prop.substr(0, 5);`)

        assert(!result.modified, "skip substr on object property")
      })

      test("substr on function call result", () => {
        const result = transform(`const s = getString().substr(0, 5);`)

        assert(!result.modified, "skip substr on function call")
      })

      test("substr on array access", () => {
        const result = transform(`const s = arr[0].substr(0, 5);`)

        assert(!result.modified, "skip substr on array access")
      })
    })

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

        assert(
          result.modified,
          "transform Array.from(arguments) in function expression",
        )
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
        assert.doesNotMatch(
          result.code,
          /\.\.\.args\)/,
          "should NOT add rest parameter",
        )
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
})
