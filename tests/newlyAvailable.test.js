import { describe, test } from "node:test"
import assert from "node:assert"
import { transform } from "../src/index.js"

describe("newly-available", () => {
  describe("Promise.try", () => {
    test("Promise.try transformation - newly-available", () => {
      const input = `const p = new Promise((resolve) => resolve(getData()));`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /Promise\.try/)
    })

    test("Promise.try not in widely-available", () => {
      const input = `const p = new Promise((resolve) => resolve(getData()));`

      const result = transform(input, "widely-available")

      // Should not transform Promise with widely-available baseline
      assert.doesNotMatch(result.code, /Promise\.try/)
    })

    test("Promise.try with function passed to resolve", () => {
      const input = `const p = new Promise((resolve) => setTimeout(resolve));`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, true)
      // Should transform to Promise.try(setTimeout) not Promise.try(() => setTimeout(resolve))
      assert.match(result.code, /Promise\.try\(setTimeout\)/)
      assert.doesNotMatch(result.code, /resolve/)
    })

    test("Promise.try should not transform when awaited", () => {
      const input = `async function foo() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}`

      const result = transform(input, "newly-available")

      // Should NOT transform awaited Promises
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /await new Promise/)
      assert.doesNotMatch(result.code, /Promise\.try/)
    })

    test("Promise.try should not transform non-Promise constructors", () => {
      const input = `const p = new MyPromise((resolve) => resolve(getData()));`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new MyPromise/)
    })

    test("Promise.try should not transform with 0 arguments", () => {
      const input = `const p = new Promise();`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise\(\)/)
    })

    test("Promise.try should not transform with multiple arguments", () => {
      const input = `const p = new Promise((resolve) => resolve(1), extraArg);`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise/)
    })

    test("Promise.try should not transform with non-function argument", () => {
      const input = `const p = new Promise(executor);`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise\(executor\)/)
    })

    test("Promise.try should not transform with 0 params", () => {
      const input = `const p = new Promise(() => console.log('test'));`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise/)
    })

    test("Promise.try should not transform with more than 2 params", () => {
      const input = `const p = new Promise((resolve, reject, extra) => resolve(1));`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise/)
    })

    test("Promise.try with block statement and resolve call", () => {
      const input = `const p = new Promise((resolve) => { resolve(getData()); });`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /Promise\.try/)
    })

    test("Promise.try with arrow function expression body as function call", () => {
      const input = `const p = new Promise((resolve) => computeValue());`

      const result = transform(input, "newly-available")

      // This should not transform because computeValue() is not calling resolve
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise/)
    })

    test("Promise.try with arrow function returning a value directly", () => {
      const input = `const p = new Promise((resolve) => someFunction(arg1, arg2));`

      const result = transform(input, "newly-available")

      // This should not transform - function call that doesn't involve resolve
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise/)
    })

    test("Promise.try should not transform non-call expression body", () => {
      const input = `const p = new Promise((resolve) => someValue);`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise/)
    })

    test("Promise.try should not transform call with wrong number of arguments to resolve", () => {
      const input = `const p = new Promise((resolve) => func(resolve, extra));`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise/)
    })

    test("Promise.try should not transform call with non-identifier resolve", () => {
      const input = `const p = new Promise((resolve) => func(123));`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise/)
    })

    test("Promise.try should not transform resolve call with 0 arguments", () => {
      const input = `const p = new Promise((resolve) => resolve());`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise/)
    })

    test("Promise.try should not transform block with multiple statements", () => {
      const input = `const p = new Promise((resolve) => {
        const data = getData();
        resolve(data);
      });`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise/)
    })

    test("Promise.try should not transform block with non-expression statement", () => {
      const input = `const p = new Promise((resolve) => {
        if (true) resolve(1);
      });`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /new Promise/)
    })

    test("Promise.try with function expression", () => {
      const input = `const p = new Promise(function(resolve) { resolve(getData()); });`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /Promise\.try/)
    })

    test("Promise.try with both resolve and reject params", () => {
      const input = `const p = new Promise((resolve, reject) => resolve(getData()));`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /Promise\.try/)
    })

    test("Promise.try tracks line numbers correctly", () => {
      const input = `// Line 1
const p = new Promise((resolve) => resolve(getData()));`

      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, true)
      assert.strictEqual(result.changes.length, 1)
      assert.strictEqual(result.changes[0].type, "promiseTry")
      assert.strictEqual(result.changes[0].line, 2)
    })
  })
})
