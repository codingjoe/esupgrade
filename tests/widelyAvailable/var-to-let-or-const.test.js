import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("varToLetOrConst", () => {
    test("not reassigned", () => {
      const result = transform(`
  var x = 1;
`)

      assert(result.modified, "transform var when not reassigned")
      assert.match(result.code, /const x = 1/)
      assert.doesNotMatch(result.code, /var x/)
    })

    test("with reassignment", () => {
      const result = transform(`
  var x = 1;
  x = 2;
`)

      assert(result.modified, "transform var with reassignment")
      assert.match(result.code, /let x = 1/)
      assert.doesNotMatch(result.code, /var x/)
      assert.doesNotMatch(result.code, /const x/)
    })

    test("with repeated reassignment", () => {
      const result = transform(`
  var a = 1;
  a = 2;
  a = 3;
`)

      assert(result.modified, "transform var with repeated reassignment")
      assert.match(result.code, /let a = 1/)
      assert.doesNotMatch(result.code, /var a/)
    })

    test("multiple declarations", () => {
      const result = transform(`
  var x = 1;
  var y = 2;
  var z = 3;
`)

      assert(result.modified, "transform multiple var declarations")
      assert.match(result.code, /const x = 1/)
      assert.match(result.code, /const y = 2/)
      assert.match(result.code, /const z = 3/)
    })
    test("uninitialized var reassigned in loop", () => {
      const result = transform(`
  var pixels;
  for (let i = 0; i < 5; i++) {
    pixels = getVisiblePixels();
    pixels[0].hide();
  }
`)

      assert(result.modified, "transform var with loop reassignment")
      assert.match(result.code, /let pixels/)
      assert.doesNotMatch(result.code, /const pixels/)
      assert.doesNotMatch(result.code, /var pixels/)
    })

    test("var with increment operator", () => {
      const result = transform(`
  var counter = 0;
  counter++;
`)

      assert(result.modified, "transform var with increment")
      assert.match(result.code, /let counter = 0/)
      assert.doesNotMatch(result.code, /const counter/)
    })

    test("var with decrement operator", () => {
      const result = transform(`
  var counter = 10;
  counter--;
`)

      assert(result.modified, "transform var with decrement")
      assert.match(result.code, /let counter = 10/)
      assert.doesNotMatch(result.code, /const counter/)
    })

    test("multiple vars, some reassigned", () => {
      const result = transform(`
  var x = 1;
  var y = 2;
  x = 3;
`)

      assert(result.modified, "transform multiple vars with partial reassignment")
      assert.match(result.code, /let x = 1/)
      assert.match(result.code, /const y = 2/)
    })

    test("var with destructuring pattern", () => {
      const result = transform(`
  var { x, y } = obj;
`)

      assert(result.modified, "transform var with destructuring")
      assert.match(result.code, /const \{ x, y \} = obj/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("var with array destructuring", () => {
      const result = transform(`
  var [a, b] = arr;
`)

      assert(result.modified, "transform var with array destructuring")
      assert.match(result.code, /const \[a, b\] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("multiple declarators in single var statement", () => {
      const result = transform(`
  var x = 1, y = 2, z = 3;
`)

      assert(result.modified, "transform multiple declarators")
      assert.match(result.code, /const x = 1/)
      assert.match(result.code, /const y = 2/)
      assert.match(result.code, /const z = 3/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("multiple declarators with mixed reassignment", () => {
      const result = transform(`
  var x = 1, y = 2;
  x = 5;
`)

      assert(result.modified, "transform multiple declarators with reassignment")
      assert.match(result.code, /let x = 1/)
      assert.match(result.code, /const y = 2/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("multiple declarators with destructuring", () => {
      const result = transform(`
  var x = 1, { y, z } = obj;
`)

      assert(result.modified, "transform multiple declarators with destructuring")
      assert.match(result.code, /const x = 1/)
      assert.match(result.code, /const \{ y, z \} = obj/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("multiple declarators in a for initializer", () => {
      const result = transform(`
  for (var i = 0, n = 1; i < n; i++) {}
`)

      assert(result.modified, "transform multiple declarators in a for initializer")
      assert.match(result.code, /for \(let i = 0, n = 1; i < n; i\+\+\)/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("initialized and uninitialized declarators in a for initializer", () => {
      const result = transform(`
  for (var i = 0, j; ;) break;
`)

      assert(
        result.modified,
        "transform initialized and uninitialized declarators in a for initializer",
      )
      assert.match(result.code, /for \(let i = 0, j; ;\)/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("unreassigned declarators in a for initializer", () => {
      const result = transform(`
  for (var i = 0, n = 1; ;) break;
`)

      assert(result.modified, "transform unreassigned declarators in a for initializer")
      assert.match(result.code, /for \(const i = 0, n = 1; ;\)/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("multiple declarators in an exported declaration", () => {
      const result = transform(`
  export var x = 1, y = 2;
`)

      assert(
        result.modified,
        "transform multiple declarators in an exported declaration",
      )
      assert.match(result.code, /export const x = 1, y = 2/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("destructured variable reassigned later", () => {
      const result = transform(`
  var { x, y } = obj;
  x = 5;
`)

      assert(result.modified, "transform destructured var with reassignment")
      assert.match(result.code, /let \{ x, y \} = obj/)
      assert.doesNotMatch(result.code, /const \{ x, y \}/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("destructured variable via assignment expression", () => {
      const result = transform(`
  var x, y;
  ({ x, y } = obj);
`)

      assert(result.modified, "transform vars reassigned via destructuring")
      assert.match(result.code, /let x/)
      assert.match(result.code, /let y/)
      assert.doesNotMatch(result.code, /const x/)
      assert.doesNotMatch(result.code, /const y/)
    })

    test("variable with same name in different scopes", () => {
      const result = transform(`
  var x = 1;
  function foo() {
    var x = 2;
    x = 3;
  }
`)

      assert(result.modified, "transform with scoped variables")
      assert.match(result.code, /const x = 1/)
      assert.match(result.code, /let x = 2/)
    })

    test("outer variable not affected by inner scope reassignment", () => {
      const result = transform(`
  var x = 1;
  function bar() {
    x = 3;
  }
`)

      assert(result.modified, "outer var reassigned in nested scope")
      assert.match(result.code, /let x = 1/)
    })

    test("array destructuring with reassignment", () => {
      const result = transform(`
  var [a, b] = arr;
  a = 10;
`)

      assert(result.modified, "transform array destructuring with reassignment")
      assert.match(result.code, /let \[a, b\] = arr/)
      assert.doesNotMatch(result.code, /const \[a, b\]/)
    })

    test("object destructuring with rest element", () => {
      const result = transform(`
  var { a, ...rest } = obj;
`)

      assert(result.modified, "transform var with rest element")
      assert.match(result.code, /const \{ a, \.\.\.rest \} = obj/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("object destructuring rest element reassigned", () => {
      const result = transform(`
  var { a, ...rest } = obj;
  rest = {};
`)

      assert(result.modified, "transform rest element with reassignment")
      assert.match(result.code, /let \{ a, \.\.\.rest \} = obj/)
      assert.doesNotMatch(result.code, /const \{ a, \.\.\.rest \}/)
    })

    test("array destructuring with default value", () => {
      const result = transform(`
  var [a = 1, b] = arr;
`)

      assert(result.modified, "transform var with default value")
      assert.match(result.code, /const \[a = 1, b\] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring with default value reassigned", () => {
      const result = transform(`
  var [a = 1, b] = arr;
  a = 10;
`)

      assert(result.modified, "transform default value with reassignment")
      assert.match(result.code, /let \[a = 1, b\] = arr/)
      assert.doesNotMatch(result.code, /const \[a = 1, b\]/)
    })

    test("array destructuring with rest element", () => {
      const result = transform(`
  var [first, ...others] = arr;
`)

      assert(result.modified, "transform var with array rest element")
      assert.match(result.code, /const \[first, \.\.\.others\] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring with rest element reassigned", () => {
      const result = transform(`
  var [first, ...others] = arr;
  others = [];
`)

      assert(result.modified, "transform array rest element with reassignment")
      assert.match(result.code, /let \[first, \.\.\.others\] = arr/)
      assert.doesNotMatch(result.code, /const \[first, \.\.\.others\]/)
    })

    test("function param shadows outer var (const)", () => {
      const result = transform(`
  var x = 1;
  function foo(x) {
    x = 2;
  }
`)

      assert(result.modified, "outer var not reassigned due to param shadowing")
      assert.match(result.code, /const x = 1/)
      assert.doesNotMatch(result.code, /let x = 1/)
    })

    test("function param shadows outer var with increment", () => {
      const result = transform(`
  var counter = 1;
  function foo(counter) {
    counter++;
  }
`)

      assert(
        result.modified,
        "outer var not reassigned due to param shadowing increment",
      )
      assert.match(result.code, /const counter = 1/)
      assert.doesNotMatch(result.code, /let counter/)
    })

    test("function param with object rest shadows outer var", () => {
      const result = transform(`
  var rest = 1;
  function foo({ a, ...rest }) {
    rest = {};
  }
`)

      assert(result.modified, "outer var not reassigned due to rest param shadowing")
      assert.match(result.code, /const rest = 1/)
      assert.doesNotMatch(result.code, /let rest/)
    })

    test("function param with array pattern shadows outer var", () => {
      const result = transform(`
  var a = 1;
  function foo([a, b]) {
    a = 2;
  }
`)

      assert(result.modified, "outer var not reassigned due to array param shadowing")
      assert.match(result.code, /const a = 1/)
      assert.doesNotMatch(result.code, /let a/)
    })

    test("function param with array hole shadows outer var", () => {
      const result = transform(`
  var a = 1;
  function foo([, a]) {
    a = 2;
  }
`)

      assert(
        result.modified,
        "outer var not reassigned due to a hole in the array param",
      )
      assert.match(result.code, /const a = 1/)
      assert.doesNotMatch(result.code, /let a/)
    })

    test("function param with default value shadows outer var", () => {
      const result = transform(`
  var x = 1;
  function foo(x = 5) {
    x = 2;
  }
`)

      assert(result.modified, "outer var not reassigned due to default param shadowing")
      assert.match(result.code, /const x = 1/)
      assert.doesNotMatch(result.code, /let x/)
    })

    test("function param with array rest shadows outer var", () => {
      const result = transform(`
  var rest = 1;
  function foo([a, ...rest]) {
    rest = [];
  }
`)

      assert(
        result.modified,
        "outer var not reassigned due to array rest param shadowing",
      )
      assert.match(result.code, /const rest = 1/)
      assert.doesNotMatch(result.code, /let rest/)
    })

    test("inner declaration shadows outer var with increment only", () => {
      const result = transform(`
  var x = 1;
  function foo() {
    var x = 0;
    x++;
  }
`)

      assert(
        result.modified,
        "outer var not reassigned - inner declaration shadows increment",
      )
      assert.match(result.code, /const x = 1/)
      assert.doesNotMatch(result.code, /let x = 1/)
    })

    test("other var increment does not affect our var", () => {
      const result = transform(`
  var x = 1;
  var y = 0;
  y++;
`)

      assert(result.modified, "x becomes const, y becomes let")
      assert.match(result.code, /const x = 1/)
      assert.match(result.code, /let y = 0/)
    })

    test("array destructuring with holes", () => {
      const result = transform(`
  var [a, , b] = arr;
`)

      assert(result.modified, "transform var with array holes")
      assert.match(result.code, /const \[a, , b\] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring assignment with hole", () => {
      const result = transform(`
  var a, b;
  [a, , b] = arr;
`)

      assert(
        result.modified,
        "transform vars reassigned via array destructuring with hole",
      )
      assert.match(result.code, /let a/)
      assert.match(result.code, /let b/)
    })

    test("uninitialized var must become let", () => {
      const result = transform(`
  var key;
  for (key in obj) {
    console.log(key);
  }
`)

      assert(result.modified, "transform uninitialized var to let")
      assert.match(result.code, /let key/)
      assert.doesNotMatch(result.code, /const key/)
      assert.doesNotMatch(result.code, /var key/)
    })

    test("array destructuring with holes and reassignment", () => {
      const result = transform(`
  var [a, , b] = arr;
  a = 5;
`)

      assert(result.modified, "transform var with array holes and reassignment")
      assert.match(result.code, /let \[a, , b\]/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("inner var shadows outer const and is reassigned", () => {
      const result = transform(`
  const pixels = [];
  const obj = {
    fadePixels: function () {
      var pixels;
      for (var i = 0; i < 10; i++) {
        pixels = getPixels();
      }
    }
  };
`)

      assert(result.modified, "inner var shadowing outer const, reassigned in loop")
      // The outer const pixels should remain const
      assert.match(result.code, /const pixels = \[\]/)
      // The inner var pixels should become let (not const) since it's reassigned
      assert.match(result.code, /let pixels;/)
      assert.doesNotMatch(result.code, /const pixels;/)
    })

    test("var written through a non-null assertion", () => {
      const result = transform(`
  var x = 1;
  x! = 2;
`)

      assert(result.modified, "transform var written through a non-null assertion")
      assert.match(result.code, /let x/)
      assert.doesNotMatch(result.code, /const x/)
    })

    test("var incremented through a non-null assertion", () => {
      const result = transform(`
  var y = 1;
  y!++;
`)

      assert(result.modified, "transform var incremented through a non-null assertion")
      assert.match(result.code, /let y/)
      assert.doesNotMatch(result.code, /const y/)
    })

    test("for-of target written through a non-null assertion", () => {
      const result = transform(`
  var z = 1;
  for (z! of [1, 2]) {}
`)

      assert(
        result.modified,
        "transform for-of target written through a non-null assertion",
      )
      assert.match(result.code, /let z/)
      assert.doesNotMatch(result.code, /const z/)
    })

    test("var assigned through a type assertion", () => {
      const result = transform(`
  var v = 1;
  (v as any) = 2;
`)

      assert(result.modified, "transform var assigned through a type assertion")
      assert.match(result.code, /let v/)
      assert.doesNotMatch(result.code, /const v/)
    })

    test("for-of loop variable", () => {
      const result = transform(`
  const items = [1, 2, 3];
  for (var item of items) {
    console.log(item);
  }
`)

      assert(result.modified, "transform for-of loop variable")
      assert.match(result.code, /for \(const item of items\)/)
      assert.doesNotMatch(result.code, /var item/)
      assert.doesNotMatch(result.code, /let item/)
    })

    test("for-of loop variable beside a wrapped write", () => {
      const result = transform(`
  const items = [1, 2, 3];
  var other = 1;
  for (var item of items) {
    console.log(item);
  }
  other! = 2;
`)

      assert(result.modified, "transform for-of loop variable beside a wrapped write")
      assert.match(result.code, /for \(const item of items\)/)
      assert.doesNotMatch(result.code, /let item/)
      assert.match(result.code, /let other/)
    })

    test("for-in loop variable", () => {
      const result = transform(`
  const obj = { a: 1, b: 2 };
  for (var key in obj) {
    console.log(key);
  }
`)

      assert(result.modified, "transform for-in loop variable")
      assert.match(result.code, /for \(const key in obj\)/)
      assert.doesNotMatch(result.code, /var key/)
      assert.doesNotMatch(result.code, /let key/)
    })

    test("for-of loop with array literal", () => {
      const result = transform(`
  for (var num of [1, 2, 3]) {
    console.log(num);
  }
`)

      assert(result.modified, "transform for-of with array literal")
      assert.match(result.code, /for \(const num of \[1, 2, 3\]\)/)
      assert.doesNotMatch(result.code, /var num/)
      assert.doesNotMatch(result.code, /let num/)
    })

    test("for-in loop with object properties", () => {
      const result = transform(`
  for (var prop in window) {
    if (prop.startsWith('on')) {
      console.log(prop);
    }
  }
`)

      assert(result.modified, "transform for-in with object properties")
      assert.match(result.code, /for \(const prop in/)
      assert.doesNotMatch(result.code, /var prop/)
      assert.doesNotMatch(result.code, /let prop/)
    })

    test("single-statement if body", () => {
      const result = transform(`
  if (x) var a = 1;
`)

      assert(result.modified, "wrap the declaration in a block")
      assert.match(result.code, /if \(x\) \{\s*const a = 1;\s*\}/)
    })

    test("single-statement else body", () => {
      const result = transform(`
  if (x) y(); else var a = 1;
`)

      assert(result.modified, "wrap the declaration in a block")
      assert.match(result.code, /else \{\s*const a = 1;\s*\}/)
    })

    test("single-statement while body", () => {
      const result = transform(`
  while (x) var a = 1;
`)

      assert(result.modified, "wrap the declaration in a block")
      assert.match(result.code, /while \(x\) \{\s*const a = 1;\s*\}/)
    })

    test("single-statement do-while body", () => {
      const result = transform(`
  do var a = 1; while (x);
`)

      assert(result.modified, "wrap the declaration in a block")
      assert.match(result.code, /do \{\s*const a = 1;\s*\} while \(x\);/)
    })

    test("single-statement for body", () => {
      const result = transform(`
  for (;;) var a = 1;
`)

      assert(result.modified, "wrap the declaration in a block")
      assert.match(result.code, /for \(; ; \) \{\s*const a = 1;\s*\}/)
    })

    test("single-statement for-in body", () => {
      const result = transform(`
  for (const key in obj) var a = 1;
`)

      assert(result.modified, "wrap the declaration in a block")
      assert.match(result.code, /for \(const key in obj\) \{\s*const a = 1;\s*\}/)
    })

    test("single-statement labelled body", () => {
      const result = transform(`
  label: var a = 1;
`)

      assert(result.modified, "wrap the declaration in a block")
      assert.match(result.code, /label:\s*\{\s*const a = 1;\s*\}/)
    })

    test("single-statement body with multiple declarators", () => {
      const result = transform(`
  if (x) var a = 1, b = 2;
`)

      assert(result.modified, "split multiple declarators inside the block")
      assert.match(result.code, /if \(x\) \{\s*const a = 1;\s*const b = 2;\s*\}/)
    })

    test("single-statement body without initializers", () => {
      const result = transform(`
  if (x) var a, b;
`)

      assert(result.modified, "declare uninitialized names with let")
      assert.match(result.code, /if \(x\) \{\s*let a;\s*let b;\s*\}/)
    })

    test("single-statement body with destructuring pattern", () => {
      const result = transform(`
  if (x) var { a, b } = obj;
`)

      assert(result.modified, "keep property keys inside the pattern")
      assert.match(result.code, /if \(x\) \{\s*const \{ a, b \} = obj;\s*\}/)
    })

    test("single-statement body beside a property of the same name", () => {
      const result = transform(`
  if (x) var a = 1;
  obj.a = 2;
`)

      assert(result.modified, "read a member property as no reference")
      assert.match(result.code, /if \(x\) \{\s*const a = 1;\s*\}/)
      assert.match(result.code, /obj\.a = 2/)
    })

    test("single-statement body with a reference outside", () => {
      const result = transform(`
  if (x) var a = 1;
  use(a);
`)

      assert(!result.modified, "keep var when a reference lives outside the body")
      assert.match(result.code, /if \(x\) var a = 1;/)
    })

    test("single-statement body with multiple declarators and a reference outside", () => {
      const result = transform(`
  if (x) var a = 1, b = 2;
  use(a);
`)

      assert(!result.modified, "keep var when a reference lives outside the body")
      assert.match(result.code, /if \(x\) var a = 1, b = 2;/)
    })

    test("single-statement body with a repeated name", () => {
      const result = transform(`
  if (x) var a = 1, a = 2;
`)

      assert(!result.modified, "keep var when a name repeats")
      assert.match(result.code, /if \(x\) var a = 1, a = 2;/)
    })

    test("single-statement body with a self reference", () => {
      const result = transform(`
  if (x) var a = a || 1;
`)

      assert(!result.modified, "keep var when the initializer reads the name")
      assert.match(result.code, /if \(x\) var a = a \|\| 1;/)
    })

    test("single-statement body with a computed member", () => {
      const result = transform(`
  if (x) var a = obj[a];
`)

      assert(!result.modified, "keep var when a computed member reads the name")
      assert.match(result.code, /if \(x\) var a = obj\[a\];/)
    })

    test("single-statement body with a computed key", () => {
      const result = transform(`
  if (x) var a = { [a]: 1 };
`)

      assert(!result.modified, "keep var when a computed key reads the name")
      assert.match(result.code, /if \(x\) var a = \{ \[a\]: 1 \};/)
    })

    test("preserve var in declare global", () => {
      const result = transform(`
  declare global {
    var csrftoken: string;
  }
`)

      assert(!result.modified, "skip ambient declare global var")
      assert.match(result.code, /var csrftoken: string;/)
      assert.doesNotMatch(result.code, /const csrftoken: string;/)
      assert.doesNotMatch(result.code, /let csrftoken: string;/)
    })

    test("preserve top-level declare var", () => {
      const result = transform(`
  declare var csrftoken: string;
`)

      assert(!result.modified, "skip top-level ambient declare var")
      assert.match(result.code, /declare var csrftoken: string;/)
      assert.doesNotMatch(result.code, /declare const csrftoken: string;/)
      assert.doesNotMatch(result.code, /declare let csrftoken: string;/)
    })
  })
})
