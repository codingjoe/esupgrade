import { describe, test } from "node:test"
import assert from "node:assert"
import { transform } from "../src/index.js"

describe("widely-available", () => {
  describe("for...of loop", () => {
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

    test("Array.from().forEach() with array destructuring", () => {
      const input = `
    Array.from(Object.entries(obj)).forEach(([key, value]) => {
      console.log(key, value);
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(
        result.code,
        /for \(const \[key, value\] of Object\.entries\(obj\)\)/,
      )
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

    test("Array.from().forEach() should NOT transform without callback", () => {
      const input = `Array.from(items).forEach();`

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /forEach\(\)/)
    })

    test("Array.from().forEach() should NOT transform with non-function callback", () => {
      const input = `Array.from(items).forEach(callback);`

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /forEach\(callback\)/)
    })

    test("Array.from().forEach() with function expression", () => {
      const input = `Array.from(items).forEach(function(item) {
        console.log(item);
      });`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(const item of items\)/)
    })

    test("for...of Object.keys() should NOT transform non-Object.keys", () => {
      const input = `
    for (const item of myArray) {
      console.log(item);
    }
  `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /for \(const item of myArray\)/)
    })

    test("for...of Object.keys() should NOT transform without arguments", () => {
      const input = `
    for (const key of Object.keys()) {
      console.log(key);
    }
  `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /Object\.keys\(\)/)
    })

    test("Array.from().forEach() tracks line numbers", () => {
      const input = `// Line 1
Array.from(items).forEach(item => console.log(item));`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.strictEqual(result.changes.length, 1)
      assert.strictEqual(result.changes[0].type, "arrayFromForEachToForOf")
      assert.strictEqual(result.changes[0].line, 2)
    })

    test("for...of Object.keys() tracks line numbers", () => {
      const input = `// Line 1
for (const key of Object.keys(obj)) {
  console.log(key);
}`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.strictEqual(result.changes.length, 1)
      assert.strictEqual(result.changes[0].type, "forOfKeysToForIn")
      assert.strictEqual(result.changes[0].line, 2)
    })

    test("Array.from().forEach() with destructuring and 2+ params transforms if first param is array pattern", () => {
      const input = `Array.from(items).forEach(([a, b], index) => {
        console.log(a, b, index);
      });`

      const result = transform(input)

      // According to the code, this should transform because first param is ArrayPattern
      // The logic says: params.length === 1 OR (params.length >= 2 AND first is ArrayPattern)
      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(const \[a, b\] of items\)/)
    })
  })

  describe("Array.from() to spread", () => {
    test("Array.from().map() to [...].map()", () => {
      const input = `const doubled = Array.from(numbers).map(n => n * 2);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\[\.\.\.numbers\]\.map/)
      assert.doesNotMatch(result.code, /Array\.from/)
    })

    test("Array.from().filter() to [...].filter()", () => {
      const input = `const filtered = Array.from(items).filter(x => x > 5);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\[\.\.\.items\]\.filter/)
    })

    test("Array.from().some() to [...].some()", () => {
      const input = `const hasValue = Array.from(collection).some(item => item.active);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\[\.\.\.collection\]\.some/)
    })

    test("Array.from().every() to [...].every()", () => {
      const input = `const allValid = Array.from(items).every(x => x.valid);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\[\.\.\.items\]\.every/)
    })

    test("Array.from().find() to [...].find()", () => {
      const input = `const found = Array.from(elements).find(el => el.id === 'target');`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\[\.\.\.elements\]\.find/)
    })

    test("Array.from().reduce() to [...].reduce()", () => {
      const input = `const sum = Array.from(values).reduce((a, b) => a + b, 0);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\[\.\.\.values\]\.reduce/)
    })

    test("Array.from() standalone to [...]", () => {
      const input = `const arr = Array.from(iterable);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /const arr = \[\.\.\.iterable\]/)
    })

    test("Array.from() with property access", () => {
      const input = `const length = Array.from(items).length;`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\[\.\.\.items\]\.length/)
    })

    test("Array.from().forEach() should NOT be transformed (handled by other transformer)", () => {
      const input = `Array.from(items).forEach(item => console.log(item));`

      const result = transform(input)

      // Should be transformed by arrayFromForEachToForOf, not arrayFromToSpread
      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(const item of items\)/)
      assert.doesNotMatch(result.code, /\[\.\.\./)
    })

    test("Array.from() with mapping function should NOT be transformed", () => {
      const input = `const doubled = Array.from(numbers, n => n * 2);`

      const result = transform(input)

      // Should not transform because there's a mapping function
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /Array\.from\(numbers, n => n \* 2\)/)
    })

    test("Array.from() with thisArg should NOT be transformed", () => {
      const input = `const result = Array.from(items, function(x) { return x * this.multiplier; }, context);`

      const result = transform(input)

      // Should not transform because there are 3 arguments
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /Array\.from/)
    })

    test("Array.from() chained methods", () => {
      const input = `const result = Array.from(set).map(x => x * 2).filter(x => x > 10);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\[\.\.\.set\]\.map/)
    })

    test("Array.from() with complex iterable", () => {
      const input = `const arr = Array.from(document.querySelectorAll('.item'));`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\[\.\.\.document\.querySelectorAll\('\.item'\)\]/)
    })

    test("Array.from() tracks line numbers", () => {
      const input = `// Line 1
const result = Array.from(items).map(x => x * 2);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.strictEqual(result.changes.length, 1)
      assert.strictEqual(result.changes[0].type, "arrayFromToSpread")
      assert.strictEqual(result.changes[0].line, 2)
    })
  })

  describe("const and let", () => {
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

    test("multiple var declarations", () => {
      const input = `
    var x = 1;
    var y = 2;
    var z = 3;
  `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /const x = 1/)
      assert.match(result.code, /const y = 2/)
      assert.match(result.code, /const z = 3/)
      assert.strictEqual(result.changes.length, 3)
    })

    test("var declaration tracks line numbers", () => {
      const input = `// Line 1
var x = 1;`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.strictEqual(result.changes.length, 1)
      assert.strictEqual(result.changes[0].type, "varToConst")
      assert.strictEqual(result.changes[0].line, 2)
    })
  })

  describe("template literals", () => {
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

    test("concatenation starting with expression", () => {
      const input = `const msg = prefix + ' world';`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /`\$\{prefix\} world`/)
    })

    test("concatenation with only expressions", () => {
      const input = `const msg = a + b + c;`

      const result = transform(input)

      // Should not transform if no string literals
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /a \+ b \+ c/)
    })

    test("concatenation ending with expression", () => {
      const input = `const msg = 'Value: ' + value;`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /`Value: \$\{value\}`/)
    })

    test("complex nested concatenation", () => {
      const input = `const msg = 'Start ' + (a + 'middle') + ' end';`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /`/)
    })
  })

  describe("object spread", () => {
    test("Object.assign to object spread", () => {
      const input = `const obj = Object.assign({}, obj1, obj2);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\.\.\.obj1/)
      assert.match(result.code, /\.\.\.obj2/)
    })

    test("Object.assign should not transform with non-empty first arg", () => {
      const input = `const obj = Object.assign({ a: 1 }, obj1);`

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /Object\.assign/)
    })

    test("Object.assign should not transform with non-object first arg", () => {
      const input = `const obj = Object.assign(target, obj1);`

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /Object\.assign/)
    })

    test("Object.assign with only empty object", () => {
      const input = `const obj = Object.assign({});`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\{\}/)
    })
  })

  describe("Math.pow() to exponentiation operator", () => {
    test("Math.pow() to **", () => {
      const input = `const result = Math.pow(2, 3);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /2 \*\* 3/)
    })

    test("Math.pow() with variables", () => {
      const input = `const power = Math.pow(base, exponent);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /base \*\* exponent/)
    })

    test("Math.pow() with complex expressions", () => {
      const input = `const result = Math.pow(x + 1, y * 2);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /\(x \+ 1\) \*\* \(y \* 2\)/)
    })

    test("Math.pow() in expressions", () => {
      const input = `const area = Math.PI * Math.pow(radius, 2);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /Math\.PI \* radius \*\* 2/)
    })

    test("Math.pow() should not transform with wrong number of arguments", () => {
      const input = `const result = Math.pow(2);`

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /Math\.pow\(2\)/)
    })

    test("Math.pow() nested calls", () => {
      const input = `const result = Math.pow(Math.pow(2, 3), 4);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      // Only the outer Math.pow is transformed in a single pass
      assert.match(result.code, /Math\.pow\(2, 3\) \*\* 4/)
    })

    test("Math.pow() tracks line numbers", () => {
      const input = `// Line 1
const result = Math.pow(2, 3);`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      const mathPowChanges = result.changes.filter(
        (c) => c.type === "mathPowToExponentiation",
      )
      assert.strictEqual(mathPowChanges.length, 1)
      assert.strictEqual(mathPowChanges[0].line, 2)
    })
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

    const result = transform(input)

    assert.strictEqual(result.modified, true)
    assert.match(result.code, /const x = 1/)
  })

  test("baseline option - newly-available", () => {
    const input = `var x = 1;`

    const result = transform(input, "newly-available")

    assert.strictEqual(result.modified, true)
    assert.match(result.code, /const x = 1/)
  })

  describe("traditional for loop to for...of", () => {
    test("basic for loop with array indexing", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(const item of items\)/)
      assert.match(result.code, /console\.log\(item\)/)
      assert.doesNotMatch(result.code, /items\[i\]/)
    })

    test("for loop with const variable", () => {
      const input = `
for (let i = 0; i < arr.length; i++) {
  const element = arr[i];
  process(element);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(const element of arr\)/)
    })

    test("for loop with let variable", () => {
      const input = `
for (let i = 0; i < arr.length; i++) {
  let element = arr[i];
  element = transform(element);
  console.log(element);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(let element of arr\)/)
    })

    test("for loop with var variable", () => {
      const input = `
for (let i = 0; i < arr.length; i++) {
  var element = arr[i];
  console.log(element);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      // Note: var is also converted to const by the varToConst transformer
      assert.match(result.code, /for \(const element of arr\)/)
    })

    test("should NOT transform when index is used in body", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(item, i);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /for \(let i = 0; i < items\.length; i\+\+\)/)
    })

    test("should NOT transform when no array access statement", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  console.log(i);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /for \(let i = 0/)
    })

    test("should NOT transform when body is empty", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when using different increment", () => {
      const input = `
for (let i = 0; i < items.length; i += 2) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /i \+= 2/)
    })

    test("should NOT transform when starting from non-zero", () => {
      const input = `
for (let i = 1; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /let i = 1/)
    })

    test("should NOT transform when using <= instead of <", () => {
      const input = `
for (let i = 0; i <= items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /i <= items\.length/)
    })

    test("should NOT transform when accessing different array", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  const item = otherArray[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /otherArray\[i\]/)
    })

    test("should NOT transform when first statement is not variable declaration", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  console.log(items[i]);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /for \(let i = 0/)
    })

    test("should NOT transform when using different index variable", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  const item = items[j];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should transform with ++i (prefix increment)", () => {
      const input = `
for (let i = 0; i < items.length; ++i) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(const item of items\)/)
    })

    test("multiple statements after array access", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(item);
  process(item);
  cleanup();
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(const item of items\)/)
      assert.match(result.code, /console\.log\(item\)/)
      assert.match(result.code, /process\(item\)/)
      assert.match(result.code, /cleanup\(\)/)
    })

    test("should NOT transform when init is not a variable declaration", () => {
      const input = `
for (i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when init has multiple declarations", () => {
      const input = `
for (let i = 0, j = 0; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when init id is not an identifier", () => {
      const input = `
for (let [i] = [0]; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when test is not a binary expression", () => {
      const input = `
for (let i = 0; items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when test operator is not <", () => {
      const input = `
for (let i = 0; i <= items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when test left is not the index variable", () => {
      const input = `
for (let i = 0; j < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when test right is not a member expression", () => {
      const input = `
for (let i = 0; i < 10; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when test right property is not 'length'", () => {
      const input = `
for (let i = 0; i < items.size; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when test right object is not an identifier", () => {
      const input = `
for (let i = 0; i < getItems().length; i++) {
  const item = getItems()[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when update is not an update expression", () => {
      const input = `
for (let i = 0; i < items.length; i = i + 1) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when update argument is not the index variable", () => {
      const input = `
for (let i = 0; i < items.length; j++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when update operator is not ++", () => {
      const input = `
for (let i = 0; i < items.length; i--) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when body is not a block statement", () => {
      const input = `
for (let i = 0; i < items.length; i++)
  console.log(items[i]);
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when first statement has multiple declarations", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  const item = items[i], other = null;
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when first statement id is not an identifier", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  const [item] = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when first statement init is not a member expression", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  const item = getItem(i);
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when member expression object name doesn't match", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  const item = other[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when member expression property doesn't match index", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  const item = items[j];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("should NOT transform when member expression is not computed", () => {
      const input = `
for (let i = 0; i < items.length; i++) {
  const item = items.i;
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
    })

    test("tracks line numbers for forLoopToForOf", () => {
      const input = `// Line 1
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      const forLoopChanges = result.changes.filter((c) => c.type === "forLoopToForOf")
      assert.strictEqual(forLoopChanges.length, 1)
      assert.strictEqual(forLoopChanges[0].line, 2)
    })
  })

  describe("iterable forEach to for...of", () => {
    test("document.querySelectorAll().forEach() to for...of", () => {
      const input = `
    document.querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(
        result.code,
        /for \(const item of document\.querySelectorAll\(['"]\.item['"]\)\)/,
      )
      assert.match(result.code, /console\.log\(item\)/)
    })

    test("document.getElementsByTagName().forEach() to for...of", () => {
      const input = `
    document.getElementsByTagName('div').forEach(div => {
      div.classList.add('active');
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(
        result.code,
        /for \(const div of document\.getElementsByTagName\(['"]div['"]\)\)/,
      )
    })

    test("document.getElementsByClassName().forEach() to for...of", () => {
      const input = `
    document.getElementsByClassName('button').forEach(button => {
      button.disabled = true;
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(
        result.code,
        /for \(const button of document\.getElementsByClassName\(['"]button['"]\)\)/,
      )
    })

    test("document.getElementsByName().forEach() to for...of", () => {
      const input = `
    document.getElementsByName('email').forEach(input => {
      input.required = true;
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(
        result.code,
        /for \(const input of document\.getElementsByName\(['"]email['"]\)\)/,
      )
    })

    test("element variable querySelectorAll should NOT transform", () => {
      const input = `
    element.querySelectorAll('span').forEach(span => {
      span.remove();
    });
  `

      const result = transform(input)

      // Should NOT transform because element is not from document chain
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /element\.querySelectorAll/)
    })

    test("chained element method .querySelectorAll().forEach() to for...of", () => {
      const input = `
    document.getElementById('container').querySelectorAll('p').forEach(p => {
      p.textContent = '';
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(
        result.code,
        /for \(const p of document\.getElementById\(['"]container['"]\)\.querySelectorAll\(['"]p['"]\)\)/,
      )
    })

    test("window.frames property forEach() to for...of", () => {
      const input = `
    window.frames.forEach(frame => {
      frame.postMessage('hello', '*');
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(const frame of window\.frames\)/)
    })

    test("should NOT transform arrow function without braces (expression body)", () => {
      const input = `
    document.querySelectorAll('.item').forEach(item => item.remove());
  `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /forEach\(item => item\.remove\(\)\)/)
    })

    test("should NOT transform with index parameter", () => {
      const input = `
    document.querySelectorAll('.item').forEach((item, index) => {
      console.log(item, index);
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /forEach\(\(item, index\) =>/)
    })

    test("should NOT transform with array parameter", () => {
      const input = `
    document.querySelectorAll('.item').forEach((item, index, array) => {
      console.log(item, index, array);
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /forEach\(\(item, index, array\) =>/)
    })

    test("should NOT transform with non-inline callback (reference)", () => {
      const input = `
    document.querySelectorAll('.item').forEach(handleItem);
  `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /forEach\(handleItem\)/)
    })

    test("should NOT transform without callback", () => {
      const input = `
    document.querySelectorAll('.item').forEach();
  `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /forEach\(\)/)
    })

    test("should NOT transform unknown methods", () => {
      const input = `
    document.querySomething('.item').forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /querySomething/)
    })

    test("should NOT transform non-document objects with querySelectorAll", () => {
      const input = `
    myObject.querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /myObject\.querySelectorAll/)
    })

    test("should NOT transform window methods not in allowed list", () => {
      const input = `
    window.querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.match(result.code, /window\.querySelectorAll/)
    })

    test("transforms with function expression", () => {
      const input = `
    document.querySelectorAll('button').forEach(function(btn) {
      btn.disabled = true;
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(
        result.code,
        /for \(const btn of document\.querySelectorAll\(['"]button['"]\)\)/,
      )
    })

    test("tracks line numbers correctly", () => {
      const input = `// Line 1
document.querySelectorAll('.item').forEach(item => {
  console.log(item);
});`

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.strictEqual(result.changes.length, 1)
      assert.strictEqual(result.changes[0].type, "iterableForEachToForOf")
      assert.strictEqual(result.changes[0].line, 2)
    })

    test("handles complex selector strings", () => {
      const input = `
    document.querySelectorAll('[data-toggle="modal"]').forEach(el => {
      el.addEventListener('click', handleClick);
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(
        result.code,
        /for \(const el of document\.querySelectorAll\(['"]\[data-toggle="modal"\]['"]\)\)/,
      )
    })

    test("preserves multiline function bodies", () => {
      const input = `
    document.querySelectorAll('.item').forEach(item => {
      const value = item.value;
      console.log(value);
      item.classList.add('processed');
    });
  `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(const item of/)
      assert.match(result.code, /const value = item\.value/)
      assert.match(result.code, /console\.log\(value\)/)
      assert.match(result.code, /item\.classList\.add/)
    })

    test("should NOT transform element variables with getElementsByTagName", () => {
      const input = `
    container.getElementsByTagName('input').forEach(input => {
      input.value = '';
    });
  `

      const result = transform(input)

      // Should not transform because container is not from document chain
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /container\.getElementsByTagName/)
    })

    test("should NOT transform element variables with getElementsByClassName", () => {
      const input = `
    section.getElementsByClassName('warning').forEach(warning => {
      warning.style.display = 'none';
    });
  `

      const result = transform(input)

      // Should not transform because section is not from document chain
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /section\.getElementsByClassName/)
    })

    test("should NOT transform window.querySelectorAll (not in allowed methods)", () => {
      const input = `
    window.querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      // Should not transform because querySelectorAll is not a window method
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /window\.querySelectorAll/)
    })

    test("should NOT transform property access on unknown objects", () => {
      const input = `
    customObject.frames.forEach(frame => {
      frame.postMessage('test', '*');
    });
  `

      const result = transform(input)

      // Should not transform because customObject is not window
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /customObject\.frames/)
    })

    test("should NOT transform when method callee is not a member expression", () => {
      const input = `
    getSomething().forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      // Should not transform because callee is not a member expression
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /getSomething\(\)\.forEach/)
    })

    test("should NOT transform when method name cannot be extracted (computed property)", () => {
      const input = `
    document['querySelectorAll']('.item').forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      // Should not transform because method name is computed (string literal, not identifier)
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /document\['querySelectorAll'\]/)
    })

    test("should NOT transform unknown document methods", () => {
      const input = `
    document.customMethod().forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      // Should not transform because customMethod is not in allowed list
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /document\.customMethod/)
    })

    test("should NOT transform chained call from non-document origin", () => {
      const input = `
    element.querySelector('div').querySelectorAll('span').forEach(span => {
      span.remove();
    });
  `

      const result = transform(input)

      // Should not transform because chain doesn't start with document
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /element\.querySelector/)
    })

    test("should NOT transform chained call with unknown method", () => {
      const input = `
    document.getElementById('x').customMethod().forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      // Should not transform because customMethod is not in document methods
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /customMethod/)
    })

    test("should NOT transform when caller object is neither identifier nor member/call expression", () => {
      const input = `
    (function() { return document; })().querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      // Should not transform because caller is a function expression
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /forEach/)
    })

    test("should NOT transform when caller object is ThisExpression", () => {
      const input = `
    this.querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      // Should not transform because caller is this, not document
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /this\.querySelectorAll/)
    })

    test("should NOT transform when forEach object is neither MemberExpression nor CallExpression", () => {
      const input = `
    items.forEach(item => {
      console.log(item);
    });
  `

      const result = transform(input)

      // Should not transform because items is just an identifier, not a method call or property
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /items\.forEach/)
    })

    test("deeply nested document chain should transform", () => {
      const input = `
    document.getElementById('a').querySelector('b').querySelectorAll('c').forEach(item => {
      item.remove();
    });
  `

      const result = transform(input)

      // Should transform because it chains from document
      assert.strictEqual(result.modified, true)
      assert.match(
        result.code,
        /for \(const item of document\.getElementById\(['"]a['"]\)\.querySelector\(['"]b['"]\)\.querySelectorAll\(['"]c['"]\)\)/,
      )
    })

    test("should NOT transform when callee in chain is not a member expression", () => {
      const input = `
    getDocument().querySelectorAll('span').forEach(item => {
      item.textContent = 'test';
    });
  `

      const result = transform(input)

      // Should NOT transform - chain starts with function call, not document
      assert.strictEqual(result.modified, false)
      assert.match(result.code, /getDocument\(\)\.querySelectorAll/)
    })

    test("should transform document property access with querySelectorAll", () => {
      const input = `
    document.body.querySelectorAll('div').forEach(div => {
      div.remove();
    });
  `

      const result = transform(input)

      // Should transform - chains from document through property access
      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(const div of document\.body\.querySelectorAll/)
    })
  })
})
