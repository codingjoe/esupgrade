import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("forLoopToForOf", () => {
    test("basic array indexing", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
const item = items[i];
console.log(item);
}
    `)

      assert(result.modified, "transform basic array indexing")
      assert.match(result.code, /for \(const item of items\)/)
      assert.match(result.code, /console\.info\(item\)/)
      assert.doesNotMatch(result.code, /items\[i\]/)
    })

    test("const variable", () => {
      const result = transform(`
for (let i = 0; i < arr.length; i++) {
const element = arr[i];
process(element);
}
    `)

      assert(result.modified, "transform with const variable")
      assert.match(result.code, /for \(const element of arr\)/)
    })

    test("let variable", () => {
      const result = transform(`
for (let i = 0; i < arr.length; i++) {
let element = arr[i];
element = transform(element);
process(element);
}
    `)

      assert(result.modified, "transform with let variable")
      assert.match(result.code, /for \(let element of arr\)/)
    })

    test("var variable", () => {
      const result = transform(`
for (let i = 0; i < arr.length; i++) {
var element = arr[i];
console.log(element);
}
    `)

      assert(result.modified, "transform with var variable")
      assert.match(result.code, /for \(const element of arr\)/)
    })

    test("index used in body", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
const item = items[i];
process(item, i);
}
    `)

      assert(!result.modified, "skip when index used in body")
    })

    test("no array access statement", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
process(i);
}
    `)

      assert(!result.modified, "skip when no array access statement")
    })

    test("empty body", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
}
    `)

      assert(!result.modified, "skip when body is empty")
    })

    test("different increment", () => {
      const result = transform(`
for (let i = 0; i < items.length; i += 2) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when using different increment")
    })

    test("non-zero start", () => {
      const result = transform(`
for (let i = 1; i < items.length; i++) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when starting from non-zero")
    })

    test("using <= instead of <", () => {
      const result = transform(`
for (let i = 0; i <= items.length; i++) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when using <= instead of <")
    })

    test("different array access", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
const item = otherArray[i];
process(item);
}
    `)

      assert(!result.modified, "skip when accessing different array")
    })

    test("no variable declaration first", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
process(items[i]);
}
    `)

      assert(!result.modified, "skip when first statement is not variable declaration")
    })

    test("different index variable", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
const item = items[j];
process(item);
}
    `)

      assert(!result.modified, "skip when using different index variable")
    })

    test("prefix increment", () => {
      const result = transform(`
for (let i = 0; i < items.length; ++i) {
const item = items[i];
process(item);
}
    `)

      assert(result.modified, "transform with prefix increment")
      assert.match(result.code, /for \(const item of items\)/)
    })

    test("multiple statements", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
const item = items[i];
process(item);
cleanup();
}
    `)

      assert(result.modified, "transform with multiple statements")
      assert.match(result.code, /for \(const item of items\)/)
      assert.match(result.code, /process\(item\)/)
      assert.match(result.code, /cleanup\(\)/)
    })

    test("init not variable declaration", () => {
      const result = transform(`
for (i = 0; i < items.length; i++) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when init is not variable declaration")
    })

    test("init multiple declarations", () => {
      const result = transform(`
for (let i = 0, j = 0; i < items.length; i++) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when init has multiple declarations")
    })

    test("init id not identifier", () => {
      const result = transform(`
for (let [i] = [0]; i < items.length; i++) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when init id is not identifier")
    })

    test("test not binary expression", () => {
      const result = transform(`
for (let i = 0; items.length; i++) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when test is not binary expression")
    })

    test("test operator not <", () => {
      const result = transform(`
for (let i = 0; i <= items.length; i++) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when test operator is not <")
    })

    test("test left not index variable", () => {
      const result = transform(`
for (let i = 0; j < items.length; i++) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when test left is not index variable")
    })

    test("test right not member expression", () => {
      const result = transform(`
for (let i = 0; i < 10; i++) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when test right is not member expression")
    })

    test("test right property not 'length'", () => {
      const result = transform(`
for (let i = 0; i < items.size; i++) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when test right property is not 'length'")
    })

    test("test right object not identifier", () => {
      const result = transform(`
for (let i = 0; i < getItems().length; i++) {
const item = getItems()[i];
process(item);
}
    `)

      assert(!result.modified, "skip when test right object is not identifier")
    })

    test("update not update expression", () => {
      const result = transform(`
for (let i = 0; i < items.length; i = i + 1) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when update is not update expression")
    })

    test("update argument not index variable", () => {
      const result = transform(`
for (let i = 0; i < items.length; j++) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when update argument is not index variable")
    })

    test("update operator not ++", () => {
      const result = transform(`
for (let i = 0; i < items.length; i--) {
const item = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when update operator is not ++")
    })

    test("body not block statement", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++)
process(items[i]);
    `)

      assert(!result.modified, "skip when body is not block statement")
    })

    test("first statement multiple declarations", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
const item = items[i], other = null;
process(item);
}
    `)

      assert(!result.modified, "skip when first statement has multiple declarations")
    })

    test("first statement id not identifier", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
const [item] = items[i];
process(item);
}
    `)

      assert(!result.modified, "skip when first statement id is not identifier")
    })

    test("first statement init not member expression", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
const item = getItem(i);
process(item);
}
    `)

      assert(
        !result.modified,
        "skip when first statement init is not member expression",
      )
    })

    test("member expression object name mismatch", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
const item = other[i];
process(item);
}
    `)

      assert(!result.modified, "skip when member expression object name doesn't match")
    })

    test("member expression property not matching index", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
const item = items[j];
process(item);
}
    `)

      assert(
        !result.modified,
        "skip when member expression property doesn't match index",
      )
    })

    test("member expression not computed", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
const item = items.i;
process(item);
}
    `)

      assert(!result.modified, "skip when member expression is not computed")
    })

    test("tracks line numbers", () => {
      const result = transform(`// Line 1
for (let i = 0; i < items.length; i++) {
const item = items[i];
process(item);
}`)

      assert(result.modified, "tracks line numbers")
    })
  })
})
