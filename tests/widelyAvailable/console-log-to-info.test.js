import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("consoleLogToInfo", () => {
    test("simple console.log", () => {
      const result = transform(`console.log('hello');`)

      assert(result.modified, "transform console.log to console.info")
      assert.match(result.code, /console\.info\('hello'\)/)
      assert.doesNotMatch(result.code, /console\.log/)
    })

    test("console.log with multiple arguments", () => {
      const result = transform(`console.log('User:', user, 'ID:', id);`)

      assert(result.modified, "transform console.log with multiple arguments")
      assert.match(result.code, /console\.info\('User:', user, 'ID:', id\)/)
    })

    test("console.log in function body", () => {
      const result = transform(`
function debug(msg) {
console.log(msg);
}
    `)

      assert(result.modified, "transform console.log in function")
      assert.match(result.code, /console\.info\(msg\)/)
    })

    test("multiple console.log calls", () => {
      const result = transform(`
console.log('start');
doSomething();
console.log('end');
    `)

      assert(result.modified, "transform multiple console.log calls")
      assert.match(result.code, /console\.info\('start'\)/)
      assert.match(result.code, /console\.info\('end'\)/)
      assert.doesNotMatch(result.code, /console\.log/)
    })

    test("console.log with template literals", () => {
      const result = transform("console.log(`Value: ${value}`);")

      assert(result.modified, "transform console.log with template literals")
      assert.match(result.code, /console\.info\(`Value: \$\{value\}`\)/)
    })

    test("console.log with object", () => {
      const result = transform(`console.log({ key: 'value' });`)

      assert(result.modified, "transform console.log with object")
      assert.match(result.code, /console\.info\(\{ key: 'value' \}\)/)
    })

    test("do not transform console.error", () => {
      const result = transform(`console.error('error');`)

      assert(!result.modified, "skip console.error")
    })

    test("do not transform console.warn", () => {
      const result = transform(`console.warn('warning');`)

      assert(!result.modified, "skip console.warn")
    })

    test("do not transform console.info", () => {
      const result = transform(`console.info('info');`)

      assert(!result.modified, "skip console.info (already explicit)")
    })

    test("do not transform console.debug", () => {
      const result = transform(`console.debug('debug');`)

      assert(!result.modified, "skip console.debug")
    })

    test("do not transform other console methods", () => {
      const result = transform(`
console.table(data);
console.trace();
console.assert(condition, 'message');
    `)

      assert(!result.modified, "skip other console methods")
    })

    test("console.log in arrow function", () => {
      const result = transform(`const fn = () => console.log('test');`)

      assert(result.modified, "transform console.log in arrow function")
      assert.match(result.code, /console\.info\('test'\)/)
    })

    test("console.log in nested scope", () => {
      const result = transform(`
if (condition) {
console.log('true branch');
} else {
console.log('false branch');
}
    `)

      assert(result.modified, "transform console.log in nested scope")
      assert.match(result.code, /console\.info\('true branch'\)/)
      assert.match(result.code, /console\.info\('false branch'\)/)
    })

    test("console.log with spread operator", () => {
      const result = transform(`console.log(...args);`)

      assert(result.modified, "transform console.log with spread")
      assert.match(result.code, /console\.info\(\.\.\.args\)/)
    })

    test("console.log without arguments", () => {
      const result = transform(`console.log();`)

      assert(result.modified, "transform console.log without arguments")
      assert.match(result.code, /console\.info\(\)/)
    })

    test("do not transform non-console log methods", () => {
      const result = transform(`logger.log('message');`)

      assert(!result.modified, "skip non-console log methods")
    })

    test("do not transform when console is reassigned", () => {
      const result = transform(`
const myConsole = { log: () => {} };
myConsole.log('test');
    `)

      assert(!result.modified, "skip when object is not console")
    })
  })
})
