import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { transform } from "../src/index.js"

describe("newly-available", () => {
  describe("Promise.try", () => {
    test("transforms resolve call with argument", () => {
      assert(
        transform(
          `const p = new Promise((resolve) => resolve(getData()));`,
          "newly-available",
        ).modified,
        "transform Promise constructor to Promise.try",
      )
      assert.match(
        transform(
          `const p = new Promise((resolve) => resolve(getData()));`,
          "newly-available",
        ).code,
        /Promise\.try/,
      )
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
      assert(
        transform(
          `const p = new Promise((resolve) => setTimeout(resolve));`,
          "newly-available",
        ).modified,
      )
      assert.match(
        transform(
          `const p = new Promise((resolve) => setTimeout(resolve));`,
          "newly-available",
        ).code,
        /Promise\.try\(setTimeout\)/,
        "transform to Promise.try(setTimeout) not Promise.try(() => setTimeout(resolve))",
      )
      assert.doesNotMatch(
        transform(
          `const p = new Promise((resolve) => setTimeout(resolve));`,
          "newly-available",
        ).code,
        /resolve/,
      )
    })

    test("skip when awaited", () => {
      assert(
        !transform(
          `async function foo() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}`,
          "newly-available",
        ).modified,
        "do not transform awaited Promises",
      )
      assert.match(
        transform(
          `async function foo() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}`,
          "newly-available",
        ).code,
        /await new Promise/,
      )
      assert.doesNotMatch(
        transform(
          `async function foo() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}`,
          "newly-available",
        ).code,
        /Promise\.try/,
      )
    })

    test("skip non-Promise constructors", () => {
      assert(
        !transform(
          `const p = new MyPromise((resolve) => resolve(getData()));`,
          "newly-available",
        ).modified,
      )
      assert.match(
        transform(
          `const p = new MyPromise((resolve) => resolve(getData()));`,
          "newly-available",
        ).code,
        /new MyPromise/,
      )
    })

    test("skip with 0 arguments", () => {
      assert(!transform(`const p = new Promise();`, "newly-available").modified)
      assert.match(
        transform(`const p = new Promise();`, "newly-available").code,
        /new Promise\(\)/,
      )
    })

    test("skip with multiple arguments", () => {
      assert(
        !transform(
          `const p = new Promise((resolve) => resolve(1), extraArg);`,
          "newly-available",
        ).modified,
      )
      assert.match(
        transform(
          `const p = new Promise((resolve) => resolve(1), extraArg);`,
          "newly-available",
        ).code,
        /new Promise/,
      )
    })

    test("skip with non-function argument", () => {
      assert(!transform(`const p = new Promise(executor);`, "newly-available").modified)
      assert.match(
        transform(`const p = new Promise(executor);`, "newly-available").code,
        /new Promise\(executor\)/,
      )
    })

    test("skip with 0 params", () => {
      assert(
        !transform(
          `const p = new Promise(() => console.log('test'));`,
          "newly-available",
        ).modified,
      )
      assert.match(
        transform(
          `const p = new Promise(() => console.log('test'));`,
          "newly-available",
        ).code,
        /new Promise/,
      )
    })

    test("skip with more than 2 params", () => {
      assert(
        !transform(
          `const p = new Promise((resolve, reject, extra) => resolve(1));`,
          "newly-available",
        ).modified,
      )
      assert.match(
        transform(
          `const p = new Promise((resolve, reject, extra) => resolve(1));`,
          "newly-available",
        ).code,
        /new Promise/,
      )
    })

    test("transforms block statement with resolve call", () => {
      assert(
        transform(
          `const p = new Promise((resolve) => { resolve(getData()); });`,
          "newly-available",
        ).modified,
      )
      assert.match(
        transform(
          `const p = new Promise((resolve) => { resolve(getData()); });`,
          "newly-available",
        ).code,
        /Promise\.try/,
      )
    })

    test("skip with arrow function expression body as function call", () => {
      assert(
        !transform(
          `const p = new Promise((resolve) => computeValue());`,
          "newly-available",
        ).modified,
        "do not transform because computeValue() is not calling resolve",
      )
      assert.match(
        transform(
          `const p = new Promise((resolve) => computeValue());`,
          "newly-available",
        ).code,
        /new Promise/,
      )
    })

    test("skip with arrow function returning a value directly", () => {
      assert(
        !transform(
          `const p = new Promise((resolve) => someFunction(arg1, arg2));`,
          "newly-available",
        ).modified,
        "do not transform function call that doesn't involve resolve",
      )
      assert.match(
        transform(
          `const p = new Promise((resolve) => someFunction(arg1, arg2));`,
          "newly-available",
        ).code,
        /new Promise/,
      )
    })

    test("skip with non-call expression body", () => {
      assert(
        !transform(`const p = new Promise((resolve) => someValue);`, "newly-available")
          .modified,
      )
      assert.match(
        transform(`const p = new Promise((resolve) => someValue);`, "newly-available")
          .code,
        /new Promise/,
      )
    })

    test("skip with wrong number of arguments to resolve", () => {
      assert(
        !transform(
          `const p = new Promise((resolve) => func(resolve, extra));`,
          "newly-available",
        ).modified,
      )
      assert.match(
        transform(
          `const p = new Promise((resolve) => func(resolve, extra));`,
          "newly-available",
        ).code,
        /new Promise/,
      )
    })

    test("skip with non-identifier resolve", () => {
      assert(
        !transform(`const p = new Promise((resolve) => func(123));`, "newly-available")
          .modified,
      )
      assert.match(
        transform(`const p = new Promise((resolve) => func(123));`, "newly-available")
          .code,
        /new Promise/,
      )
    })

    test("skip with resolve call with 0 arguments", () => {
      assert(
        !transform(`const p = new Promise((resolve) => resolve());`, "newly-available")
          .modified,
      )
      assert.match(
        transform(`const p = new Promise((resolve) => resolve());`, "newly-available")
          .code,
        /new Promise/,
      )
    })

    test("skip with block with multiple statements", () => {
      assert(
        !transform(
          `const p = new Promise((resolve) => {
        const data = getData();
        resolve(data);
      });`,
          "newly-available",
        ).modified,
      )
      assert.match(
        transform(
          `const p = new Promise((resolve) => {
        const data = getData();
        resolve(data);
      });`,
          "newly-available",
        ).code,
        /new Promise/,
      )
    })

    test("skip with block with non-expression statement", () => {
      assert(
        !transform(
          `const p = new Promise((resolve) => {
        if (true) resolve(1);
      });`,
          "newly-available",
        ).modified,
      )
      assert.match(
        transform(
          `const p = new Promise((resolve) => {
        if (true) resolve(1);
      });`,
          "newly-available",
        ).code,
        /new Promise/,
      )
    })

    test("transforms function expression", () => {
      assert(
        transform(
          `const p = new Promise(function(resolve) { resolve(getData()); });`,
          "newly-available",
        ).modified,
      )
      assert.match(
        transform(
          `const p = new Promise(function(resolve) { resolve(getData()); });`,
          "newly-available",
        ).code,
        /Promise\.try/,
      )
    })

    test("transforms with both resolve and reject params", () => {
      assert(
        transform(
          `const p = new Promise((resolve, reject) => resolve(getData()));`,
          "newly-available",
        ).modified,
      )
      assert.match(
        transform(
          `const p = new Promise((resolve, reject) => resolve(getData()));`,
          "newly-available",
        ).code,
        /Promise\.try/,
      )
    })

    test("tracks line numbers correctly", () => {
      assert(
        transform(
          `// Line 1
const p = new Promise((resolve) => resolve(getData()));`,
          "newly-available",
        ).modified,
      )
      assert.equal(
        transform(
          `// Line 1
const p = new Promise((resolve) => resolve(getData()));`,
          "newly-available",
        ).changes.length,
        1,
      )
      assert.equal(
        transform(
          `// Line 1
const p = new Promise((resolve) => resolve(getData()));`,
          "newly-available",
        ).changes[0].type,
        "promiseTry",
      )
      assert.equal(
        transform(
          `// Line 1
const p = new Promise((resolve) => resolve(getData()));`,
          "newly-available",
        ).changes[0].line,
        2,
      )
    })
  })
})
