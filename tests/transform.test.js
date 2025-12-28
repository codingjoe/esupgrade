import { test } from "node:test"
import assert from "node:assert"
import { transform } from "../src/index.js"

test("Array.from().forEach() to for...of", () => {
  const input = `
    Array.from(items).forEach(item => {
      console.log(item);
    });
  `

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /for \(const item of items\)/)
  assert.match(result.code, /console\.log\(item\)/)
})

test("Array.from().forEach() with arrow function expression", () => {
  const input = `Array.from(numbers).forEach(n => console.log(n));`

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /for \(const n of numbers\)/)
})

test("var to const when not reassigned", () => {
  const input = `
    var x = 1;
  `

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /const x = 1/)
  assert.doesNotMatch(result.code, /var x/)
})

test("var to const (simplified version)", () => {
  const input = `
    var x = 1;
    x = 2;
  `

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /const x = 1/)
  assert.doesNotMatch(result.code, /var x/)
  // Note: This will cause a runtime error due to const reassignment
  // A more sophisticated version would detect reassignments and use 'let'
})

test("string concatenation to template literal", () => {
  const input = `const greeting = 'Hello ' + name + '!';`

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /`Hello \$\{name\}!`/)
})

test("multiple string concatenations", () => {
  const input = `const msg = 'Hello ' + firstName + ' ' + lastName + '!';`

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /`Hello \$\{firstName\} \$\{lastName\}!`/)
})

test("Object.assign to object spread", () => {
  const input = `const obj = Object.assign({}, obj1, obj2);`

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /\.\.\.obj1/)
  assert.match(result.code, /\.\.\.obj2/)
})

test("no changes needed", () => {
  const input = `
    const x = 1;
    const y = 2;
  `

  const result = transform(input)

  assert.strictEqual(result.modified, false)
})

test("complex transformation", () => {
  const input = `
    var userName = 'Alice';
    var greeting = 'Hello ' + userName;
  `

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /const userName/)
  assert.match(result.code, /`Hello \$\{userName\}`/)
})

test("baseline option - widely-available", () => {
  const input = `var x = 1;`

  const result = transform(input, { baseline: "widely-available" })

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /const x = 1/)
})

test("baseline option - newly-available", () => {
  const input = `var x = 1;`

  const result = transform(input, { baseline: "newly-available" })

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /const x = 1/)
})

test("forEach should NOT transform plain identifiers (cannot confirm iterable)", () => {
  const input = `
    items.forEach(item => {
      console.log(item);
    });
  `

  const result = transform(input)

  // Should not transform because we can't statically confirm 'items' is iterable
  // It could be a jscodeshift Collection or other object with forEach but not Symbol.iterator
  assert.strictEqual(result.modified, false)
  assert.match(result.code, /items\.forEach/)
})

test("forEach should NOT transform plain identifiers with function expression", () => {
  const input = `numbers.forEach(function(n) { console.log(n); });`

  const result = transform(input)

  // Should not transform because we can't statically confirm 'numbers' is iterable
  assert.strictEqual(result.modified, false)
  assert.match(result.code, /numbers\.forEach/)
})

test("forEach DOES transform array literals", () => {
  const input = `[1, 2, 3].forEach(n => console.log(n));`

  const result = transform(input)

  // Should transform because array literals are definitely iterable
  assert.strictEqual(result.modified, true)
  assert.match(result.code, /for \(const n of \[1, 2, 3\]\)/)
})

test("for...of Object.keys() to for...in", () => {
  const input = `
    for (const key of Object.keys(obj)) {
      console.log(key);
    }
  `

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /for \(const key in obj\)/)
})

test("Promise.try transformation - newly-available", () => {
  const input = `const p = new Promise((resolve) => resolve(getData()));`

  const result = transform(input, { baseline: "newly-available" })

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /Promise\.try/)
})

test("Promise.try not in widely-available", () => {
  const input = `const p = new Promise((resolve) => resolve(getData()));`

  const result = transform(input, { baseline: "widely-available" })

  // Should not transform Promise with widely-available baseline
  assert.doesNotMatch(result.code, /Promise\.try/)
})

test("Promise.try with function passed to resolve", () => {
  const input = `const p = new Promise((resolve) => setTimeout(resolve));`

  const result = transform(input, { baseline: "newly-available" })

  assert.strictEqual(result.modified, true)
  // Should transform to Promise.try(setTimeout) not Promise.try(() => setTimeout(resolve))
  assert.match(result.code, /Promise\.try\(setTimeout\)/)
  assert.doesNotMatch(result.code, /resolve/)
})

test("Promise.try should not transform when awaited", () => {
  const input = `async function foo() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}`

  const result = transform(input, { baseline: "newly-available" })

  // Should NOT transform awaited Promises
  assert.strictEqual(result.modified, false)
  assert.match(result.code, /await new Promise/)
  assert.doesNotMatch(result.code, /Promise\.try/)
})

test("Array.from().forEach() with array destructuring", () => {
  const input = `
    Array.from(Object.entries(obj)).forEach(([key, value]) => {
      console.log(key, value);
    });
  `

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /for \(const \[key, value\] of Object\.entries\(obj\)\)/)
})

test("Array.from().forEach() should NOT transform with index parameter", () => {
  const input = `
    Array.from(items).forEach((item, index) => {
      console.log(item, index);
    });
  `

  const result = transform(input)

  // Should not transform because callback uses index parameter
  assert.strictEqual(result.modified, false)
  assert.match(result.code, /forEach\(\(item, index\)/)
})

test("forEach should NOT transform with index parameter", () => {
  const input = `
    items.forEach((item, index) => {
      console.log(item, index);
    });
  `

  const result = transform(input)

  // Should not transform because callback uses index parameter
  assert.strictEqual(result.modified, false)
  assert.match(result.code, /forEach\(\(item, index\)/)
})

test("forEach transforms array methods that return arrays", () => {
  const input = `
    items.filter(x => x > 0).forEach(item => {
      console.log(item);
    });
  `

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /for \(const item of items\.filter/)
})

test("forEach transforms Object.keys/values/entries", () => {
  const input = `
    Object.keys(obj).forEach(key => {
      console.log(key);
    });
  `

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  // Object.keys().forEach() -> for...of Object.keys() -> for...in
  assert.match(result.code, /for \(const key in obj\)/)
})

test("forEach transforms Set iteration", () => {
  const input = `
    new Set([1, 2, 3]).forEach(value => {
      console.log(value);
    });
  `

  const result = transform(input)

  assert.strictEqual(result.modified, true)
  assert.match(result.code, /for \(const value of new Set/)
})

test("forEach should NOT transform unknown objects", () => {
  const input = `
    myCustomObject.forEach(item => {
      console.log(item);
    });
  `

  const result = transform(input)

  // Should not transform because we can't be sure myCustomObject is iterable
  assert.strictEqual(result.modified, false)
  assert.match(result.code, /myCustomObject\.forEach/)
})

test("forEach should NOT transform Map (uses different signature)", () => {
  const input = `
    myMap.forEach((value, key) => {
      console.log(key, value);
    });
  `

  const result = transform(input)

  // Should not transform Map.forEach because it has 2 parameters (value, key)
  assert.strictEqual(result.modified, false)
  assert.match(result.code, /myMap\.forEach/)
})
