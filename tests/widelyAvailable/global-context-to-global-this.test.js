import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("globalContextToGlobalThis", () => {
    test("replace standalone window identifier", () => {
      const result = transform(`const global = window;`)

      assert(result.modified, "transform window to globalThis")
      assert.match(result.code, /const global = globalThis/)
      assert.doesNotMatch(result.code, /\bwindow\b/)
    })

    test("replace window property access", () => {
      const result = transform(`const loc = window.location.href;`)

      assert(result.modified, "transform window.location to globalThis.location")
      assert.match(result.code, /const loc = globalThis\.location\.href/)
    })

    test("replace standalone self identifier", () => {
      const result = transform(`const global = self;`)

      assert(result.modified, "transform self to globalThis")
      assert.match(result.code, /const global = globalThis/)
      assert.doesNotMatch(result.code, /\bself\b/)
    })

    test("replace self property access", () => {
      const result = transform(`const loc = self.location.href;`)

      assert(result.modified, "transform self.location to globalThis.location")
      assert.match(result.code, /const loc = globalThis\.location\.href/)
    })

    test("replace Function('return this')() pattern", () => {
      const result = transform(`const global = Function('return this')();`)

      assert(result.modified, "transform Function('return this')() to globalThis")
      assert.match(result.code, /const global = globalThis/)
      assert.doesNotMatch(result.code, /Function/)
    })

    test('replace Function("return this")() with double quotes', () => {
      const result = transform(`const global = Function("return this")();`)

      assert(result.modified, "transform Function with double quotes")
      assert.match(result.code, /const global = globalThis/)
    })

    test("do not transform window as object property", () => {
      const result = transform(`const w = obj.window;`)

      assert(!result.modified, "skip obj.window")
    })

    test("do not transform self as object property", () => {
      const result = transform(`const s = obj.self;`)

      assert(!result.modified, "skip obj.self")
    })

    test("do not transform shadowed window variable", () => {
      const result = transform(`
function test(window) {
return window;
}
    `)

      assert(!result.modified, "skip shadowed window parameter")
    })

    test("do not transform shadowed self variable", () => {
      const result = transform(`
function test(self) {
return self;
}
    `)

      assert(!result.modified, "skip shadowed self parameter")
    })

    test("do not transform window declared as local variable", () => {
      const result = transform(`
function test() {
var window = {};
return window;
}
    `)

      // var will be transformed to const, but window should NOT be transformed to globalThis
      assert(result.modified, "transform var to const")
      assert.match(result.code, /const window/)
      assert.match(result.code, /return window/)
      assert.doesNotMatch(result.code, /globalThis/)
    })

    test("do not transform self declared as local variable", () => {
      const result = transform(`
function test() {
let self = this;
return self;
}
    `)

      // No transformation should happen since `let` is already modern and self is shadowed
      assert(!result.modified, "skip locally declared self")
    })

    test("transform window in nested scope without shadowing", () => {
      const result = transform(`
function test() {
if (condition) {
  return window.location;
}
}
    `)

      assert(result.modified, "transform window in nested scope")
      assert.match(result.code, /return globalThis\.location/)
    })

    test("transform multiple window references", () => {
      const result = transform(`
const doc = window.document;
const nav = window.navigator;
    `)

      assert(result.modified, "transform multiple window references")
      assert.match(result.code, /const doc = globalThis\.document/)
      assert.match(result.code, /const nav = globalThis\.navigator/)
      assert.doesNotMatch(result.code, /\bwindow\b/)
    })

    test("transform window and self together", () => {
      const result = transform(`
const w = window;
const s = self;
    `)

      assert(result.modified, "transform both window and self")
      assert.match(result.code, /const w = globalThis/)
      assert.match(result.code, /const s = globalThis/)
    })

    test("transform window in arrow function", () => {
      const result = transform(`const getGlobal = () => window;`)

      assert(result.modified, "transform window in arrow function")
      // Arrow function gets transformed to function declaration AND window gets transformed to globalThis
      assert.match(result.code, /function getGlobal\(\)/)
      assert.match(result.code, /return globalThis/)
    })

    test("do not transform when window is destructured parameter", () => {
      const result = transform(`
function test({ window }) {
return window;
}
    `)

      assert(!result.modified, "skip destructured window parameter")
    })

    test("transform window.frames.forEach (existing functionality)", () => {
      const result = transform(`
window.frames.forEach(frame => {
process(frame);
});
    `)

      assert(result.modified, "transform window.frames and window to globalThis")
      assert.match(result.code, /for \(const frame of globalThis\.frames\)/)
    })

    test("do not transform Function with different argument", () => {
      const result = transform(`const fn = Function('x', 'return x * 2');`)

      assert(!result.modified, "skip Function with different arguments")
    })

    test("do not transform uncalled Function", () => {
      const result = transform(`const fn = Function('return this');`)

      assert(!result.modified, "skip uncalled Function constructor")
    })

    test("transform window in ternary expression", () => {
      const result = transform(
        `const global = typeof window !== 'undefined' ? window : {};`,
      )

      assert(result.modified, "transform window in ternary")
      assert.match(result.code, /typeof globalThis !== 'undefined' \? globalThis/)
    })

    test("transform self in typeof check", () => {
      const result = transform(`if (typeof self !== 'undefined') { use(self); }`)

      assert(result.modified, "transform self in typeof check")
      assert.match(result.code, /typeof globalThis !== 'undefined'/)
      assert.match(result.code, /use\(globalThis\)/)
    })

    test("do not transform window in string", () => {
      const result = transform(`const str = 'window';`)

      assert(!result.modified, "skip window in string literal")
    })

    test("do not transform window in comment", () => {
      const result = transform(`// check window\nconst x = 1;`)

      assert(!result.modified, "skip window in comment")
    })

    test("transform window in object method", () => {
      const result = transform(`
const obj = {
getGlobal() {
  return window;
}
};
    `)

      assert(result.modified, "transform window in object method")
      assert.match(result.code, /return globalThis/)
    })

    test("do not transform when window is a class property", () => {
      const result = transform(`
class MyClass {
window = null;

getWindow() {
  return this.window;
}
}
    `)

      assert(!result.modified, "skip this.window class property access")
    })

    test("transform window in class method without shadowing", () => {
      const result = transform(`
class MyClass {
getGlobal() {
  return window;
}
}
    `)

      assert(result.modified, "transform window in class method")
      assert.match(result.code, /return globalThis/)
    })

    test("do not transform window with block scope shadowing", () => {
      const result = transform(`
{
const window = {};
console.log(window);
}
    `)

      assert(result.modified, "transform console.log only")
      assert.match(result.code, /const window = {}/)
      assert.match(result.code, /console\.info\(window\)/)
      assert.doesNotMatch(result.code, /globalThis/)
    })

    test("transform window.location in chain", () => {
      const result = transform(`const path = window.location.pathname.split('/');`)

      assert(result.modified, "transform window.location chain")
      assert.match(result.code, /globalThis\.location\.pathname/)
    })

    test("do not transform ES6 shorthand property from global window", () => {
      const result = transform(`const obj = { window };`)

      assert(!result.modified, "skip shorthand property with global window")
    })

    test("do not transform ES6 shorthand property from local window", () => {
      const result = transform(`
const window = getWindow();
const obj = { window };
    `)

      // No transformation should happen - window is shadowed
      assert(!result.modified, "skip shorthand property with local window")
    })

    test("do not transform ES6 shorthand property with self", () => {
      const result = transform(`
const self = this;
const obj = { self };
    `)

      assert(!result.modified, "skip shorthand property with self")
    })

    test("do not transform window in shorthand method definition", () => {
      const result = transform(`
const obj = {
window() {
  return 'method';
}
};
    `)

      assert(!result.modified, "skip method name")
    })

    test("do not transform Function with non-string literal argument", () => {
      const result = transform(`const fn = Function(123)();`)

      assert(!result.modified, "skip Function with numeric literal argument")
    })

    test("do not transform Function with identifier argument", () => {
      const result = transform(`const fn = Function(getSomeString)();`)

      assert(!result.modified, "skip Function with identifier argument")
    })

    test("do not transform Function with non-return-this string", () => {
      const result = transform(`const fn = Function('return globalThis')();`)

      assert(!result.modified, "skip Function with different string argument")
    })

    test("do not transform window as method definition key", () => {
      const result = transform(`
const obj = {
window() {
  return this.value;
},
getValue() {
  return window;
}
};
    `)

      assert(result.modified, "transform window in method body but not in method name")
      assert.match(result.code, /window\(\)/)
      assert.match(result.code, /return globalThis/)
    })
  })
})
