import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("objectKeysForEachToEntries", () => {
    test("basic Object.keys().forEach() with value access", () => {
      const result = transform(`
Object.keys(obj).forEach(key => {
const value = obj[key];
console.log(key, value);
});
    `)

      assert(result.modified, "transform Object.keys().forEach()")
      assert.match(result.code, /Object\.entries\(obj\)\.forEach\(\(\[key, value\]\)/)
      assert.match(result.code, /console\.info\(key, value\)/)
      assert.doesNotMatch(result.code, /const value = obj\[key\]/)
    })

    test("Object.keys().forEach() with let variable", () => {
      const result = transform(`
Object.keys(data).forEach(k => {
let v = data[k];
process(k, v);
});
    `)

      assert(result.modified, "transform with let variable")
      assert.match(result.code, /Object\.entries\(data\)\.forEach\(\(\[k, v\]\)/)
      assert.match(result.code, /process\(k, v\)/)
    })

    test("Object.keys().forEach() with var variable", () => {
      const result = transform(`
Object.keys(items).forEach(key => {
var value = items[key];
use(value);
});
    `)

      assert(result.modified, "transform with var variable")
      assert.match(result.code, /Object\.entries\(items\)\.forEach\(\(\[key, value\]\)/)
    })

    test("Object.keys().forEach() with function expression", () => {
      const result = transform(`
Object.keys(obj).forEach(function(key) {
const value = obj[key];
console.log(key, value);
});
    `)

      assert(result.modified, "transform with function expression")
      // Note: function expression is converted to arrow by anonymousFunctionToArrow transformer first
      assert.match(result.code, /Object\.entries\(obj\)\.forEach\(\(\[key, value\]\)/)
    })

    test("Object.keys().forEach() with async arrow function", () => {
      const result = transform(`
Object.keys(obj).forEach(async key => {
const value = obj[key];
await process(value);
});
    `)

      assert(result.modified, "transform async arrow function")
      assert.match(
        result.code,
        /Object\.entries\(obj\)\.forEach\(async \(\[key, value\]\)/,
      )
    })

    test("skip Object.keys().forEach() without value access", () => {
      const result = transform(`
Object.keys(obj).forEach(key => {
use(key);
});
    `)

      assert(!result.modified, "skip when no value variable")
    })

    test("skip Object.keys().forEach() with index parameter", () => {
      const result = transform(`
Object.keys(obj).forEach((key, index) => {
const value = obj[key];
use(index, key, value);
});
    `)

      assert(!result.modified, "skip when callback has index parameter")
    })

    test("skip Object.keys().forEach() with expression body", () => {
      const result = transform(`
Object.keys(obj).forEach(key => use(key));
    `)

      assert(!result.modified, "skip expression body")
    })

    test("skip Object.keys().forEach() accessing different object", () => {
      const result = transform(`
Object.keys(obj1).forEach(key => {
const value = obj2[key];
process(value);
});
    `)

      assert(!result.modified, "skip when accessing different object")
    })

    test("skip Object.keys().forEach() with non-identifier parameter", () => {
      const result = transform(`
Object.keys(obj).forEach(([key]) => {
const value = obj[key];
process(value);
});
    `)

      assert(!result.modified, "skip with destructuring parameter")
    })

    test("skip Object.keys().forEach() without callback", () => {
      const result = transform(`
Object.keys(obj).forEach();
    `)

      assert(!result.modified, "skip without callback")
    })

    test("skip Object.keys().forEach() with non-function callback", () => {
      const result = transform(`
Object.keys(obj).forEach(myCallback);
    `)

      assert(!result.modified, "skip with non-inline callback")
    })

    test("skip Object.keys() with no arguments", () => {
      const result = transform(`
Object.keys().forEach(key => {
use(key);
});
    `)

      assert(!result.modified, "skip Object.keys() with no arguments")
    })

    test("skip Object.keys() with multiple arguments", () => {
      const result = transform(`
Object.keys(obj1, obj2).forEach(key => {
const value = obj1[key];
process(value);
});
    `)

      assert(!result.modified, "skip Object.keys() with multiple arguments")
    })

    test("skip when value variable is not first statement", () => {
      const result = transform(`
Object.keys(obj).forEach(key => {
use(key);
const value = obj[key];
process(value);
});
    `)

      assert(!result.modified, "skip when value access is not first")
    })

    test("skip when accessing with different key variable", () => {
      const result = transform(`
Object.keys(obj).forEach(key => {
const value = obj[otherKey];
process(value);
});
    `)

      assert(!result.modified, "skip when using different key variable")
    })

    test("skip when not using computed member expression", () => {
      const result = transform(`
Object.keys(obj).forEach(key => {
const value = obj.key;
process(value);
});
    `)

      assert(!result.modified, "skip when using dot notation")
    })

    test("Object.keys().forEach() with complex object expression", () => {
      const result = transform(`
Object.keys(getObject()).forEach(key => {
const value = getObject()[key];
use(value);
});
    `)

      assert(result.modified, "transform with function call object")
      assert.match(
        result.code,
        /Object\.entries\(getObject\(\)\)\.forEach\(\(\[key, value\]\)/,
      )
    })

    test("Object.keys().forEach() with member expression object", () => {
      const result = transform(`
Object.keys(config.options).forEach(key => {
const value = config.options[key];
apply(key, value);
});
    `)

      assert(result.modified, "transform with member expression object")
      assert.match(
        result.code,
        /Object\.entries\(config\.options\)\.forEach\(\(\[key, value\]\)/,
      )
    })

    test("multiple Object.keys().forEach() transformations", () => {
      const result = transform(`
Object.keys(obj1).forEach(key => {
const value = obj1[key];
process(key, value);
});
Object.keys(obj2).forEach(k => {
const v = obj2[k];
handle(k, v);
});
    `)

      assert(result.modified, "transform multiple occurrences")
      assert.match(result.code, /Object\.entries\(obj1\)\.forEach\(\(\[key, value\]\)/)
      assert.match(result.code, /Object\.entries\(obj2\)\.forEach\(\(\[k, v\]\)/)
    })

    test("Object.keys().forEach() with multiple statements after value access", () => {
      const result = transform(`
Object.keys(obj).forEach(key => {
const value = obj[key];
console.log(key);
console.log(value);
process(key, value);
});
    `)

      assert(result.modified, "transform with multiple statements")
      assert.match(result.code, /Object\.entries\(obj\)\.forEach\(\(\[key, value\]\)/)
      assert.match(result.code, /console\.info\(key\)/)
      assert.match(result.code, /console\.info\(value\)/)
      assert.match(result.code, /process\(key, value\)/)
      assert.doesNotMatch(result.code, /const value = obj\[key\]/)
    })
  })
})
