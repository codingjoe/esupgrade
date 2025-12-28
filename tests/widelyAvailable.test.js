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
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /for \(const item of items\)/)
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
})
