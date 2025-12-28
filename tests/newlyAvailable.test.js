import { describe, test } from "node:test"
import assert from "node:assert"
import { transform } from "../src/index.js"

describe("newly-available transformations", () => {
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
})
