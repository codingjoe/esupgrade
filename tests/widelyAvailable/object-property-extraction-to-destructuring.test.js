import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("objectPropertyExtractionToDestructuring", () => {
    test("single property extraction in function declaration", () => {
      const result = transform(`
function fn(obj) {
  const x = obj.x;
  return x;
}
      `)

      assert(result.modified, "transform single property extraction")
      assert.match(result.code, /function fn\(\s*\{\s*x\s*\}/)
      assert.doesNotMatch(result.code, /const x = obj\.x/)
    })

    test("multiple property extractions", () => {
      const result = transform(`
function fn(obj) {
  const x = obj.x;
  const y = obj.y;
  return x + y;
}
      `)

      assert(result.modified, "transform multiple property extractions")
      assert.match(result.code, /function fn\(\s*\{\s*x,\s*y\s*\}/)
      assert.doesNotMatch(result.code, /const x = obj\.x/)
      assert.doesNotMatch(result.code, /const y = obj\.y/)
    })

    test("aliased extraction uses longhand destructuring", () => {
      const result = transform(`
function fn(obj) {
  const myX = obj.x;
  return myX;
}
      `)

      assert(result.modified, "transform aliased property extraction")
      assert.match(result.code, /function fn\(\s*\{\s*x:\s*myX\s*\}/)
      assert.doesNotMatch(result.code, /const myX = obj\.x/)
    })

    test("skip when parameter is used after extractions", () => {
      const result = transform(`
function fn(obj) {
  const x = obj.x;
  console.log(obj);
}
      `)

      assert.match(result.code, /const x = obj\.x/)
      assert.match(result.code, /function fn\(obj\)/)
    })

    test("skip when parameter property is accessed after extractions", () => {
      const result = transform(`
function fn(obj) {
  const x = obj.x;
  return x + obj.z;
}
      `)

      assert.match(result.code, /const x = obj\.x/)
      assert.match(result.code, /function fn\(obj\)/)
    })

    test("skip computed property access", () => {
      const result = transform(`
function fn(obj) {
  const x = obj[key];
  return x;
}
      `)

      assert(!result.modified, "skip computed property access")
    })

    test("skip already-destructured parameter", () => {
      const result = transform(`
function fn({x}) {
  return x;
}
      `)

      assert(!result.modified, "skip already-destructured parameter")
    })

    test("skip rest parameter", () => {
      const result = transform(`
function fn(...args) {
  return args;
}
      `)

      assert(!result.modified, "skip rest parameter")
    })

    test("skip non-leading extraction", () => {
      const result = transform(`
function fn(obj) {
  const z = 42;
  const x = obj.x;
  return x + z;
}
      `)

      assert.match(result.code, /const x = obj\.x/)
      assert.match(result.code, /function fn\(obj\)/)
    })

    test("stop at non-extraction in leading statements", () => {
      const result = transform(`
function fn(obj) {
  const x = obj.x;
  const z = 42;
  const y = obj.y;
  return x + y + z;
}
      `)

      assert.match(result.code, /const x = obj\.x/)
    })

    test("function expression", () => {
      const result = transform(`
const fn = function(obj) {
  const x = obj.x;
  return x;
};
      `)

      assert(result.modified, "transform function expression")
      assert.match(result.code, /\{\s*x\s*\}/)
      assert.doesNotMatch(result.code, /const x = obj\.x/)
    })

    test("arrow function", () => {
      const result = transform(`
const fn = (obj) => {
  const x = obj.x;
  return x;
};
      `)

      assert(result.modified, "transform arrow function")
      assert.match(result.code, /\{\s*x\s*\}/)
      assert.doesNotMatch(result.code, /const x = obj\.x/)
    })

    test("multiple parameters transformed independently", () => {
      const result = transform(`
function fn(a, b) {
  const x = a.x;
  const y = b.y;
  return x + y;
}
      `)

      assert(result.modified, "transform multiple parameters")
      assert.doesNotMatch(result.code, /const x = a\.x/)
      assert.doesNotMatch(result.code, /const y = b\.y/)
    })

    test("mixed declarator statement preserves non-extraction", () => {
      const result = transform(`
function fn(obj) {
  const x = obj.x, z = 42;
  return x + z;
}
      `)

      assert(result.modified, "transform mixed declarator")
      assert.match(result.code, /const z = 42/)
      assert.doesNotMatch(result.code, /obj/)
    })

    test("TypeScript type annotation is preserved", () => {
      const result = transform(`
function fn(obj: MyType) {
  const x = obj.x;
  return x;
}
      `)

      assert(result.modified, "transform TypeScript typed parameter")
      assert.match(result.code, /\{\s*x\s*\}:\s*MyType/)
      assert.doesNotMatch(result.code, /const x = obj\.x/)
    })

    test("TypeScript inline type annotation is preserved", () => {
      const result = transform(`
function fn(obj: { x: number }) {
  const x = obj.x;
  return x;
}
      `)

      assert(result.modified, "transform TypeScript inline typed parameter")
      assert.match(result.code, /x: number/)
      assert.doesNotMatch(result.code, /const x = obj\.x/)
    })

    test("skip mixed declarator where non-extraction uses the param", () => {
      const result = transform(`
function fn(obj) {
  const x = obj.x, ref = obj;
  return x;
}
      `)

      assert.match(result.code, /function fn\(obj\)/)
      assert.match(result.code, /const x = obj\.x/)
    })

    test("uninitialised variable declaration does not crash", () => {
      const result = transform(`
function fn(obj) {
  const x = obj.x;
  let y;
  return x;
}
      `)

      assert(result.modified, "transform with uninitialised variable in body")
      assert.match(result.code, /function fn\(\s*\{\s*x\s*\}/)
      assert.doesNotMatch(result.code, /const x = obj\.x/)
    })

    test("skip when nested function closes over the parameter", () => {
      const result = transform(`
function fn(obj) {
  const x = obj.x;
  return () => obj;
}
      `)

      assert(!result.modified, "should not transform when nested function closes over parameter")
      assert.match(result.code, /function fn\(obj\)/)
      assert.match(result.code, /const x = obj\.x/)
    })

    test("skip when extraction removal would promote use strict to a directive", () => {
      const result = transform(`
function fn(obj) {
  const x = obj.x;
  "use strict";
  return x;
}
      `)

      assert(!result.modified, "should not transform when removal would promote use strict directive")
      assert.match(result.code, /function fn\(obj\)/)
      assert.match(result.code, /const x = obj\.x/)
    })
  })
})
