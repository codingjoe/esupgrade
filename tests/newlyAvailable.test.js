import { describe, suite, test } from "node:test"
import assert from "node:assert/strict"
import { transform } from "../src/index.js"

suite("newly-available", () => {
  describe("Promise.try", () => {
    test("transforms resolve call with argument", () => {
      const result = transform(
        `const p = new Promise((resolve) => resolve(getData()));`,
        "newly-available",
      )
      assert(result.modified, "transform Promise constructor to Promise.try")
      assert.match(result.code, /Promise\.try/)
    })

    test("not available in widely-available baseline", () => {
      assert.doesNotMatch(
        transform(
          `const p = new Promise((resolve) => resolve(getData()));`,
          "widely-available",
        ).code,
        /Promise\.try/,
        "do not transform with widely-available baseline",
      )
    })

    test("transforms function passed to resolve", () => {
      const result = transform(
        `const p = new Promise((resolve) => setTimeout(resolve));`,
        "newly-available",
      )
      assert(result.modified)
      assert.match(
        result.code,
        /Promise\.try\(setTimeout\)/,
        "transform to Promise.try(setTimeout) not Promise.try(() => setTimeout(resolve))",
      )
      assert.doesNotMatch(result.code, /resolve/)
    })

    test("skip when awaited", () => {
      const result = transform(
        `async function foo() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}`,
        "newly-available",
      )
      assert(!result.modified, "do not transform awaited Promises")
      assert.match(result.code, /await new Promise/)
      assert.doesNotMatch(result.code, /Promise\.try/)
    })

    test("skip non-Promise constructors", () => {
      const result = transform(
        `const p = new MyPromise((resolve) => resolve(getData()));`,
        "newly-available",
      )
      assert(!result.modified)
      assert.match(result.code, /new MyPromise/)
    })

    test("skip with 0 arguments", () => {
      const result = transform(`const p = new Promise();`, "newly-available")
      assert(!result.modified)
      assert.match(result.code, /new Promise\(\)/)
    })

    test("skip with multiple arguments", () => {
      const result = transform(
        `const p = new Promise((resolve) => resolve(1), extraArg);`,
        "newly-available",
      )
      assert(!result.modified)
      assert.match(result.code, /new Promise/)
    })

    test("skip with non-function argument", () => {
      const result = transform(
        `const p = new Promise(executor);`,
        "newly-available",
      )
      assert(!result.modified)
      assert.match(result.code, /new Promise\(executor\)/)
    })

    test("skip with 0 params", () => {
      const result = transform(
        `const p = new Promise(() => process('test'));`,
        "newly-available",
      )
      assert(!result.modified)
      assert.match(result.code, /new Promise/)
    })

    test("skip with more than 2 params", () => {
      const result = transform(
        `const p = new Promise((resolve, reject, extra) => resolve(1));`,
        "newly-available",
      )
      assert(!result.modified)
      assert.match(result.code, /new Promise/)
    })

    test("transforms block statement with resolve call", () => {
      const result = transform(
        `const p = new Promise((resolve) => { resolve(getData()); });`,
        "newly-available",
      )
      assert(result.modified)
      assert.match(result.code, /Promise\.try/)
    })

    test("skip with arrow function expression body as function call", () => {
      const result = transform(
        `const p = new Promise((resolve) => computeValue());`,
        "newly-available",
      )
      assert(
        !result.modified,
        "do not transform because computeValue() is not calling resolve",
      )
      assert.match(result.code, /new Promise/)
    })

    test("skip with arrow function returning a value directly", () => {
      const result = transform(
        `const p = new Promise((resolve) => someFunction(arg1, arg2));`,
        "newly-available",
      )
      assert(
        !result.modified,
        "do not transform function call that doesn't involve resolve",
      )
      assert.match(result.code, /new Promise/)
    })

    test("skip with non-call expression body", () => {
      const result = transform(
        `const p = new Promise((resolve) => someValue);`,
        "newly-available",
      )
      assert(!result.modified)
      assert.match(result.code, /new Promise/)
    })

    test("skip with wrong number of arguments to resolve", () => {
      const result = transform(
        `const p = new Promise((resolve) => func(resolve, extra));`,
        "newly-available",
      )
      assert(!result.modified)
      assert.match(result.code, /new Promise/)
    })

    test("skip with non-identifier resolve", () => {
      const result = transform(
        `const p = new Promise((resolve) => func(123));`,
        "newly-available",
      )
      assert(!result.modified)
      assert.match(result.code, /new Promise/)
    })

    test("skip with resolve call with 0 arguments", () => {
      const result = transform(
        `const p = new Promise((resolve) => resolve());`,
        "newly-available",
      )
      assert(!result.modified)
      assert.match(result.code, /new Promise/)
    })

    test("skip with block with multiple statements", () => {
      const result = transform(
        `const p = new Promise((resolve) => {
        const data = getData();
        resolve(data);
      });`,
        "newly-available",
      )
      assert(!result.modified)
      assert.match(result.code, /new Promise/)
    })

    test("skip with block with non-expression statement", () => {
      const result = transform(
        `const p = new Promise((resolve) => {
        if (true) resolve(1);
      });`,
        "newly-available",
      )
      assert(!result.modified)
      assert.match(result.code, /new Promise/)
    })

    test("transforms function expression", () => {
      const result = transform(
        `const p = new Promise(function(resolve) { resolve(getData()); });`,
        "newly-available",
      )
      assert(result.modified)
      assert.match(result.code, /Promise\.try/)
    })

    test("transforms with both resolve and reject params", () => {
      const result = transform(
        `const p = new Promise((resolve, reject) => resolve(getData()));`,
        "newly-available",
      )
      assert(result.modified)
      assert.match(result.code, /Promise\.try/)
    })
  })
})
