import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("optionalChaining", () => {
    test("simple property access", () => {
      const result = transform(`const value = obj && obj.prop;`)

      assert(result.modified, "transform obj && obj.prop")
      assert.match(result.code, /const value = obj\?\.prop/)
      assert.doesNotMatch(result.code, /&&/)
    })

    test("nested property access", () => {
      const result = transform(`const value = obj && obj.prop && obj.prop.nested;`)

      assert(result.modified, "transform nested property access")
      assert.match(result.code, /const value = obj\?\.prop\?\.nested/)
      assert.doesNotMatch(result.code, /&&/)
    })

    test("array element access", () => {
      const result = transform(`const value = arr && arr[0];`)

      assert(result.modified, "transform arr && arr[0]")
      assert.match(result.code, /const value = arr\?\.\[0\]/)
      assert.doesNotMatch(result.code, /&&/)
    })

    test("function call", () => {
      const result = transform(`const value = fn && fn();`)

      assert(result.modified, "transform fn && fn()")
      assert.match(result.code, /const value = fn\?\.\(\)/)
      assert.doesNotMatch(result.code, /&&/)
    })

    test("function call with arguments", () => {
      const result = transform(`const result = callback && callback(arg1, arg2);`)

      assert(result.modified, "transform callback && callback(args)")
      assert.match(result.code, /const result = callback\?\.\(arg1, arg2\)/)
    })

    test("deeply nested property access", () => {
      const result = transform(`const value = obj && obj.a && obj.a.b && obj.a.b.c;`)

      assert(result.modified, "transform deeply nested property access")
      assert.match(result.code, /const value = obj\?\.a\?\.b\?\.c/)
      assert.doesNotMatch(result.code, /&&/)
    })

    test("method call with property access", () => {
      const result = transform(`const value = obj && obj.method && obj.method();`)

      assert(result.modified, "transform obj && obj.method && obj.method()")
      assert.match(result.code, /const value = obj\?\.method\?\.\(\)/)
    })

    test("array access with nested property", () => {
      const result = transform(`const value = arr && arr[0] && arr[0].prop;`)

      assert(result.modified, "transform arr && arr[0] && arr[0].prop")
      assert.match(result.code, /const value = arr\?\.\[0\]\?\.prop/)
    })

    test("skip unrelated && expressions", () => {
      const result = transform(`const value = a && b;`)

      assert(!result.modified, "skip unrelated && expressions")
    })

    test("skip mixed conditions", () => {
      const result = transform(`const value = obj && otherObj.prop;`)

      assert(!result.modified, "skip when right side doesn't access left side")
    })

    test("skip when accessing different object", () => {
      const result = transform(`const value = obj && obj.prop && other.nested;`)

      assert(!result.modified, "skip when chain breaks")
    })

    test("property access in expression", () => {
      const result = transform(`doSomething(obj && obj.prop);`)

      assert(result.modified, "transform property access in expression")
      assert.match(result.code, /doSomething\(obj\?\.prop\)/)
    })

    test("multiple transformations in same code", () => {
      const result = transform(`
      const a = obj && obj.prop;
      const b = arr && arr[0];
    `)

      assert(result.modified, "transform multiple occurrences")
      assert.match(result.code, /const a = obj\?\.prop/)
      assert.match(result.code, /const b = arr\?\.\[0\]/)
    })

    test("ternary with optional chaining pattern", () => {
      const result = transform(`const value = (obj && obj.prop) || defaultValue;`)

      assert(result.modified, "transform in ternary pattern")
      assert.match(result.code, /obj\?\.prop/)
    })

    test("skip boolean logic combinations", () => {
      const result = transform(`const value = (a && b) || (c && d);`)

      assert(!result.modified, "skip pure boolean logic")
    })

    test("computed property access", () => {
      const result = transform(`const value = obj && obj[key];`)

      assert(result.modified, "transform computed property access")
      assert.match(result.code, /const value = obj\?\.\[key\]/)
    })

    test("nested computed property access", () => {
      const result = transform(`const value = obj && obj[key] && obj[key].prop;`)

      assert(result.modified, "transform nested computed property access")
      assert.match(result.code, /const value = obj\?\.\[key\]\?\.prop/)
    })

    test("return statement with optional chaining pattern", () => {
      const result = transform(`
      function getValue(obj) {
        return obj && obj.value;
      }
    `)

      assert(result.modified, "transform in return statement")
      assert.match(result.code, /return obj\?\.value/)
    })

    test("skip complex expressions in chain", () => {
      const result = transform(`const value = obj && (obj.a || obj.b);`)

      assert(!result.modified, "skip when right side is not a simple access")
    })

    test("skip complex method chaining", () => {
      const result = transform(`const value = obj && obj.method && obj.method().prop;`)

      assert(!result.modified, "skip when accessing property on method result")
    })

    test("skip when base appears multiple times incorrectly", () => {
      const result = transform(`const value = obj && obj && obj.prop;`)

      assert(!result.modified, "skip duplicate base checks")
    })

    test("skip function calls with different arguments", () => {
      const result = transform(`const value = fn && fn(a) && fn(b);`)

      assert(!result.modified, "skip when function arguments differ")
    })

    test("transform function calls with same arguments", () => {
      const result = transform(`const value = fn && fn(a) && fn(a).prop;`)

      assert(result.modified, "transform when function arguments are same")
      assert.match(result.code, /const value = fn\?\.\(a\)\?\.prop/)
    })

    test("skip function calls with different argument counts", () => {
      const result = transform(`const value = fn && fn(a) && fn(a, b);`)

      assert(!result.modified, "skip when argument counts differ")
    })

    test("transform function calls with multiple same arguments", () => {
      const result = transform(`const value = fn && fn(x, y) && fn(x, y).result;`)

      assert(result.modified, "transform when multiple arguments are same")
      assert.match(result.code, /const value = fn\?\.\(x, y\)\?\.result/)
    })
  })
})
