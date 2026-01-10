import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("functionToArrow", () => {
    test("simple anonymous function", () => {
      const result = transform(`
  const greet = function(name) {
    return "Hello " + name;
  };
`)

      assert(result.modified, "transform simple anonymous function")
      assert.match(result.code, /function greet\(name\)/)
      assert.match(result.code, /return/)
      assert.doesNotMatch(result.code, /const greet = function/)
    })

    test("multiple parameters", () => {
      const result = transform(`
  const add = function(a, b) {
    return a + b;
  };
`)

      assert(result.modified, "transform anonymous function with multiple parameters")
      assert.match(result.code, /function add\(a, b\)/)
      assert.doesNotMatch(result.code, /const add = function/)
    })

    test("no parameters", () => {
      const result = transform(`
  const getValue = function() {
    return 42;
  };
`)

      assert(result.modified, "transform anonymous function with no parameters")
      assert.match(result.code, /function getValue\(\)/)
      assert.doesNotMatch(result.code, /const getValue = function/)
    })

    test("callback function", () => {
      const result = transform(`[1, 2, 3].map(function(x) { return x * 2; });`)

      assert(result.modified, "transform callback function")
      assert.match(result.code, /\[1, 2, 3\]\.map\(x =>/)
    })

    test("using 'this'", () => {
      const result = transform(`
  const obj = {
    method: function() {
      return this.value;
    }
  };
`)

      assert(!result.modified, "skip function using 'this'")
    })

    test("using 'this' in nested code", () => {
      const result = transform(`
  const handler = function() {
    if (true) {
      process(this.name);
    }
  };
`)

      assert(!result.modified, "skip function using 'this' in nested code")
    })

    test("using 'arguments'", () => {
      const result = transform(`
  const sum = function() {
    return [...arguments].reduce((a, b) => a + b, 0);
  };
`)

      assert(!result.modified, "skip function using 'arguments'")
    })

    test("generator function", () => {
      const result = transform(`
  const gen = function*() {
    yield 1;
    yield 2;
  };
`)

      assert(!result.modified, "skip generator function")
    })

    test("nested function without 'this'", () => {
      const result = transform(`
  const outer = function(x) {
    return function(y) {
      return x + y;
    };
  };
`)

      assert(result.modified, "transform nested function that doesn't use 'this'")
      assert.match(result.code, /function outer\(x\)/)
      assert.match(result.code, /return y =>/)
    })

    test("outer uses 'this', inner does not", () => {
      const result = transform(`
  const outer = function() {
    this.value = 10;
    return function(x) {
      return x * 2;
    };
  };
`)

      assert(result.modified, "transform inner function when outer uses 'this'")
      assert.match(result.code, /const outer = function\(\)/)
      assert.match(result.code, /return x =>/)
    })

    test("async function", () => {
      const result = transform(`
  const fetchData = async function(url) {
    const response = await fetch(url);
    return response.json();
  };
`)

      assert(result.modified, "transform async function")
      assert.match(result.code, /async function fetchData\(url\)/)
    })

    test("complex body", () => {
      const result = transform(`
  const process = function(data) {
    const result = [];
    for (const item of data) {
      result.push(item * 2);
    }
    return result;
  };
`)

      assert(result.modified, "transform function with complex body")
      assert.match(result.code, /function process\(data\)/)
    })

    test("multiple transformations", () => {
      const result = transform(`
  const fn1 = function(x) { return x + 1; };
  const fn2 = function(y) { return y * 2; };
`)

      assert(result.modified, "transform multiple functions")
      assert.match(result.code, /function fn1\(x\)/)
      assert.match(result.code, /function fn2\(y\)/)
    })

    test("'this' in nested function scope", () => {
      const result = transform(`
  const outer = function(x) {
    return function() {
      return this.value + x;
    };
  };
`)

      assert(
        result.modified,
        "transform outer function, not inner when 'this' is in nested scope",
      )
      assert.match(result.code, /function outer\(x\)/)
      assert.match(result.code, /return function\(\)/)
    })

    test("event handlers without 'this'", () => {
      const result = transform(`
  button.addEventListener('click', function(event) {
    process('Clicked', event.target);
  });
`)

      assert(result.modified, "transform event handlers without 'this'")
      assert.match(result.code, /button\.addEventListener\('click', event =>/)
    })

    test("IIFE without 'this'", () => {
      const result = transform(`
  (function() {
    process('IIFE executed');
  })();
`)

      assert(result.modified, "transform IIFE without 'this'")
      assert.match(result.code, /\(\(\) =>/)
    })

    test("async function expression as callback", () => {
      const result = transform(`
  promises.then(async function(value) {
    await process(value);
    return result;
  });
`)

      assert(result.modified, "transform async function expression")
      assert.match(result.code, /promises\.then\(async value =>/)
    })

    test("named function expression", () => {
      const result = transform(`
  const factorial = function fact(n) {
    return n <= 1 ? 1 : n * fact(n - 1);
  };
`)

      assert(!result.modified, "skip named function expression")
    })
  })
})
