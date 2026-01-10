import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("arrayFromForEachToForOf", () => {
    test("Array.from().forEach() with arrow function", () => {
      const result = transform(`
  Array.from(items).forEach(item => {
    console.log(item);
  });
`)

      assert(result.modified, "transform Array.from().forEach()")
      assert.match(result.code, /for \(const item of items\)/)
      assert.match(result.code, /console\.info\(item\)/)
    })

    test("Array.from().forEach() with arrow function expression", () => {
      const result = transform(`Array.from(numbers).forEach(n => console.log(n));`)

      assert(result.modified, "transform Array.from().forEach()")
      assert.match(result.code, /for \(const n of numbers\)/)
    })

    test("plain identifier forEach", () => {
      const result = transform(`
  items.forEach(item => {
    process(item);
  });
`)

      assert(!result.modified, "skip plain identifier forEach")
    })

    test("plain identifier forEach with function expression", () => {
      const result = transform(`numbers.forEach((n) => { process(n); });`)

      assert(!result.modified, "skip plain identifier forEach")
    })

    test("Array.from().forEach() with array destructuring", () => {
      const result = transform(`
  Array.from(Object.entries(obj)).forEach(([key, value]) => {
    console.log(key, value);
  });
`)

      assert(result.modified, "transform Array.from().forEach() with destructuring")
      assert.match(
        result.code,
        /for \(const \[key, value\] of Object\.entries\(obj\)\)/,
      )
    })

    test("Array.from().forEach() with index parameter", () => {
      const result = transform(`
  Array.from(items).forEach((item, index) => {
    process(item, index);
  });
`)

      assert(!result.modified, "skip callback with index parameter")
    })

    test("forEach with index parameter", () => {
      const result = transform(`
  items.forEach((item, index) => {
    process(item, index);
  });
`)

      assert(!result.modified, "skip callback with index parameter")
    })

    test("forEach on unknown objects", () => {
      const result = transform(`
  myCustomObject.forEach(item => {
    process(item);
  });
`)

      assert(!result.modified, "skip forEach on unknown objects")
    })

    test("Map.forEach()", () => {
      const result = transform(`
  myMap.forEach((value, key) => {
    process(key, value);
  });
`)

      assert(!result.modified, "skip Map.forEach() with 2 parameters")
    })

    test("Array.from().forEach() without callback", () => {
      const result = transform(`Array.from(items).forEach();`)

      assert(!result.modified, "skip Array.from().forEach() without callback")
    })

    test("Array.from().forEach() with non-function callback", () => {
      const result = transform(`Array.from(items).forEach(callback);`)

      assert(!result.modified, "skip Array.from().forEach() with non-function callback")
    })

    test("Array.from().forEach() with function expression", () => {
      const result = transform(`Array.from(items).forEach(function(item) {
      process(item);
    });`)

      assert(
        result.modified,
        "transform Array.from().forEach() with function expression",
      )
      assert.match(result.code, /for \(const item of items\)/)
    })
    test("Array.from().forEach() with destructuring and 2+ params", () => {
      const result = transform(`Array.from(items).forEach(([a, b], index) => {
      console.log(a, b, index);
    });`)

      assert(result.modified, "transform when first param is ArrayPattern")
      assert.match(result.code, /for \(const \[a, b\] of items\)/)
    })
  })
})
