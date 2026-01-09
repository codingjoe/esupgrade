import { describe, suite, test } from "node:test"
import assert from "node:assert/strict"
import { transform } from "../src/index.js"
import { NodeTest } from "../src/types.js"

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

  describe("arrayFromToSpread", () => {
    test("Array.from() with map()", () => {
      const result = transform(`const doubled = Array.from(numbers).map(n => n * 2);`)

      assert(result.modified, "transform Array.from() with map()")
      assert.match(result.code, /\[\.\.\.numbers\]\.map/)
      assert.doesNotMatch(result.code, /Array\.from/)
    })

    test("Array.from() with filter()", () => {
      const result = transform(`const filtered = Array.from(items).filter(x => x > 5);`)

      assert(result.modified, "transform Array.from() with filter()")
      assert.match(result.code, /\[\.\.\.items\]\.filter/)
    })

    test("Array.from() with some()", () => {
      const result = transform(
        `const hasValue = Array.from(collection).some(item => item.active);`,
      )

      assert(result.modified, "transform Array.from() with some()")
      assert.match(result.code, /\[\.\.\.collection\]\.some/)
    })

    test("Array.from() with every()", () => {
      const result = transform(
        `const allValid = Array.from(items).every(x => x.valid);`,
      )

      assert(result.modified, "transform Array.from() with every()")
      assert.match(result.code, /\[\.\.\.items\]\.every/)
    })

    test("Array.from() with find()", () => {
      const result = transform(
        `const found = Array.from(elements).find(el => el.id === 'target');`,
      )

      assert(result.modified, "transform Array.from() with find()")
      assert.match(result.code, /\[\.\.\.elements\]\.find/)
    })

    test("Array.from() with reduce()", () => {
      const result = transform(
        `const sum = Array.from(values).reduce((a, b) => a + b, 0);`,
      )

      assert(result.modified, "transform Array.from() with reduce()")
      assert.match(result.code, /\[\.\.\.values\]\.reduce/)
    })

    test("standalone Array.from()", () => {
      const result = transform(`const arr = Array.from(iterable);`)

      assert(result.modified, "transform standalone Array.from()")
      assert.match(result.code, /const arr = \[\.\.\.iterable\]/)
    })

    test("Array.from() with property access", () => {
      const result = transform(`const length = Array.from(items).length;`)

      assert(result.modified, "transform Array.from() with property access")
      assert.match(result.code, /\[\.\.\.items\]\.length/)
    })

    test("Array.from().forEach() prioritizes over spread", () => {
      const result = transform(`Array.from(items).forEach(item => console.log(item));`)

      assert(result.modified, "prioritize over spread")
      assert.match(result.code, /for \(const item of items\)/)
      assert.doesNotMatch(result.code, /\[\.\.\./)
    })

    test("Array.from() with mapping function", () => {
      const result = transform(`const doubled = Array.from(numbers, n => n * 2);`)

      assert(!result.modified, "skip Array.from() with mapping function")
    })

    test("Array.from() with thisArg", () => {
      const result = transform(
        `const result = Array.from(items, function(x) { return x * this.multiplier; }, context);`,
      )

      assert(!result.modified, "skip Array.from() with thisArg")
    })

    test("chained methods on Array.from()", () => {
      const result = transform(
        `const result = Array.from(set).map(x => x * 2).filter(x => x > 10);`,
      )

      assert(result.modified, "transform Array.from() with chained methods")
      assert.match(result.code, /\[\.\.\.set\]\.map/)
    })

    test("Array.from() with complex iterable", () => {
      const result = transform(
        `const arr = Array.from(document.querySelectorAll('.item'));`,
      )

      assert(result.modified, "transform Array.from() with complex iterable")
      assert.match(result.code, /\[\.\.\.document\.querySelectorAll\('\.item'\)\]/)
    })
  })

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
  })

  describe("stringConcatToTemplate", () => {
    test("string concatenation", () => {
      const result = transform(`const greeting = 'Hello ' + name + '!';`)

      assert(result.modified, "transform string concatenation")
      assert.match(result.code, /`Hello \$\{name\}!`/)
    })

    test("multiple concatenations", () => {
      const result = transform(
        `const msg = 'Hello ' + firstName + ' ' + lastName + '!';`,
      )

      assert(result.modified, "transform multiple concatenations")
      assert.match(result.code, /`Hello \$\{firstName\} \$\{lastName\}!`/)
    })

    test("starting with expression", () => {
      const result = transform(`const msg = prefix + ' world';`)

      assert(result.modified, "transform concatenation starting with expression")
      assert.match(result.code, /`\$\{prefix\} world`/)
    })

    test("only expressions", () => {
      const result = transform(`const msg = a + b + c;`)

      assert(!result.modified, "skip concatenation with only expressions")
    })

    test("ending with expression", () => {
      const result = transform(`const msg = 'Value: ' + value;`)

      assert(result.modified, "transform concatenation ending with expression")
      assert.match(result.code, /`Value: \$\{value\}`/)
    })

    test("complex nested", () => {
      const result = transform(`const msg = 'Start ' + (a + 'middle') + ' end';`)

      assert(result.modified, "transform complex nested concatenation")
      assert.match(result.code, /`/)
    })

    test("numeric addition followed by string", () => {
      const result = transform(`cal_box.style.left = findPosX(cal_link) + 17 + 'px';`)

      assert(
        result.modified,
        "transform numeric addition followed by string concatenation",
      )
      assert.match(result.code, /`\$\{findPosX\(cal_link\) \+ 17\}px`/)
    })

    test("multiple numeric additions followed by string", () => {
      const result = transform(`const result = a + b + c + 'd';`)

      assert(
        result.modified,
        "transform multiple numeric additions followed by string concatenation",
      )
      assert.match(result.code, /`\$\{a \+ b \+ c\}d`/)
    })

    test("string followed by numeric addition", () => {
      const result = transform(`const result = 'Value: ' + x + y;`)

      assert(
        result.modified,
        "transform string concatenation followed by numeric addition",
      )
      assert.match(result.code, /`Value: \$\{x\}\$\{y\}`/)
    })

    test("numeric addition in middle", () => {
      const result = transform(`const result = 'start' + (a + b) + 'end';`)

      assert(result.modified, "transform numeric addition in middle of concatenations")
      assert.match(result.code, /`start\$\{(\()?a \+ b(\))?\}end`/)
    })

    test("consecutive string literals", () => {
      const result = transform(`const msg = 'Hello' + ' ' + 'world';`)

      assert(result.modified, "merge consecutive string literals")
      assert.match(result.code, /`Hello world`/)
    })

    test("string literal followed by expression", () => {
      const result = transform(`const msg = 'Value: ' + getValue();`)

      assert(result.modified, "transform string literal followed by expression")
      assert.match(result.code, /`Value: \$\{getValue\(\)\}`/)
    })

    test("expression followed by string literal", () => {
      const result = transform(`const msg = getValue() + ' is the value';`)

      assert(result.modified, "transform expression followed by string literal")
      assert.match(result.code, /`\$\{getValue\(\)\} is the value`/)
    })

    test("expression in middle", () => {
      const result = transform(`const msg = 'start' + getValue() + 'end';`)

      assert(result.modified, "transform expression in middle")
      assert.match(result.code, /`start\$\{getValue\(\)\}end`/)
    })

    test("preserves escape sequences in regex", () => {
      const result = transform(
        `const id_regex = new RegExp("(" + prefix + "-(\\\\d+|__prefix__))");`,
      )

      assert(result.modified, "transform and preserve escape sequences")
      assert.match(result.code, /`\(\$\{prefix\}-\(\\\\d\+\|__prefix__\)\)`/)
      assert.ok(result.code.includes("\\\\d"), "preserve \\\\d escape sequence")
    })

    test("preserves newline escapes", () => {
      // Use single backslash which represents the escape sequence in source code
      const result = transform('const str = "Line 1\\n" + "Line 2";')

      assert(result.modified, "transform and convert \\n to actual newline")
      // \n should become an actual newline in template literal
      assert.ok(result.code.includes("\n"), "\\n should become actual newline")
      assert.match(
        result.code,
        /`Line 1\nLine 2`/,
        "should have template literal with newline",
      )
    })

    test("preserves carriage return and newline escapes", () => {
      // Use single backslash which represents the escape sequence in source code
      const result = transform('const a = "foo\\r\\n" + "bar"')

      assert(
        result.modified,
        "transform and preserve \\r escape, convert \\n to newline",
      )
      assert.ok(result.code.includes("\\r"), "preserve \\r escape sequence")
      // \n should become an actual newline in template literal
      assert.ok(result.code.includes("\n"), "\\n should become actual newline")
      // Should match `foo\r<newline>bar` pattern
      assert.match(
        result.code,
        /`foo\\r\nbar`/,
        "output should be template literal with \\r escape and actual newline",
      )
    })

    test("regression: no extra backslash with \\r\\n on multiline concatenation", () => {
      // Regression test for issue #94
      // When "foo\r\n" + "bar" spans multiple lines, the \n at the end of the first string
      // should prevent adding a line continuation backslash
      const result = transform(`const myVar = "foo\\r\\n" +
              "bar"`)

      assert(result.modified, "transform multiline concatenation with \\r\\n")
      assert.ok(result.code.includes("\\r"), "preserve \\r escape sequence")
      // \n should become an actual newline in template literal
      assert.ok(result.code.includes("\n"), "\\n should become actual newline")
      // Should NOT have an extra backslash after the newline
      assert.match(
        result.code,
        /`foo\\r\nbar`/,
        "should not have extra line continuation after \\n",
      )
      // Verify no double backslash or extra continuation
      assert.ok(
        !result.code.includes("\\\n\\\n"),
        "should not have double line continuation",
      )
    })

    test("preserves multiline formatting with line continuation", () => {
      const result = transform(`const myVar = "foo" +
              "bar"`)

      assert(result.modified, "transform multiline concatenation")
      assert.match(
        result.code,
        /`foo\\\nbar`/,
        "should have line continuation backslash",
      )
    })

    test("preserves multiline formatting with multiple strings", () => {
      const result = transform(`const myVar = "foo" +
              "bar" +
              "baz"`)

      assert(result.modified, "transform multiline concatenation with multiple strings")
      // Should have two line continuations
      assert.match(result.code, /`foo\\\nbar\\\nbaz`/, "should have line continuations")
    })

    test("single line concatenation has no line continuation", () => {
      const result = transform(`const myVar = "foo" + "bar"`)

      assert(result.modified, "transform single line concatenation")
      assert.match(result.code, /`foobar`/, "should not have line continuation")
      assert.ok(!result.code.includes("\\"), "should not have backslash")
    })

    test("preserves tab escapes", () => {
      const result = transform(`const str = "Tab\\\\t" + value + "\\\\t";`)

      assert(result.modified, "transform and preserve tab escapes")
      assert.ok(result.code.includes("\\\\t"), "preserve \\\\t escape sequence")
    })

    test("escapes backticks", () => {
      const result = transform(`const str = '\`' + myvar + '\` something';`)

      assert(result.modified, "transform and escape backticks")
      assert.match(result.code, /`\\`\$\{myvar\}\\` something`/)
    })

    test("escapes backtick at start", () => {
      const result = transform(`const str = '\`hello' + myvar;`)

      assert(result.modified, "transform and escape backtick at start")
      assert.match(result.code, /`\\`hello\$\{myvar\}`/)
    })

    test("escapes backtick at end", () => {
      const result = transform(`const str = myvar + 'world\`';`)

      assert(result.modified, "transform and escape backtick at end")
      assert.match(result.code, /`\$\{myvar\}world\\``/)
    })

    test("escapes multiple backticks", () => {
      const result = transform(`const str = '\`a\`' + myvar + '\`b\`';`)

      assert(result.modified, "transform and escape multiple backticks")
      assert.match(result.code, /`\\`a\\`\$\{myvar\}\\`b\\``/)
    })

    test("escapes dollar-brace", () => {
      const result = transform(`const str = 'Price: \${10}' + myvar;`)

      assert(result.modified, "transform and escape dollar-brace")
      assert.match(result.code, /`Price: \\\$\{10\}\$\{myvar\}`/)
    })

    test("escapes complex dollar-brace pattern", () => {
      const result = transform(`const str = 'Template: \${name}' + myvar + ' end';`)

      assert(result.modified, "transform and escape complex dollar-brace")
      assert.match(result.code, /`Template: \\\$\{name\}\$\{myvar\} end`/)
    })

    test("preserves dollar sign without brace", () => {
      const result = transform(`const str = 'Price: $10' + myvar;`)

      assert(result.modified, "transform but don't escape lone dollar")
      assert.match(result.code, /`Price: \$10\$\{myvar\}`/)
      assert.doesNotMatch(result.code, /\\\$10/)
    })

    test("escapes all special characters together", () => {
      const result = transform(`const str = '\\\\ \` \${x}' + myvar;`)

      assert(result.modified, "transform and escape all special chars")
      // Input: '\\' (one backslash), '`' (one backtick), '${x}' (dollar-brace)
      // Output: `\\` (one backslash), `\`` (escaped backtick), `\${x}` (escaped dollar-brace)
      // In result.code string: \\ (2 chars), \` (2 chars), \${ (3 chars)
      assert.ok(result.code.includes("\\\\"))
      assert.ok(result.code.includes("\\`"))
      assert.ok(result.code.includes("\\${"))
    })

    test("fallback when extra.raw is missing", () => {
      // Test NodeTest.getRawStringValue() fallback for nodes without extra.raw.
      // Exercise fallback behavior for nodes that lack extra.raw without going through transform.
      const mockNode = {
        type: "Literal",
        value: "hello\nworld",
      }

      const nodeTest = new NodeTest(mockNode)
      const result = nodeTest.getRawStringValue()

      // Should use fallback and keep newline as actual newline (result should be "hello\nworld" with actual newline)
      assert.ok(result.includes("\n"), "should have actual newline")
      assert.strictEqual(result, "hello\nworld")
    })

    test("fallback escapes special chars", () => {
      // Test that fallback path properly escapes backticks and ${
      const mockNode = {
        type: "Literal",
        value: "test`${value}",
      }

      const nodeTest = new NodeTest(mockNode)
      const result = nodeTest.getRawStringValue()

      assert.ok(result.includes("\\`"), "should escape backticks in fallback")
      assert.ok(result.includes("\\${"), "should escape dollar-brace in fallback")
    })
  })

  describe("objectAssignToSpread", () => {
    test("to object spread", () => {
      const result = transform(`const obj = Object.assign({}, obj1, obj2);`)

      assert(result.modified, "transform Object.assign")
      assert.match(result.code, /\.\.\.obj1/)
      assert.match(result.code, /\.\.\.obj2/)
    })

    test("non-empty first arg", () => {
      const result = transform(`const obj = Object.assign({ a: 1 }, obj1);`)

      assert(!result.modified, "skip Object.assign with non-empty first arg")
    })

    test("non-object first arg", () => {
      const result = transform(`const obj = Object.assign(target, obj1);`)

      assert(!result.modified, "skip Object.assign with non-object first arg")
    })

    test("only empty object", () => {
      const result = transform(`const obj = Object.assign({});`)

      assert(result.modified, "transform Object.assign with only empty object")
      assert.match(result.code, /\{\}/)
    })
  })

  describe("mathPowToExponentiation", () => {
    test("to **", () => {
      const result = transform(`const result = Math.pow(2, 3);`)

      assert(result.modified, "transform Math.pow()")
      assert.match(result.code, /2 \*\* 3/)
    })

    test("with variables", () => {
      const result = transform(`const power = Math.pow(base, exponent);`)

      assert(result.modified, "transform Math.pow() with variables")
      assert.match(result.code, /base \*\* exponent/)
    })

    test("with complex expressions", () => {
      const result = transform(`const result = Math.pow(x + 1, y * 2);`)

      assert(result.modified, "transform Math.pow() with complex expressions")
      assert.match(result.code, /\(x \+ 1\) \*\* \(y \* 2\)/)
    })

    test("in expressions", () => {
      const result = transform(`const area = Math.PI * Math.pow(radius, 2);`)

      assert(result.modified, "transform Math.pow() in expressions")
      assert.match(result.code, /Math\.PI \* radius \*\* 2/)
    })

    test("wrong number of arguments", () => {
      const result = transform(`const result = Math.pow(2);`)

      assert(!result.modified, "skip Math.pow() with wrong number of arguments")
    })

    test("nested calls", () => {
      const result = transform(`const result = Math.pow(Math.pow(2, 3), 4);`)

      assert(result.modified, "transform nested Math.pow() in single pass")
      assert.match(result.code, /Math\.pow\(2, 3\) \*\* 4/)
    })
  })

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

  describe("iterableForEachToForOf", () => {
    test("document.querySelectorAll()", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `)

      assert(result.modified, "transform document.querySelectorAll().forEach()")
      assert.match(
        result.code,
        /for \(const item of document\.querySelectorAll\(['"]\.item['"]\)\)/,
      )
      assert.match(result.code, /console\.info\(item\)/)
    })

    test("document.getElementsByTagName()", () => {
      const result = transform(`
    document.getElementsByTagName('div').forEach(div => {
      div.classList.add('active');
    });
  `)

      assert(result.modified, "transform document.getElementsByTagName().forEach()")
      assert.match(
        result.code,
        /for \(const div of document\.getElementsByTagName\(['"]div['"]\)\)/,
      )
    })

    test("document.getElementsByClassName()", () => {
      const result = transform(`
    document.getElementsByClassName('button').forEach(button => {
      button.disabled = true;
    });
  `)

      assert(result.modified, "transform document.getElementsByClassName().forEach()")
      assert.match(
        result.code,
        /for \(const button of document\.getElementsByClassName\(['"]button['"]\)\)/,
      )
    })

    test("document.getElementsByName()", () => {
      const result = transform(`
    document.getElementsByName('email').forEach(input => {
      input.required = true;
    });
  `)

      assert(result.modified, "transform document.getElementsByName().forEach()")
      assert.match(
        result.code,
        /for \(const input of document\.getElementsByName\(['"]email['"]\)\)/,
      )
    })

    test("element variable querySelectorAll", () => {
      const result = transform(`
    element.querySelectorAll('.item').forEach(item => {
      process(item);
    });
  `)

      assert(!result.modified, "skip element variable querySelectorAll")
    })

    test("chained querySelectorAll()", () => {
      const result = transform(`
    document.getElementById('container').querySelectorAll('p').forEach(p => {
      p.textContent = '';
    });
  `)

      assert(result.modified, "transform chained querySelectorAll().forEach()")
      assert.match(
        result.code,
        /for \(const p of document\.getElementById\(['"]container['"]\)\.querySelectorAll\(['"]p['"]\)\)/,
      )
    })

    test("window.frames", () => {
      const result = transform(`
    window.frames.forEach(frame => {
      frame.postMessage('hello', '*');
    });
  `)

      assert(result.modified, "transform window.frames.forEach()")
      assert.match(result.code, /for \(const frame of globalThis\.frames\)/)
    })

    test("arrow function without braces", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach(item => item.remove());
  `)

      assert(!result.modified, "skip arrow function without braces")
    })

    test("with index parameter", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach((item, index) => {
      process(item, index);
    });
  `)

      assert(!result.modified, "skip forEach with index parameter")
    })

    test("with array parameter", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach((item, index, array) => {
      process(item, index, array);
    });
  `)

      assert(!result.modified, "skip forEach with array parameter")
    })

    test("non-inline callback", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach(handleItem);
  `)

      assert(!result.modified, "skip forEach with non-inline callback")
    })

    test("without callback", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach();
  `)

      assert(!result.modified, "skip forEach without callback")
    })

    test("unknown methods", () => {
      const result = transform(`
    document.querySomething('.item').forEach(item => {
      process(item);
    });
  `)

      assert(!result.modified, "skip unknown methods")
    })

    test("non-document objects with querySelectorAll", () => {
      const result = transform(`
    myObject.querySelectorAll('.item').forEach(item => {
      process(item);
    });
  `)

      assert(!result.modified, "skip non-document objects with querySelectorAll")
    })

    test("window methods not in allowed list", () => {
      const result = transform(`
    window.querySelectorAll('.item').forEach(item => {
      process(item);
    });
  `)

      // window should be transformed to globalThis, but forEach should not be transformed
      assert(result.modified, "transform window to globalThis")
      assert.match(result.code, /globalThis\.querySelectorAll/)
    })

    test("with function expression", () => {
      const result = transform(`
    document.querySelectorAll('button').forEach(function(btn) {
      btn.disabled = true;
    });
  `)

      assert(result.modified, "transform with function expression")
      assert.match(
        result.code,
        /for \(const btn of document\.querySelectorAll\(['"]button['"]\)\)/,
      )
    })

    test("tracks line numbers", () => {
      const result = transform(`// Line 1
document.querySelectorAll('.item').forEach(item => {
  process(item);
});`)

      assert(result.modified, "tracks line numbers")
    })

    test("complex selector strings", () => {
      const result = transform(`
    document.querySelectorAll('[data-toggle="modal"]').forEach(el => {
      el.addEventListener('click', handleClick);
    });
  `)

      assert(result.modified, "transform with complex selector strings")
      assert.match(
        result.code,
        /for \(const el of document\.querySelectorAll\(['"]\[data-toggle="modal"\]['"]\)\)/,
      )
    })

    test("preserves multiline function bodies", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach(item => {
      const value = item.value;
      process(value);
      item.classList.add('processed');
    });
  `)

      assert(result.modified, "transform and preserve multiline function bodies")
      assert.match(result.code, /for \(const item of/)
      assert.match(result.code, /const value = item\.value/)
      assert.match(result.code, /process\(value\)/)
      assert.match(result.code, /item\.classList\.add/)
    })

    test("element variables with getElementsByTagName", () => {
      const result = transform(`
    container.getElementsByTagName('input').forEach(input => {
      input.value = '';
    });
  `)

      assert(!result.modified, "skip element variables with getElementsByTagName")
    })

    test("element variables with getElementsByClassName", () => {
      const result = transform(`
    section.getElementsByClassName('warning').forEach(warning => {
      warning.style.display = 'none';
    });
  `)

      assert(!result.modified, "skip element variables with getElementsByClassName")
    })

    test("window.querySelectorAll not in allowed", () => {
      const result = transform(`
    window.querySelectorAll('.item').forEach(item => {
      process(item);
    });
  `)

      // window should be transformed to globalThis, but forEach should not be transformed
      assert(result.modified, "transform window to globalThis")
      assert.match(result.code, /globalThis\.querySelectorAll/)
    })

    test("property access on unknown objects", () => {
      const result = transform(`
    customObject.frames.forEach(frame => {
      frame.postMessage('test', '*');
    });
  `)

      assert(!result.modified, "skip property access on unknown objects")
    })

    test("object not a member expression", () => {
      const result = transform(`
    items.forEach(item => {
      process(item);
    });
  `)

      assert(!result.modified, "skip when forEach object is not a member expression")
    })

    test("method name computed property", () => {
      const result = transform(`
    document['querySelectorAll']('.item').forEach(item => {
      process(item);
    });
  `)

      assert(!result.modified, "skip when method name is computed")
    })

    test("unknown document methods", () => {
      const result = transform(`
    document.customMethod().forEach(item => {
      process(item);
    });
  `)

      assert(!result.modified, "skip unknown document methods")
    })

    test("chained call from non-document origin", () => {
      const result = transform(`
    element.querySelector('div').querySelectorAll('span').forEach(span => {
      span.remove();
    });
  `)

      assert(!result.modified, "skip chained call from non-document origin")
    })

    test("chained call with unknown method", () => {
      const result = transform(`
    document.getElementById('x').customMethod().forEach(item => {
      process(item);
    });
  `)

      assert(!result.modified, "skip chained call with unknown method")
    })

    test("caller neither identifier nor member/call expression", () => {
      const result = transform(`
    (() => { return document; })().querySelectorAll('.item').forEach(item => {
      process(item);
    });
  `)

      assert(!result.modified, "skip when caller is a function expression")
    })

    test("caller is ThisExpression", () => {
      const result = transform(`
    this.querySelectorAll('.item').forEach(item => {
      process(item);
    });
  `)

      assert(!result.modified, "skip when caller is this")
    })

    test("object neither MemberExpression nor CallExpression", () => {
      const result = transform(`
    items.forEach(item => {
      process(item);
    });
  `)

      assert(!result.modified, "skip when forEach object is just an identifier")
    })

    test("deeply nested document chain", () => {
      const result = transform(`
    document.getElementById('a').querySelector('b').querySelectorAll('c').forEach(item => {
      item.remove();
    });
  `)

      assert(result.modified, "transform deeply nested document chain")
      assert.match(
        result.code,
        /for \(const item of document\.getElementById\(['"]a['"]\)\.querySelector\(['"]b['"]\)\.querySelectorAll\(['"]c['"]\)\)/,
      )
    })

    test("callerObject is complex expression", () => {
      const result = transform(`
    (1 + 2).querySelectorAll('.item').forEach(item => {
      process(item);
    });
  `)

      assert(!result.modified, "skip when callerObject is a binary expression")
    })

    test("CallExpression with non-MemberExpression callee", () => {
      const result = transform(`
    getElements().forEach(item => {
      process(item);
    });
  `)

      assert(
        !result.modified,
        "skip when forEach object is CallExpression with Identifier callee",
      )
      assert.match(result.code, /getElements\(\)\.forEach/)
    })

    test("chain starts with function call", () => {
      const result = transform(`
    getDocument().querySelectorAll('span').forEach(item => {
      item.textContent = 'test';
    });
  `)

      assert(!result.modified, "skip when chain starts with function call")
    })

    test("document property access with querySelectorAll", () => {
      const result = transform(`
    document.body.querySelectorAll('div').forEach(div => {
      div.remove();
    });
  `)

      assert(
        result.modified,
        "transform document property access with querySelectorAll",
      )
      assert.match(result.code, /for \(const div of document\.body\.querySelectorAll/)
    })
  })

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

  describe("namedArrowFunctionToNamedFunction", () => {
    test("arrow function with generic type parameters", () => {
      const result = transform(`const identity = <T>(value: T): T => value`)

      assert(result.modified, "transform arrow function with generics")
      assert.match(result.code, /function identity<T>\(value: T\): T/)
      assert.match(result.code, /return value/)
    })

    test("arrow function with multiple generic type parameters", () => {
      const result = transform(
        `const merge = <T, U>(a: T, b: U): T & U => ({ ...a, ...b })`,
      )

      assert(result.modified, "transform arrow function with multiple generics")
      assert.match(result.code, /function merge<T, U>\(a: T, b: U\): T & U/)
    })

    test("arrow function with constrained generic type parameters", () => {
      const result = transform(
        `const process = <T extends string>(value: T): T => { return value; }`,
      )

      assert(result.modified, "transform arrow function with constrained generics")
      assert.match(result.code, /function process<T extends string>\(value: T\): T/)
    })

    test("arrow function with default generic type parameters", () => {
      const result = transform(
        `const create = <T = string>(value?: T): T | undefined => value`,
      )

      assert(result.modified, "transform arrow function with default generics")
      assert.match(
        result.code,
        /function create<T = string>\(value\?: T\): T \| undefined/,
      )
    })

    test("exported arrow function with generics", () => {
      const result = transform(
        `export const useHook = <T extends object>(props: T) => { return props; }`,
      )

      assert(result.modified, "transform exported arrow function with generics")
      assert.match(result.code, /export function useHook<T extends object>\(props: T\)/)
    })

    test("arrow function with complex generic constraints", () => {
      const result = transform(
        `const manager = <TForm extends BaseForm<TAccount>, TAccount = unknown>(params: TForm): void => {}`,
      )

      assert(
        result.modified,
        "transform arrow function with complex generic constraints",
      )
      assert.match(
        result.code,
        /function manager<TForm extends BaseForm<TAccount>, TAccount = unknown>\(params: TForm\): void/,
      )
    })

    test("simple const arrow function", () => {
      const result = transform(`const myFunc = () => {}`)

      assert(result.modified, "transform const arrow function to function declaration")
      assert.match(result.code, /function myFunc\(\)/)
      assert.doesNotMatch(result.code, /const myFunc/)
    })

    test("arrow function with parameters", () => {
      const result = transform(`const add = (a, b) => { return a + b; }`)

      assert(result.modified, "transform arrow function with parameters")
      assert.match(result.code, /function add\(a, b\)/)
      assert.match(result.code, /return a \+ b/)
    })

    test("arrow function with expression body", () => {
      const result = transform(`const double = x => x * 2`)

      assert(result.modified, "transform arrow function with expression body")
      assert.match(result.code, /function double\(x\)/)
      assert.match(result.code, /return x \* 2/)
    })

    test("arrow function with no parameters", () => {
      const result = transform(`const getValue = () => 42`)

      assert(result.modified, "transform arrow function with no parameters")
      assert.match(result.code, /function getValue\(\)/)
      assert.match(result.code, /return 42/)
    })

    test("async arrow function", () => {
      const result = transform(
        `const fetchData = async () => { return await getData(); }`,
      )

      assert(result.modified, "transform async arrow function")
      assert.match(result.code, /async function fetchData\(\)/)
      assert.match(result.code, /return await getData\(\)/)
    })

    test("let arrow function", () => {
      const result = transform(`let myFunc = () => { console.log('test'); }`)

      assert(result.modified, "transform let arrow function")
      assert.match(result.code, /function myFunc\(\)/)
      assert.match(result.code, /console\.info\('test'\)/)
    })

    test("skip arrow function using this", () => {
      const result = transform(`const method = () => { return this.value; }`)

      assert(!result.modified, "skip arrow function using this")
    })

    test("skip arrow function in callback", () => {
      const result = transform(`items.map(item => item * 2)`)

      assert(!result.modified, "skip arrow function in callback position")
    })

    test("skip multiple declarators", () => {
      const result = transform(`const a = () => {}, b = () => {}`)

      assert(!result.modified, "skip variable declaration with multiple declarators")
    })

    test("skip destructuring assignment", () => {
      const result = transform(`const { func } = obj`)

      assert(!result.modified, "skip destructuring assignment")
    })

    test("skip var declarations", () => {
      const result = transform(`var myFunc = () => {}`)

      // var gets transformed to const, then const arrow gets transformed to function
      assert(result.modified, "transform var to const to function")
      assert.match(result.code, /function myFunc\(\)/)
    })

    test("arrow function with multiple statements", () => {
      const result = transform(`
    const process = (data) => {
      const result = data * 2;
      console.log(result);
      return result;
    }
  `)

      assert(result.modified, "transform arrow function with multiple statements")
      assert.match(result.code, /function process\(data\)/)
      assert.match(result.code, /const result = data \* 2/)
      assert.match(result.code, /console\.info\(result\)/)
    })

    test("arrow function with rest parameters", () => {
      const result = transform(
        `const sum = (...args) => args.reduce((a, b) => a + b, 0)`,
      )

      assert(result.modified, "transform arrow function with rest parameters")
      assert.match(result.code, /function sum\(\.\.\.args\)/)
      assert.match(result.code, /return args\.reduce/)
    })

    test("arrow function with default parameters", () => {
      const result = transform(
        `const greet = (name = 'World') => { return 'Hello ' + name; }`,
      )

      assert(result.modified, "transform arrow function with default parameters")
      assert.match(result.code, /function greet\(name = 'World'\)/)
      // String concatenation gets transformed to template literal
      assert.match(result.code, /return `Hello \$\{name\}`/)
    })

    test("nested arrow functions are all transformed", () => {
      const result = transform(
        `const outer = () => { const inner = () => {}; return inner; }`,
      )

      assert(result.modified, "transform both outer and inner arrow functions")
      assert.match(result.code, /function outer\(\)/)
      // Inner also gets transformed since it's a const declaration
      assert.match(result.code, /function inner\(\)/)
    })

    test("arrow function with array pattern parameter", () => {
      const result = transform(`const sum = ([a, b]) => a + b`)

      assert(result.modified, "transform arrow function with array pattern parameter")
      assert.match(result.code, /function sum\(\[a, b\]\)/)
      assert.match(result.code, /return a \+ b/)
    })

    test("arrow function with object pattern parameter", () => {
      const result = transform(`const getName = ({ name }) => name`)

      assert(result.modified, "transform arrow function with object pattern parameter")
      assert.match(result.code, /function getName\(\{ name \}\)/)
      assert.match(result.code, /return name/)
    })

    test("skip arrow function with variable type annotation and no function return type", () => {
      const result = transform(
        `const Template: StoryFn<MyType> = () => { return <div>Hello</div>; }`,
      )

      assert(
        !result.modified,
        "skip arrow function with variable type and no function return type",
      )
      assert.match(result.code, /const Template: StoryFn<MyType> = \(\) =>/)
    })

    test("skip function expression with variable type annotation and no function return type", () => {
      const result = transform(
        `const handler: EventHandler = function() { return true; }`,
      )

      assert(
        !result.modified,
        "skip function expression with variable type and no function return type",
      )
      assert.match(result.code, /const handler: EventHandler = function\(\)/)
    })

    test("transform function with return type annotation", () => {
      const result = transform(
        `let myAdd = function (x: number, y: number): number { return x + y; }`,
      )

      assert(result.modified, "transform function with return type annotation")
      assert.match(result.code, /function myAdd\(x: number, y: number\): number/)
      assert.match(result.code, /return x \+ y/)
    })

    test("transform arrow function with return type annotation", () => {
      const result = transform(
        `const myFunc = (x: number): string => { return x.toString(); }`,
      )

      assert(result.modified, "transform arrow function with return type")
      assert.match(result.code, /function myFunc\(x: number\): string/)
    })

    test("transform arrow function with variable and function return types", () => {
      const result = transform(`const myFunc: MyType = (x: number): number => x * 2`)

      assert(
        result.modified,
        "transform when function has return type even with variable type",
      )
      assert.match(result.code, /function myFunc\(x: number\): number/)
      assert.match(result.code, /return x \* 2/)
    })

    test("transform function expression with parameter types only", () => {
      const result = transform(
        `const add = function(a: number, b: number) { return a + b; }`,
      )

      assert(result.modified, "transform function with parameter types")
      assert.match(result.code, /function add\(a: number, b: number\)/)
    })

    test("preserve leading line comment", () => {
      const result = transform(
        `// This is a comment\nconst myFunc = () => { return 42; }`,
      )

      assert(result.modified, "transform arrow function")
      assert.match(result.code, /\/\/ This is a comment/)
      assert.match(result.code, /function myFunc\(\)/)
    })

    test("preserve JSDoc comment", () => {
      const result = transform(
        `/**\n * JSDoc comment\n */\nconst greet = function(name) { return "Hello"; }`,
      )

      assert(result.modified, "transform function expression")
      assert.match(result.code, /\/\*\*/)
      assert.match(result.code, /\* JSDoc comment/)
      assert.match(result.code, /\*\//)
      assert.match(result.code, /function greet\(name\)/)
    })

    test("preserve multiple leading comments", () => {
      const result = transform(
        `// Comment 1\n// Comment 2\nconst add = (a, b) => a + b`,
      )

      assert(result.modified, "transform arrow function")
      assert.match(result.code, /\/\/ Comment 1/)
      assert.match(result.code, /\/\/ Comment 2/)
      assert.match(result.code, /function add\(a, b\)/)
    })

    test("preserve block comment", () => {
      const result = transform(`/* Block comment */\nconst multiply = (x, y) => x * y`)

      assert(result.modified, "transform arrow function")
      assert.match(result.code, /\/\* Block comment \*\//)
      assert.match(result.code, /function multiply\(x, y\)/)
    })

    test("preserve trailing comment", () => {
      const result = transform(`const getValue = () => 42 // trailing comment`)

      assert(result.modified, "transform arrow function")
      assert.match(result.code, /function getValue\(\)/)
      assert.match(result.code, /return 42/)
      assert.match(result.code, /\/\/ trailing comment/)
    })
  })

  describe("arrayConcatToSpread", () => {
    test("[].concat(other)", () => {
      const result = transform(`const result = [1, 2].concat(other);`)

      assert(result.modified, "transform [].concat(other)")
      assert.match(result.code, /\[\.\..\[1, 2\], \.\.\.other\]/)
    })

    test("[].concat([1, 2, 3])", () => {
      const result = transform(`const result = [].concat([1, 2, 3]);`)

      assert(result.modified, "transform [].concat() with array literal")
      assert.match(result.code, /\[\.\..\[\], \.\.\.\[1, 2, 3\]\]/)
    })

    test("[].concat(item1, item2, item3)", () => {
      const result = transform(`const result = [].concat(other1, other2, other3);`)

      assert(result.modified, "transform [].concat() with multiple arguments")
      assert.match(
        result.code,
        /\[\.\..\[\], \.\.\.other1, \.\.\.other2, \.\.\.other3\]/,
      )
    })

    test("in expression", () => {
      const result = transform(`const length = [].concat(other).length;`)

      assert(result.modified, "transform concat in expression")
      assert.match(result.code, /\[\.\..\[\], \.\.\.other\]\.length/)
    })

    test("with method call result", () => {
      const result = transform(`const result = [].concat(getItems());`)

      assert(result.modified, "transform concat with method call result")
      assert.match(result.code, /\[\.\..\[\], \.\.\.getItems\(\)\]/)
    })

    test("no arguments", () => {
      const result = transform(`const copy = arr.concat();`)

      assert(!result.modified, "skip concat with no arguments")
    })
    test("in arrow function", () => {
      const result = transform(`const fn = (arr, other) => [1, 2].concat(other);`)

      assert(result.modified, "transform concat in arrow function")
      assert.match(result.code, /\[\.\..\[1, 2\], \.\.\.other\]/)
    })

    test("nested array", () => {
      const result = transform(`const result = [[1, 2]].concat([[3, 4]]);`)

      assert(result.modified, "transform nested array with concat")
      assert.match(result.code, /\[\.\..\[\[1, 2\]\], \.\.\.\[\[3, 4\]\]\]/)
    })

    test("string.concat()", () => {
      const result = transform(`const result = str.concat("hello");`)

      assert(!result.modified, "skip string.concat()")
    })

    test("unknown identifier", () => {
      const result = transform(`const result = arr.concat(other);`)

      assert(!result.modified, "skip concat on unknown identifier")
    })

    test("array literal", () => {
      const result = transform(`const result = [1, 2, 3].concat([4, 5, 6]);`)

      assert(result.modified, "transform concat on array literal")
      assert.match(result.code, /\[\.\..\[1, 2, 3\], \.\.\.\[4, 5, 6\]\]/)
    })

    test("Array.from()", () => {
      const result = transform(`const result = Array.from(items).concat(more);`)

      assert(result.modified, "transform concat on Array.from()")
      assert.match(result.code, /\[\.\..\[\.\.\.items\], \.\.\.more\]/)
    })

    test("String.slice() result", () => {
      const result = transform(
        `const result = "lorem ipsum".slice(0, 10).concat(more);`,
      )

      assert(result.modified, "transform concat on String.slice() result")
      assert.match(result.code, /\[\.\.\."lorem ipsum"\.slice\(0, 10\), \.\.\.more\]/)
    })

    test("String.split() result", () => {
      const result = transform(`const result = "foo,bar".split(',').concat(more);`)

      assert(result.modified, "transform concat on String.split() result")
      assert.match(result.code, /\[\.\.\."foo,bar"\.split\(','\), \.\.\.more\]/)
    })

    test("new Array()", () => {
      const result = transform(`const result = new Array(5).concat(more);`)

      assert(result.modified, "transform concat on new Array()")
      assert.match(result.code, /\[\.\.\.new Array\(5\), \.\.\.more\]/)
    })
  })

  describe("arraySliceToSpread", () => {
    test("arr.slice(0) - should not transform unknown identifier", () => {
      const result = transform(`const copy = arr.slice(0);`)

      assert(!result.modified, "skip arr.slice(0) on unknown identifier")
    })

    test("arr.slice() - should not transform unknown identifier", () => {
      const result = transform(`const copy = arr.slice();`)

      assert(!result.modified, "skip arr.slice() on unknown identifier")
    })

    test("array literal.slice(0)", () => {
      const result = transform(`const copy = [1, 2, 3].slice(0);`)

      assert(result.modified, "transform array literal.slice(0)")
      assert.match(result.code, /const copy = \[\.\..\[1, 2, 3\]\]/)
    })

    test("array literal.slice()", () => {
      const result = transform(`const copy = [1, 2, 3].slice();`)

      assert(result.modified, "transform array literal.slice()")
      assert.match(result.code, /const copy = \[\.\..\[1, 2, 3\]\]/)
    })

    test("arr.map().slice(0) - should not transform unknown chain", () => {
      const result = transform(`const copy = arr.map(x => x * 2).slice(0);`)

      assert(!result.modified, "skip slice on unknown method chain")
    })

    test("arr.filter().slice() - should not transform unknown chain", () => {
      const result = transform(`const copy = items.filter(x => x > 5).slice();`)

      assert(!result.modified, "skip slice on unknown method chain")
    })

    test("Array.from().slice(0)", () => {
      const result = transform(`const copy = Array.from(iterable).slice(0);`)

      assert(result.modified, "transform slice on Array.from()")
      // Note: Array.from() is transformed first to [...iterable], then .slice(0) transforms that
      assert.match(result.code, /const copy = \[\.\..\[\.\.\.iterable\]\]/)
    })

    test("new Array().slice()", () => {
      const result = transform(`const copy = new Array(5).slice();`)

      assert(result.modified, "transform slice on new Array()")
      assert.match(result.code, /const copy = \[\.\.\.new Array\(5\)\]/)
    })

    test("string literal split.slice(0)", () => {
      const result = transform(`const copy = "a,b,c".split(',').slice(0);`)

      assert(result.modified, "transform slice on string split result")
      assert.match(result.code, /const copy = \[\.\.\./)
      assert.match(result.code, /split\(','\)\]/)
    })

    test("arr.slice(1) - should not transform", () => {
      const result = transform(`const rest = arr.slice(1);`)

      assert(!result.modified, "skip arr.slice(1)")
    })

    test("arr.slice(0, 5) - should not transform", () => {
      const result = transform(`const partial = arr.slice(0, 5);`)

      assert(!result.modified, "skip arr.slice(0, 5)")
    })

    test("arr.slice(1, 3) - should not transform", () => {
      const result = transform(`const partial = arr.slice(1, 3);`)

      assert(!result.modified, "skip arr.slice(1, 3)")
    })

    test("string.slice(0) - should not transform", () => {
      const result = transform(`const copy = str.slice(0);`)

      assert(!result.modified, "skip string.slice(0)")
    })

    test("chained array methods with slice - should not transform", () => {
      const result = transform(
        `const result = arr.map(x => x * 2).filter(x => x > 5).slice(0);`,
      )

      assert(!result.modified, "skip slice on unknown method chain")
    })

    test("slice in arrow function - transforms arrow to function", () => {
      const result = transform(`const fn = arr => arr.map(x => x).slice(0);`)

      assert(result.modified, "transform arrow function to named function")
      assert.match(result.code, /function fn\(arr\)/)
      // slice(0) on method chain is not transformed
      assert.match(result.code, /arr\.map\(x => x\)\.slice\(0\)/)
    })

    test("multiple slice calls", () => {
      const result = transform(`const a = [1,2].slice(), b = [3,4].slice(0);`)

      assert(result.modified, "transform multiple slices")
      assert.match(result.code, /const a = \[\.\..\[1, ?2\]\]/)
      assert.match(result.code, /b = \[\.\..\[3, ?4\]\]/)
    })
  })

  describe("general", () => {
    const input = `var x = 1;`

    test("baseline widely-available", () => {
      const result = transform(input)

      assert(result.modified, "transform with baseline widely-available")
      assert.match(result.code, /const x = 1/)
    })

    test("baseline newly-available", () => {
      const result = transform(input, "newly-available")

      assert(result.modified, "transform with baseline newly-available")
      assert.match(result.code, /const x = 1/)
    })

    test("no changes", () => {
      const result = transform(`
    const x = 1;
    const y = 2;
  `)

      assert(!result.modified, "no changes needed")
    })

    test("complex transformation", () => {
      const result = transform(`
    var userName = 'Alice';
    var greeting = 'Hello ' + userName;
  `)

      assert(result.modified, "perform complex transformation")
      assert.match(result.code, /const userName/)
      assert.match(result.code, /`Hello \$\{userName\}`/)
    })
  })

  describe("constructorToClass", () => {
    test("simple constructor with prototype methods", () => {
      const result = transform(`
function Person(name) {
  this.name = name;
}

Person.prototype.greet = function() {
  return 'Hello, ' + this.name;
};
      `)

      assert(result.modified, "transform constructor to class")
      assert.match(result.code, /class Person/)
      assert.match(result.code, /constructor\(name\)/)
      assert.match(result.code, /greet\(\)/)
    })

    test("keep comments", () => {
      const result = transform(`
// Person
function Person(name) {
  this.name = name;
}

Person.prototype.greet = function() {
  return 'Hello, ' + this.name;
};
      `)

      assert.match(result.code, /\/\/ Person/)
    })

    test("keep jsdocs", () => {
      const result = transform(`
/**
  * Person
  *
  * @argument {string} name - The name of the person
  */
function Person(name) {
  this.name = name;
}

Person.prototype.greet = function() {
  return 'Hello, ' + this.name;
};
      `)

      assert.match(result.code, /@argument \{string} name - The name of the person/)
    })

    test("constructor with multiple prototype methods", () => {
      const result = transform(`
function Animal(type) {
  this.type = type;
}

Animal.prototype.speak = function() {
  return this.type + ' makes a sound';
};

Animal.prototype.move = function() {
  return this.type + ' is moving';
};
      `)

      assert(result.modified, "transform constructor with multiple methods")
      assert.match(result.code, /class Animal/)
      assert.match(result.code, /speak\(\)/)
      assert.match(result.code, /move\(\)/)
    })

    test("skip lowercase function names", () => {
      const result = transform(`
function helper(value) {
  this.value = value;
}

helper.prototype.process = function() {
  return this.value * 2;
};
      `)

      assert(!result.modified, "skip lowercase function names")
    })

    test("skip constructor without prototype methods", () => {
      const result = transform(`
function Person(name) {
  this.name = name;
}
      `)

      assert(!result.modified, "skip constructor without prototype methods")
    })

    test("transform safe arrow functions on prototype", () => {
      const result = transform(`
function Person(name) {
  this.name = name;
}

Person.prototype.greet = () => {
  return 'Hello';
};
      `)

      assert(result.modified, "transform safe arrow functions on prototype")
      assert.match(result.code, /class Person/)
      assert.match(result.code, /greet\(\)/)
      assert.match(result.code, /return 'Hello'/)
    })

    test("skip arrow functions with 'this' on prototype", () => {
      const result = transform(`
function Person(name) {
  this.name = name;
}

Person.prototype.greet = () => {
  return this.name;
};
      `)

      assert(!result.modified, "skip arrow functions with 'this' on prototype")
    })

    test("transform arrow function with expression body on prototype", () => {
      const result = transform(`
function Foo() {
  this.name = "Klass";
}

Foo.prototype.getName = () => "foot";
      `)

      assert(result.modified, "transform arrow function with expression body")
      assert.match(result.code, /class Foo/)
      assert.match(result.code, /getName\(\)/)
      assert.match(result.code, /return "foot"/)
    })

    test("transform mixed function and arrow functions on prototype", () => {
      const result = transform(`
function Person(name) {
  this.name = name;
}

Person.prototype.greet = function() {
  return 'Hello, ' + this.name;
};

Person.prototype.getType = () => {
  return 'Person';
};
      `)

      assert(result.modified, "transform mixed functions")
      assert.match(result.code, /class Person/)
      assert.match(result.code, /greet\(\)/)
      assert.match(result.code, /getType\(\)/)
      assert.match(result.code, /return 'Person'/)
    })

    test("transform async arrow function on prototype", () => {
      const result = transform(`
function Fetcher() {
  this.url = "api.example.com";
}

Fetcher.prototype.fetch = async () => {
  return "data";
};
      `)

      assert(result.modified, "transform async arrow function")
      assert.match(result.code, /class Fetcher/)
      assert.match(result.code, /async fetch\(\)/)
      assert.match(result.code, /return "data"/)
    })

    test("constructor with no parameters", () => {
      const result = transform(`
function Counter() {
  this.count = 0;
}

Counter.prototype.increment = function() {
  this.count++;
};
      `)

      assert(result.modified, "transform constructor with no parameters")
      assert.match(result.code, /class Counter/)
      assert.match(result.code, /constructor\(\)/)
      assert.match(result.code, /increment\(\)/)
    })

    test("transform constructor with variable declarations in body", () => {
      const result = transform(`
function Person(name) {
  this.name = name;
  const temp = processName(name);
  this.processed = temp;
}

Person.prototype.greet = function() {
  return 'Hello, I am ' + this.name;
};
      `)

      // The constructor can be safely transformed even with variable declarations
      assert.match(result.code, /class Person/)
      assert.match(result.code, /constructor\(name\)/)
      assert.match(result.code, /greet\(\)/)
    })

    test("constructor with expression body statements", () => {
      const result = transform(`
function Person(name, age) {
  this.name = name;
  this.age = age;
}

Person.prototype.greet = function() {
  return 'Hello, ' + this.name;
};

Person.prototype.getAge = function() {
  return this.age;
};
      `)

      assert(result.modified, "transform constructor with multiple properties")
      assert.match(result.code, /class Person/)
      assert.match(result.code, /constructor\(name, age\)/)
    })

    test("skip factory pattern with return statement", () => {
      const result = transform(`
function Something() {
  var depth = 0;
  return {
    incDepth: function() {
      depth++;
    }
  };
}

foo = Something();
      `)

      // Factory pattern should not be transformed to a class
      assert.match(result.code, /function Something/)
      assert.doesNotMatch(result.code, /class Something/)
    })

    test("skip constructor with return statement", () => {
      const result = transform(`
function Factory(config) {
  this.config = config;
  return this.config;
}

Factory.prototype.process = function() {
  return this.config;
};
      `)

      // Constructor with return statement should not be transformed
      assert.match(result.code, /function Factory/)
      assert.doesNotMatch(result.code, /class Factory/)
    })

    test("transform function expression with method call in constructor", () => {
      const result = transform(`
var SomeClass = function (selector) {
  this.element = document.querySelector(selector);
  this.init();
};

SomeClass.prototype = {
  init: function () {
    process('init');
  }
};
      `)

      // Constructor with method call is still a simple constructor and should be transformed
      assert(result.modified, "transform constructor with method call")
      assert.match(result.code, /class SomeClass/)
      assert.match(result.code, /constructor\(selector\)/)
      assert.match(result.code, /init\(\)/)
    })

    test("skip prototype assignment with non-function methods", () => {
      const result = transform(`
function Widget(id) {
  this.id = id;
}

Widget.prototype = {
  value: 42
};
      `)

      assert(!result.modified, "skip prototype object without function expressions")
    })

    test("transform prototype assignment with safe arrow function methods", () => {
      const result = transform(`
function Component(props) {
  this.props = props;
}

Component.prototype = {
  render: () => {
    return null;
  }
};
      `)

      assert(result.modified, "transform prototype object with safe arrow functions")
      assert.match(result.code, /class Component/)
      assert.match(result.code, /render\(\)/)
    })

    test("skip prototype assignment with arrow functions that use 'this'", () => {
      const result = transform(`
function Component(props) {
  this.props = props;
}

Component.prototype = {
  render: () => {
    return this.props;
  }
};
      `)

      assert(!result.modified, "skip prototype object with unsafe arrow functions")
    })

    test("transform prototype assignment with mixed safe arrow and function expressions", () => {
      const result = transform(`
function Bar() {
  this.name = "Klass";
}

Bar.prototype = {
  getName: function() {
    return "bar";
  },
  getBaz: () => {
    return "baz";
  },
}
      `)

      assert(result.modified, "transform mixed prototype object")
      assert.match(result.code, /class Bar/)
      assert.match(result.code, /getName\(\)/)
      assert.match(result.code, /getBaz\(\)/)
      assert.match(result.code, /return "baz"/)
    })

    test("skip prototype assignment with getter/setter properties", () => {
      const result = transform(`
function Model(name) {
  this.name = name;
}

Model.prototype = {
  get value() {
    return this.name;
  }
};
      `)

      assert(!result.modified, "skip prototype object with getter properties")
    })

    test("skip prototype assignment with computed properties", () => {
      const result = transform(`
function Handler(type) {
  this.type = type;
}

Handler.prototype = {
  [Symbol.toStringTag]: function() {
    return this.type;
  }
};
      `)

      assert(!result.modified, "skip prototype object with computed properties")
    })

    test("skip constructor with complex body statements", () => {
      const result = transform(`
function Service(config) {
  if (config) {
    this.config = config;
  }
}

Service.prototype.init = function() {
  return this.config;
};
      `)

      assert.match(result.code, /class Service/)
    })

    test("skip prototype method assignment with non-function value", () => {
      const result = transform(`
function Manager(id) {
  this.id = id;
}

Manager.prototype.defaultValue = 10;
      `)

      assert(!result.modified, "skip prototype with non-function assignment")
    })

    test("variable declaration constructor with generator method", () => {
      const result = transform(`
var Generator = function(data) {
  this.data = data;
}

Generator.prototype.process = function*() {
  yield this.data;
};
      `)

      assert(result.modified, "transform constructor with generator method")
      assert.match(result.code, /class Generator/)
      assert.match(result.code, /\*process/)
    })

    test("skip pattern 2 assignment with non-object value", () => {
      const result = transform(`
function Parser(input) {
  this.input = input;
}

Parser.prototype = null;
      `)

      assert(!result.modified, "skip prototype assignment to non-object")
    })

    test("constructor with block statement in body", () => {
      const result = transform(`
function Strict(mode) {
  'use strict';
  this.mode = mode;
}

Strict.prototype.check = function() {
  return this.mode;
};
      `)

      assert(result.modified, "transform constructor with directive")
      assert.match(result.code, /class Strict/)
    })

    test("variable declaration constructor with prototype methods", () => {
      const result = transform(`
var Calculator = function(value) {
  this.value = value;
}

Calculator.prototype.add = function(num) {
  return this.value + num;
};
      `)

      assert(result.modified, "transform variable declaration constructor")
      assert.match(result.code, /class Calculator/)
    })

    test("skip constructor with throw statement in body", () => {
      const result = transform(`
function Validator(value) {
  if (!value) {
    throw new Error('invalid');
  }
  this.value = value;
}

Validator.prototype.validate = function() {
  return this.value;
};
      `)

      assert.match(result.code, /class Validator/)
    })

    test("transform constructor with only assignment statements", () => {
      const result = transform(`
function Iterator(items) {
  this.items = items;
  this.index = 0;
}

Iterator.prototype.next = function() {
  return this.items[this.index++];
};
      `)

      assert(result.modified, "transform constructor with safe body")
      assert.match(result.code, /class Iterator/)
    })

    test("skip constructor with computed property in prototype literal", () => {
      const result = transform(`
function Handler(type) {
  this.type = type;
}

Handler.prototype = {
  [Symbol.toStringTag]: function() {
    return this.type;
  }
};
      `)

      assert(!result.modified, "skip prototype with computed property")
    })

    test("prototype literal with non-identifier properties", () => {
      const result = transform(`
function Component(props) {
  this.props = props;
}

Component.prototype = {
  'method-name': function() {
    return this.props;
  }
};
      `)

      assert(!result.modified, "skip prototype literal with string keys")
    })

    test("constructor with return statement prevents transformation", () => {
      const result = transform(`
function Creator(config) {
  this.config = config;
  if (!config) {
    return;
  }
}

Creator.prototype.start = function() {
  return this.config;
};
      `)

      assert(result.modified, "skip constructor with return")
      assert.match(result.code, /class Creator/)
    })

    test("prototype object with only getter property", () => {
      const result = transform(`
function Box(value) {
  this.value = value;
}

Box.prototype = {
  get size() {
    return this.value * 2;
  }
};
      `)

      assert(!result.modified, "skip constructor when only getter in prototype")
    })

    test("prototype object with getter and function method", () => {
      const result = transform(`
function Box(value) {
  this.value = value;
}

Box.prototype = {
  get size() {
    return this.value * 2;
  },
  getValue: function() {
    return this.value;
  }
};
      `)

      assert(result.modified, "transform constructor ignoring getter property")
      assert.match(result.code, /class Box/)
    })

    test("prototype object with only non-function property", () => {
      const result = transform(`
function Widget(id) {
  this.id = id;
}

Widget.prototype = {
  config: { timeout: 1000 }
};
      `)

      assert(!result.modified, "skip constructor when no function methods")
    })

    test("prototype object with non-function and function properties", () => {
      const result = transform(`
function Widget(id) {
  this.id = id;
}

Widget.prototype = {
  config: { timeout: 1000 },
  getValue: function() {
    return this.id;
  }
};
      `)

      assert(result.modified, "transform constructor ignoring non-function property")
      assert.match(result.code, /class Widget/)
    })

    test("skip var declaration with arrow function", () => {
      const result = transform(`
var Calculator = (value) => {
  this.value = value;
};

Calculator.prototype.add = function(num) {
  return this.value + num;
};
      `)

      assert.doesNotMatch(
        result.code,
        /class Calculator/,
        "skip arrow function constructor",
      )
    })

    test("skip var declaration constructor with complex body", () => {
      const result = transform(`
var Service = function(config) {
  if (config) {
    this.config = config;
  }
};

Service.prototype.init = function() {
  return this.config;
};
      `)

      assert.match(
        result.code,
        /class Service/,
        "skip var declaration with complex body",
      )
    })

    test("var declaration prototype with getter property", () => {
      const result = transform(`
var Box = function(value) {
  this.value = value;
};

Box.prototype = {
  get size() {
    return this.value * 2;
  }
};
      `)

      assert.doesNotMatch(
        result.code,
        /class Box/,
        "skip var declaration with getter prototype",
      )
    })

    test("function declaration constructor with empty body", () => {
      const result = transform(`
function Empty() {}

Empty.prototype.run = function() {
  return this.value;
};
      `)

      assert(result.modified, "transform function declaration with empty body")
      assert.match(result.code, /class Empty/)
    })
  })

  describe("consoleLogToInfo", () => {
    test("simple console.log", () => {
      const result = transform(`console.log('hello');`)

      assert(result.modified, "transform console.log to console.info")
      assert.match(result.code, /console\.info\('hello'\)/)
      assert.doesNotMatch(result.code, /console\.log/)
    })

    test("console.log with multiple arguments", () => {
      const result = transform(`console.log('User:', user, 'ID:', id);`)

      assert(result.modified, "transform console.log with multiple arguments")
      assert.match(result.code, /console\.info\('User:', user, 'ID:', id\)/)
    })

    test("console.log in function body", () => {
      const result = transform(`
function debug(msg) {
  console.log(msg);
}
      `)

      assert(result.modified, "transform console.log in function")
      assert.match(result.code, /console\.info\(msg\)/)
    })

    test("multiple console.log calls", () => {
      const result = transform(`
console.log('start');
doSomething();
console.log('end');
      `)

      assert(result.modified, "transform multiple console.log calls")
      assert.match(result.code, /console\.info\('start'\)/)
      assert.match(result.code, /console\.info\('end'\)/)
      assert.doesNotMatch(result.code, /console\.log/)
    })

    test("console.log with template literals", () => {
      const result = transform("console.log(`Value: ${value}`);")

      assert(result.modified, "transform console.log with template literals")
      assert.match(result.code, /console\.info\(`Value: \$\{value\}`\)/)
    })

    test("console.log with object", () => {
      const result = transform(`console.log({ key: 'value' });`)

      assert(result.modified, "transform console.log with object")
      assert.match(result.code, /console\.info\(\{ key: 'value' \}\)/)
    })

    test("do not transform console.error", () => {
      const result = transform(`console.error('error');`)

      assert(!result.modified, "skip console.error")
    })

    test("do not transform console.warn", () => {
      const result = transform(`console.warn('warning');`)

      assert(!result.modified, "skip console.warn")
    })

    test("do not transform console.info", () => {
      const result = transform(`console.info('info');`)

      assert(!result.modified, "skip console.info (already explicit)")
    })

    test("do not transform console.debug", () => {
      const result = transform(`console.debug('debug');`)

      assert(!result.modified, "skip console.debug")
    })

    test("do not transform other console methods", () => {
      const result = transform(`
console.table(data);
console.trace();
console.assert(condition, 'message');
      `)

      assert(!result.modified, "skip other console methods")
    })

    test("console.log in arrow function", () => {
      const result = transform(`const fn = () => console.log('test');`)

      assert(result.modified, "transform console.log in arrow function")
      assert.match(result.code, /console\.info\('test'\)/)
    })

    test("console.log in nested scope", () => {
      const result = transform(`
if (condition) {
  console.log('true branch');
} else {
  console.log('false branch');
}
      `)

      assert(result.modified, "transform console.log in nested scope")
      assert.match(result.code, /console\.info\('true branch'\)/)
      assert.match(result.code, /console\.info\('false branch'\)/)
    })

    test("console.log with spread operator", () => {
      const result = transform(`console.log(...args);`)

      assert(result.modified, "transform console.log with spread")
      assert.match(result.code, /console\.info\(\.\.\.args\)/)
    })

    test("console.log without arguments", () => {
      const result = transform(`console.log();`)

      assert(result.modified, "transform console.log without arguments")
      assert.match(result.code, /console\.info\(\)/)
    })

    test("do not transform non-console log methods", () => {
      const result = transform(`logger.log('message');`)

      assert(!result.modified, "skip non-console log methods")
    })

    test("do not transform when console is reassigned", () => {
      const result = transform(`
const myConsole = { log: () => {} };
myConsole.log('test');
      `)

      assert(!result.modified, "skip when object is not console")
    })
  })

  describe("removeUseStrictFromModules", () => {
    test("remove 'use strict' from file with import", () => {
      const result = transform(`
'use strict';
import foo from 'bar';
const x = 1;
      `)

      assert(result.modified, "remove use strict from module")
      assert.doesNotMatch(result.code, /'use strict'/)
      assert.match(result.code, /import foo from 'bar'/)
    })

    test("remove 'use strict' from file with export", () => {
      const result = transform(`
"use strict";
export const x = 1;
      `)

      assert(result.modified, "remove use strict from module")
      assert.doesNotMatch(result.code, /"use strict"/)
      assert.match(result.code, /export const x = 1/)
    })

    test("remove 'use strict' from file with both import and export", () => {
      const result = transform(`
'use strict';
import { helper } from './utils';
export function main() {
  return helper();
}
      `)

      assert(result.modified, "remove use strict from module")
      assert.doesNotMatch(result.code, /'use strict'/)
      assert.match(result.code, /import.*helper/)
      assert.match(result.code, /export function main/)
    })

    test("do not remove 'use strict' from non-module file", () => {
      const result = transform(`
'use strict';
const x = 1;
function foo() {
  return x;
}
      `)

      assert(!result.modified, "keep use strict in non-module")
    })

    test("remove 'use strict' with double quotes", () => {
      const result = transform(`
"use strict";
import foo from 'bar';
      `)

      assert(result.modified, "remove use strict with double quotes")
      assert.doesNotMatch(result.code, /"use strict"/)
    })

    test("handle file with multiple statements after use strict", () => {
      const result = transform(`
'use strict';
import { x } from 'module';
const y = 2;
const z = 3;
export { y, z };
      `)

      assert(result.modified, "remove use strict")
      assert.doesNotMatch(result.code, /'use strict'/)
      assert.match(result.code, /import.*x/)
      assert.match(result.code, /const y = 2/)
      assert.match(result.code, /export.*y/)
    })

    test("handle file with export default", () => {
      const result = transform(`
'use strict';
export default class MyClass {
  constructor() {}
}
      `)

      assert(result.modified, "remove use strict from file with export default")
      assert.doesNotMatch(result.code, /'use strict'/)
      assert.match(result.code, /export default class MyClass/)
    })

    test("handle file with export all", () => {
      const result = transform(`
'use strict';
export * from './module';
      `)

      assert(result.modified, "remove use strict from file with export all")
      assert.doesNotMatch(result.code, /'use strict'/)
      assert.match(result.code, /export \* from/)
    })

    test("do not remove use strict from within function", () => {
      const result = transform(`
import foo from 'bar';
function test() {
  'use strict';
  return 1;
}
      `)

      assert(!result.modified, "keep use strict within function")
    })

    test("handle empty module", () => {
      const result = transform(`
'use strict';
export {};
      `)

      assert(result.modified, "remove use strict from empty module")
      assert.doesNotMatch(result.code, /'use strict'/)
    })

    test("remove use strict when followed by non-directive statement", () => {
      const result = transform(`
'use strict';
import foo from 'bar';
const x = 1;
      `)

      assert(result.modified, "remove use strict before non-directive")
      assert.doesNotMatch(result.code, /'use strict'/)
      assert.match(result.code, /import foo from 'bar'/)
      assert.match(result.code, /const x = 1/)
    })

    test("remove multiple use strict directives", () => {
      const result = transform(`
'use strict';
'use strict';
export const x = 1;
      `)

      assert(result.modified, "remove multiple use strict directives")
      assert.doesNotMatch(result.code, /'use strict'/)
      assert.match(result.code, /export const x = 1/)
    })

    test("keep other directives but remove use strict", () => {
      const result = transform(`
'use asm';
'use strict';
import foo from 'bar';
      `)

      assert(result.modified, "remove use strict but keep other directives")
      assert.doesNotMatch(result.code, /'use strict'/)
    })
  })

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

  describe("nullishCoalescingOperator", () => {
    test("basic null and undefined check", () => {
      const result = transform(
        `const value = x !== null && x !== undefined ? x : defaultValue;`,
      )

      assert(result.modified, "transform null/undefined check to ??")
      assert.match(result.code, /const value = x \?\? defaultValue/)
    })

    test("swapped order: undefined and null check", () => {
      const result = transform(
        `const value = x !== undefined && x !== null ? x : defaultValue;`,
      )

      assert(result.modified, "transform undefined/null check to ??")
      assert.match(result.code, /const value = x \?\? defaultValue/)
    })

    test("null on right side of comparison", () => {
      const result = transform(
        `const value = null !== x && undefined !== x ? x : defaultValue;`,
      )

      assert(result.modified, "transform with null/undefined on left")
      assert.match(result.code, /const value = x \?\? defaultValue/)
    })

    test("member expression", () => {
      const result = transform(
        `const value = obj.prop !== null && obj.prop !== undefined ? obj.prop : defaultValue;`,
      )

      assert(result.modified, "transform member expression null/undefined check")
      assert.match(result.code, /const value = obj\.prop \?\? defaultValue/)
    })

    test("nested member expression", () => {
      const result = transform(
        `const value = obj.a.b !== null && obj.a.b !== undefined ? obj.a.b : 0;`,
      )

      assert(result.modified, "transform nested member expression")
      assert.match(result.code, /const value = obj\.a\.b \?\? 0/)
    })

    test("default value is expression", () => {
      const result = transform(
        `const value = x !== null && x !== undefined ? x : getDefault();`,
      )

      assert(result.modified, "transform with expression as default")
      assert.match(result.code, /const value = x \?\? getDefault\(\)/)
    })

    test("default value is literal number", () => {
      const result = transform(
        `const value = count !== null && count !== undefined ? count : 0;`,
      )

      assert(result.modified, "transform with literal number default")
      assert.match(result.code, /const value = count \?\? 0/)
    })

    test("default value is literal string", () => {
      const result = transform(
        `const value = name !== null && name !== undefined ? name : 'unknown';`,
      )

      assert(result.modified, "transform with literal string default")
      assert.match(result.code, /const value = name \?\? 'unknown'/)
    })

    test("should not transform || operator", () => {
      const result = transform(`const value = x || defaultValue;`)

      assert(!result.modified, "skip || operator")
    })

    test("should not transform only null check", () => {
      const result = transform(`const value = x !== null ? x : defaultValue;`)

      assert(!result.modified, "skip only null check")
    })

    test("should not transform only undefined check", () => {
      const result = transform(`const value = x !== undefined ? x : defaultValue;`)

      assert(!result.modified, "skip only undefined check")
    })

    test("should not transform when consequent differs", () => {
      const result = transform(
        `const value = x !== null && x !== undefined ? y : defaultValue;`,
      )

      assert(!result.modified, "skip when consequent is different variable")
    })

    test("should not transform === checks", () => {
      const result = transform(
        `const value = x === null && x === undefined ? x : defaultValue;`,
      )

      assert(!result.modified, "skip === checks (wrong logic)")
    })

    test("should not transform mixed checks", () => {
      const result = transform(
        `const value = x !== null && y !== undefined ? x : defaultValue;`,
      )

      assert(!result.modified, "skip when checking different variables")
    })

    test("computed member expression", () => {
      const result = transform(
        `const value = obj[key] !== null && obj[key] !== undefined ? obj[key] : 0;`,
      )

      assert(result.modified, "transform computed member expression")
      assert.match(result.code, /const value = obj\[key\] \?\? 0/)
    })

    test("multiple transformations in same code", () => {
      const result = transform(`
        const a = x !== null && x !== undefined ? x : 1;
        const b = y !== null && y !== undefined ? y : 2;
      `)

      assert(result.modified, "transform multiple occurrences")
      assert.match(result.code, /const a = x \?\? 1/)
      assert.match(result.code, /const b = y \?\? 2/)
    })

    test("within function call", () => {
      const result = transform(
        `doSomething(value !== null && value !== undefined ? value : 'default');`,
      )

      assert(result.modified, "transform within function call")
      assert.match(result.code, /doSomething\(value \?\? 'default'\)/)
    })

    test("within return statement", () => {
      const result = transform(`
        function getValue(x) {
          return x !== null && x !== undefined ? x : 0;
        }
      `)

      assert(result.modified, "transform within return statement")
      assert.match(result.code, /return x \?\? 0/)
    })

    test("should not transform with === null (wrong operator)", () => {
      const result = transform(
        `const value = x === null && x === undefined ? x : defaultValue;`,
      )

      assert(!result.modified, "skip === checks")
    })

    test("should not transform with mixed operators", () => {
      const result = transform(
        `const value = x !== null && x === undefined ? x : defaultValue;`,
      )

      assert(!result.modified, "skip mixed !== and === checks")
    })

    test("should not transform === null with !== undefined", () => {
      const result = transform(
        `const value = x === null && x !== undefined ? x : defaultValue;`,
      )

      assert(!result.modified, "skip when first is ===")
    })

    test("should not transform swapped order with === operators", () => {
      const result = transform(
        `const value = x === undefined && x === null ? x : defaultValue;`,
      )

      assert(!result.modified, "skip swapped === checks")
    })

    test("should not transform swapped order with only one negated", () => {
      const result = transform(
        `const value = x !== undefined && x === null ? x : defaultValue;`,
      )

      assert(!result.modified, "skip swapped mixed operators")
    })

    test("should not transform when checking different properties", () => {
      const result = transform(
        `const value = obj.a !== null && obj.b !== undefined ? obj.a : defaultValue;`,
      )

      assert(!result.modified, "skip when properties differ")
    })

    test("should not transform with swapped different properties", () => {
      const result = transform(
        `const value = obj.b !== undefined && obj.a !== null ? obj.a : defaultValue;`,
      )

      assert(!result.modified, "skip swapped when properties differ")
    })

    test("should not transform when consequent differs", () => {
      const result = transform(
        `const value = x !== null && x !== undefined ? y : defaultValue;`,
      )

      assert(!result.modified, "skip when consequent is different variable")
    })

    test("should not transform swapped order when consequent differs", () => {
      const result = transform(
        `const value = x !== undefined && x !== null ? y : defaultValue;`,
      )

      assert(!result.modified, "skip swapped when consequent differs")
    })

    test("should not transform non-null/undefined comparisons", () => {
      const result = transform(
        `const value = x !== 0 && x !== false ? x : defaultValue;`,
      )

      assert(!result.modified, "skip non-null/undefined checks")
    })

    test("should not transform with non-binary expression", () => {
      const result = transform(`const value = x && y ? x : defaultValue;`)

      assert(!result.modified, "skip non-binary expressions")
    })

    test("deeply nested member expression with computed properties", () => {
      const result = transform(
        `const value = obj.a[b].c !== null && obj.a[b].c !== undefined ? obj.a[b].c : 0;`,
      )

      assert(result.modified, "transform deeply nested computed member expression")
      assert.match(result.code, /const value = obj\.a\[b\]\.c \?\? 0/)
    })

    test("multiple computed properties", () => {
      const result = transform(
        `const value = obj[a][b] !== null && obj[a][b] !== undefined ? obj[a][b] : 0;`,
      )

      assert(result.modified, "transform multiple computed properties")
      assert.match(result.code, /const value = obj\[a\]\[b\] \?\? 0/)
    })

    test("should not transform computed vs non-computed member expression", () => {
      const result = transform(
        `const value = obj.a !== null && obj[a] !== undefined ? obj.a : 0;`,
      )

      assert(!result.modified, "skip when computed property differs")
    })

    test("should not transform when nested objects differ", () => {
      const result = transform(
        `const value = obj1.prop !== null && obj2.prop !== undefined ? obj1.prop : 0;`,
      )

      assert(!result.modified, "skip when nested objects differ")
    })

    test("should not transform computed vs non-computed for same property name", () => {
      const result = transform(
        `const value = obj.prop !== null && obj[prop] !== undefined ? obj.prop : 0;`,
      )

      assert(!result.modified, "skip when one is computed and one is not")
    })

    test("both computed with same key should transform", () => {
      const result = transform(
        `const value = obj[key] !== null && obj[key] !== undefined ? obj[key] : 0;`,
      )

      assert(result.modified, "transform when both are computed with same key")
      assert.match(result.code, /const value = obj\[key\] \?\? 0/)
    })

    test("triple nested member expression", () => {
      const result = transform(
        `const value = obj.a.b.c !== null && obj.a.b.c !== undefined ? obj.a.b.c : 0;`,
      )

      assert(result.modified, "transform triple nested member expression")
      assert.match(result.code, /const value = obj\.a\.b\.c \?\? 0/)
    })

    test("should not transform with different function callees", () => {
      const result = transform(
        `const value = fn1() !== null && fn2() !== undefined ? fn1() : defaultValue;`,
      )

      assert(!result.modified, "skip when function callees differ")
    })

    test("should not transform with different function argument counts", () => {
      const result = transform(
        `const value = fn(a) !== null && fn(a, b) !== undefined ? fn(a) : defaultValue;`,
      )

      assert(!result.modified, "skip when function argument counts differ")
    })

    test("should not transform with different function argument values", () => {
      const result = transform(
        `const value = fn(a) !== null && fn(b) !== undefined ? fn(a) : defaultValue;`,
      )

      assert(!result.modified, "skip when function argument values differ")
    })
  })

  describe("optionalChaining", () => {
    test("simple property access", () => {
      const result = transform(`const value = obj && obj.prop;`)

      assert(result.modified, "transform obj && obj.prop")
      assert.match(result.code, /const value = obj\?\.prop/)
      assert.doesNotMatch(result.code, /&&/)
    })

    test("nested property access", () => {
      const result = transform(`const value = obj && obj.prop && obj.prop.nested;`)

      assert(result.modified, "transform nested property access")
      assert.match(result.code, /const value = obj\?\.prop\?\.nested/)
      assert.doesNotMatch(result.code, /&&/)
    })

    test("array element access", () => {
      const result = transform(`const value = arr && arr[0];`)

      assert(result.modified, "transform arr && arr[0]")
      assert.match(result.code, /const value = arr\?\.\[0\]/)
      assert.doesNotMatch(result.code, /&&/)
    })

    test("function call", () => {
      const result = transform(`const value = fn && fn();`)

      assert(result.modified, "transform fn && fn()")
      assert.match(result.code, /const value = fn\?\.\(\)/)
      assert.doesNotMatch(result.code, /&&/)
    })

    test("function call with arguments", () => {
      const result = transform(`const result = callback && callback(arg1, arg2);`)

      assert(result.modified, "transform callback && callback(args)")
      assert.match(result.code, /const result = callback\?\.\(arg1, arg2\)/)
    })

    test("deeply nested property access", () => {
      const result = transform(`const value = obj && obj.a && obj.a.b && obj.a.b.c;`)

      assert(result.modified, "transform deeply nested property access")
      assert.match(result.code, /const value = obj\?\.a\?\.b\?\.c/)
      assert.doesNotMatch(result.code, /&&/)
    })

    test("method call with property access", () => {
      const result = transform(`const value = obj && obj.method && obj.method();`)

      assert(result.modified, "transform obj && obj.method && obj.method()")
      assert.match(result.code, /const value = obj\?\.method\?\.\(\)/)
    })

    test("array access with nested property", () => {
      const result = transform(`const value = arr && arr[0] && arr[0].prop;`)

      assert(result.modified, "transform arr && arr[0] && arr[0].prop")
      assert.match(result.code, /const value = arr\?\.\[0\]\?\.prop/)
    })

    test("skip unrelated && expressions", () => {
      const result = transform(`const value = a && b;`)

      assert(!result.modified, "skip unrelated && expressions")
    })

    test("skip mixed conditions", () => {
      const result = transform(`const value = obj && otherObj.prop;`)

      assert(!result.modified, "skip when right side doesn't access left side")
    })

    test("skip when accessing different object", () => {
      const result = transform(`const value = obj && obj.prop && other.nested;`)

      assert(!result.modified, "skip when chain breaks")
    })

    test("property access in expression", () => {
      const result = transform(`doSomething(obj && obj.prop);`)

      assert(result.modified, "transform property access in expression")
      assert.match(result.code, /doSomething\(obj\?\.prop\)/)
    })

    test("multiple transformations in same code", () => {
      const result = transform(`
        const a = obj && obj.prop;
        const b = arr && arr[0];
      `)

      assert(result.modified, "transform multiple occurrences")
      assert.match(result.code, /const a = obj\?\.prop/)
      assert.match(result.code, /const b = arr\?\.\[0\]/)
    })

    test("ternary with optional chaining pattern", () => {
      const result = transform(`const value = (obj && obj.prop) || defaultValue;`)

      assert(result.modified, "transform in ternary pattern")
      assert.match(result.code, /obj\?\.prop/)
    })

    test("skip boolean logic combinations", () => {
      const result = transform(`const value = (a && b) || (c && d);`)

      assert(!result.modified, "skip pure boolean logic")
    })

    test("computed property access", () => {
      const result = transform(`const value = obj && obj[key];`)

      assert(result.modified, "transform computed property access")
      assert.match(result.code, /const value = obj\?\.\[key\]/)
    })

    test("nested computed property access", () => {
      const result = transform(`const value = obj && obj[key] && obj[key].prop;`)

      assert(result.modified, "transform nested computed property access")
      assert.match(result.code, /const value = obj\?\.\[key\]\?\.prop/)
    })

    test("return statement with optional chaining pattern", () => {
      const result = transform(`
        function getValue(obj) {
          return obj && obj.value;
        }
      `)

      assert(result.modified, "transform in return statement")
      assert.match(result.code, /return obj\?\.value/)
    })

    test("skip complex expressions in chain", () => {
      const result = transform(`const value = obj && (obj.a || obj.b);`)

      assert(!result.modified, "skip when right side is not a simple access")
    })

    test("skip complex method chaining", () => {
      const result = transform(`const value = obj && obj.method && obj.method().prop;`)

      assert(!result.modified, "skip when accessing property on method result")
    })

    test("skip when base appears multiple times incorrectly", () => {
      const result = transform(`const value = obj && obj && obj.prop;`)

      assert(!result.modified, "skip duplicate base checks")
    })

    test("skip function calls with different arguments", () => {
      const result = transform(`const value = fn && fn(a) && fn(b);`)

      assert(!result.modified, "skip when function arguments differ")
    })

    test("transform function calls with same arguments", () => {
      const result = transform(`const value = fn && fn(a) && fn(a).prop;`)

      assert(result.modified, "transform when function arguments are same")
      assert.match(result.code, /const value = fn\?\.\(a\)\?\.prop/)
    })

    test("skip function calls with different argument counts", () => {
      const result = transform(`const value = fn && fn(a) && fn(a, b);`)

      assert(!result.modified, "skip when argument counts differ")
    })

    test("transform function calls with multiple same arguments", () => {
      const result = transform(`const value = fn && fn(x, y) && fn(x, y).result;`)

      assert(result.modified, "transform when multiple arguments are same")
      assert.match(result.code, /const value = fn\?\.\(x, y\)\?\.result/)
    })
  })

  describe("indexOfToIncludes", () => {
    describe("array indexOf patterns", () => {
      test("[].indexOf(item) !== -1", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) !== -1;`)

        assert(result.modified, "transform indexOf !== -1")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("[].indexOf(item) > -1", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) > -1;`)

        assert(result.modified, "transform indexOf > -1")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("[].indexOf(item) >= 0", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) >= 0;`)

        assert(result.modified, "transform indexOf >= 0")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 !== [].indexOf(item)", () => {
        const result = transform(`const found = -1 !== [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform -1 !== indexOf")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 < [].indexOf(item)", () => {
        const result = transform(`const found = -1 < [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform -1 < indexOf")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: 0 <= [].indexOf(item)", () => {
        const result = transform(`const found = 0 <= [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform 0 <= indexOf")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })

    describe("negated patterns", () => {
      test("[].indexOf(item) === -1", () => {
        const result = transform(`const notFound = [1, 2, 3].indexOf(item) === -1;`)

        assert(result.modified, "transform indexOf === -1")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("[].indexOf(item) <= -1", () => {
        const result = transform(`const notFound = [1, 2, 3].indexOf(item) <= -1;`)

        assert(result.modified, "transform indexOf <= -1")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("[].indexOf(item) < 0", () => {
        const result = transform(`const notFound = [1, 2, 3].indexOf(item) < 0;`)

        assert(result.modified, "transform indexOf < 0")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 === [].indexOf(item)", () => {
        const result = transform(`const notFound = -1 === [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform -1 === indexOf")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 >= [].indexOf(item)", () => {
        const result = transform(`const notFound = -1 >= [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform -1 >= indexOf")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: 0 > [].indexOf(item)", () => {
        const result = transform(`const notFound = 0 > [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform 0 > indexOf")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })

    describe("string indexOf patterns", () => {
      test("''.indexOf(substr) !== -1", () => {
        const result = transform(`const found = "hello".indexOf(substr) !== -1;`)

        assert(result.modified, "transform string indexOf !== -1")
        assert.match(result.code, /const found = "hello"\.includes\(substr\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("''.indexOf(substr) > -1", () => {
        const result = transform(`const found = "hello".indexOf(substr) > -1;`)

        assert(result.modified, "transform string indexOf > -1")
        assert.match(result.code, /const found = "hello"\.includes\(substr\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("''.indexOf(substr) >= 0", () => {
        const result = transform(`const found = "hello".indexOf(substr) >= 0;`)

        assert(result.modified, "transform string indexOf >= 0")
        assert.match(result.code, /const found = "hello"\.includes\(substr\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("''.indexOf('literal') !== -1", () => {
        const result = transform(`if ("test".indexOf('hello') !== -1) { }`)

        assert(result.modified, "transform string indexOf with literal")
        assert.match(result.code, /if \("test"\.includes\('hello'\)\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("template literal indexOf", () => {
        const result = transform("const found = `hello`.indexOf(item) !== -1;")

        assert(result.modified, "transform template literal indexOf")
        assert.match(result.code, /const found = `hello`\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })

    describe("complex expressions", () => {
      test("array method chain", () => {
        const result = transform(
          `const found = [1,2,3].map(x => x).indexOf(item) !== -1;`,
        )

        assert(result.modified, "transform with array method chain")
        assert.match(
          result.code,
          /const found = \[1, ?2, ?3\]\.map\(x => x\)\.includes\(item\)/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("string method chain", () => {
        const result = transform(
          `const found = "hello".toUpperCase().indexOf(item) !== -1;`,
        )

        assert(result.modified, "transform with string method chain")
        assert.match(
          result.code,
          /const found = "hello"\.toUpperCase\(\)\.includes\(item\)/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("in if condition with array literal", () => {
        const result = transform(
          `if ([1, 2, 3].indexOf(item) !== -1) { console.log('found'); }`,
        )

        assert(result.modified, "transform in if condition")
        assert.match(result.code, /if \(\[1, 2, 3\]\.includes\(item\)\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("in ternary expression with array literal", () => {
        const result = transform(
          `const result = [1, 2, 3].indexOf(item) !== -1 ? 'yes' : 'no';`,
        )

        assert(result.modified, "transform in ternary expression")
        assert.match(
          result.code,
          /const result = \[1, 2, 3\]\.includes\(item\) \? 'yes' : 'no'/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("negated in if condition with array literal", () => {
        const result = transform(
          `if ([1, 2, 3].indexOf(item) === -1) { console.log('not found'); }`,
        )

        assert(result.modified, "transform negated in if condition")
        assert.match(result.code, /if \(!\[1, 2, 3\]\.includes\(item\)\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("Array.from() with indexOf", () => {
        const result = transform(
          `const found = Array.from(items).indexOf(item) !== -1;`,
        )

        assert(result.modified, "transform Array.from() with indexOf")
        assert.match(result.code, /const found = \[\.\.\.items\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("new Array() with indexOf", () => {
        const result = transform(
          `const found = new Array(1, 2, 3).indexOf(item) !== -1;`,
        )

        assert(result.modified, "transform new Array() with indexOf")
        assert.match(
          result.code,
          /const found = new Array\(1, 2, 3\)\.includes\(item\)/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })

    describe("skip patterns", () => {
      test("identifier - unknown type", () => {
        const result = transform(`const found = arr.indexOf(item) !== -1;`)

        assert(!result.modified, "skip unknown type (identifier)")
      })
      test("indexOf with fromIndex parameter", () => {
        const result = transform(`const found = arr.indexOf(item, 5) !== -1;`)

        assert(!result.modified, "skip indexOf with fromIndex")
      })

      test("indexOf without comparison", () => {
        const result = transform(`const index = arr.indexOf(item);`)

        assert(!result.modified, "skip indexOf without comparison")
      })

      test("indexOf compared to other values", () => {
        const result = transform(`const found = arr.indexOf(item) > 0;`)

        assert(!result.modified, "skip indexOf compared to other values")
      })

      test("indexOf compared to variable", () => {
        const result = transform(`const found = arr.indexOf(item) !== someValue;`)

        assert(!result.modified, "skip indexOf compared to variable")
      })

      test("indexOf with invalid operators for -1", () => {
        const result = transform(`const found = arr.indexOf(item) < -1;`)

        assert(!result.modified, "skip invalid operators")
      })

      test("indexOf with invalid operators for 0", () => {
        const result = transform(`const found = arr.indexOf(item) > 0;`)

        assert(!result.modified, "skip > 0 comparison")
      })

      test("indexOf with == operator", () => {
        const result = transform(`const found = arr.indexOf(item) == -1;`)

        assert(!result.modified, "skip loose equality")
      })

      test("indexOf with != operator", () => {
        const result = transform(`const found = arr.indexOf(item) != -1;`)

        assert(!result.modified, "skip loose inequality")
      })

      test("[].indexOf(item) <= -1", () => {
        const result = transform(`const notFound = [1, 2, 3].indexOf(item) <= -1;`)

        assert(result.modified, "transform indexOf <= -1")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 <= [].indexOf(item) (invalid for -1)", () => {
        const result = transform(`const notFound = -1 <= [1, 2, 3].indexOf(item);`)

        assert(!result.modified, "skip -1 <= indexOf comparison")
      })

      test("[].indexOf(item) < -1 (invalid for -1)", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) < -1;`)

        assert(!result.modified, "skip < -1 comparison")
      })

      test("[].indexOf(item) >= -1 (invalid for -1)", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) >= -1;`)

        assert(!result.modified, "skip >= -1 comparison")
      })

      test("[].indexOf(item) < 0 (negated, transforms)", () => {
        const result = transform(`const notFound = [1, 2, 3].indexOf(item) < 0;`)

        assert(result.modified, "transform indexOf < 0")
        assert.match(result.code, /const notFound = !\[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("[].indexOf(item) > 0 (invalid for 0)", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) > 0;`)

        assert(!result.modified, "skip > 0 comparison")
      })

      test("reversed: -1 !== [].indexOf(item) (valid)", () => {
        const result = transform(`const found = -1 !== [1, 2, 3].indexOf(item);`)

        assert(result.modified, "transform -1 !== indexOf")
        assert.match(result.code, /const found = \[1, 2, 3\]\.includes\(item\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("reversed: -1 > [].indexOf(item) (invalid for reversed -1)", () => {
        const result = transform(`const found = -1 > [1, 2, 3].indexOf(item);`)

        assert(!result.modified, "skip -1 > indexOf comparison")
      })

      test("reversed: 0 < [].indexOf(item) (invalid for reversed 0)", () => {
        const result = transform(`const found = 0 < [1, 2, 3].indexOf(item);`)

        assert(!result.modified, "skip 0 < indexOf comparison")
      })

      test("reversed: 0 >= [].indexOf(item) (invalid for reversed 0)", () => {
        const result = transform(`const found = 0 >= [1, 2, 3].indexOf(item);`)

        assert(!result.modified, "skip 0 >= indexOf comparison")
      })

      test("[].indexOf(item) compared to variable", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) !== x;`)

        assert(!result.modified, "skip indexOf compared to variable")
      })

      test("[].indexOf(item) compared to non-numeric constant", () => {
        const result = transform(`const found = [1, 2, 3].indexOf(item) !== 'zero';`)

        assert(!result.modified, "skip indexOf compared to non-numeric value")
      })
    })

    describe("real-world patterns", () => {
      test("combined with logical operators", () => {
        const result = transform(
          `const valid = [1, 2, 3].indexOf(item) !== -1 && [1, 2, 3].length > 0;`,
        )

        assert(result.modified, "transform with logical operators")
        assert.match(
          result.code,
          /const valid = \[1, 2, 3\]\.includes\(item\) && \[1, 2, 3\]\.length > 0/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("multiple indexOf checks", () => {
        const result = transform(
          `const found = [1, 2].indexOf(x) !== -1 || [3, 4].indexOf(y) !== -1;`,
        )

        assert(result.modified, "transform multiple indexOf checks")
        assert.match(
          result.code,
          /const found = \[1, 2\]\.includes\(x\) \|\| \[3, 4\]\.includes\(y\)/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("in return statement", () => {
        const result = transform(`return [1, 2, 3].indexOf(target) !== -1;`)

        assert(result.modified, "transform in return statement")
        assert.match(result.code, /return \[1, 2, 3\]\.includes\(target\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("assigned to variable", () => {
        const result = transform(`const hasItem = [1, 2, 3].indexOf(searchValue) >= 0;`)

        assert(result.modified, "transform assigned to variable")
        assert.match(
          result.code,
          /const hasItem = \[1, 2, 3\]\.includes\(searchValue\)/,
        )
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })
  })

  describe("substrToSlice", () => {
    describe("basic transformations", () => {
      test("substr(start, length) on string literal", () => {
        const result = transform(`const result = "hello world".substr(0, 5);`)

        assert(result.modified, "transform substr with start and length")
        assert.match(result.code, /const result = "hello world"\.slice\(0, 0 \+ 5\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr(start) on string literal", () => {
        const result = transform(`const result = "hello world".substr(6);`)

        assert(result.modified, "transform substr with only start")
        assert.match(result.code, /const result = "hello world"\.slice\(6\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr() with no arguments", () => {
        const result = transform(`const result = "hello".substr();`)

        assert(result.modified, "transform substr with no arguments")
        assert.match(result.code, /const result = "hello"\.slice\(\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr with variables", () => {
        const result = transform(`const result = str.substr(start, length);`)

        assert(!result.modified, "skip substr on unknown type")
      })

      test("substr on template literal", () => {
        const result = transform("const result = `hello world`.substr(0, 5);")

        assert(result.modified, "transform substr on template literal")
        assert.match(result.code, /const result = `hello world`\.slice\(0, 0 \+ 5\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr on string method chain", () => {
        const result = transform(`const result = "hello".toUpperCase().substr(0, 3);`)

        assert(result.modified, "transform substr on string method chain")
        assert.match(
          result.code,
          /const result = "hello"\.toUpperCase\(\)\.slice\(0, 0 \+ 3\)/,
        )
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr with literal arguments", () => {
        const result = transform(`const s = "test string".substr(5, 6);`)

        assert(result.modified, "transform substr with literal arguments")
        assert.match(result.code, /const s = "test string"\.slice\(5, 5 \+ 6\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr with expression arguments", () => {
        const result = transform(
          `const s = "hello world".substr(offset, limit - offset);`,
        )

        assert(result.modified, "transform substr with expression arguments")
        assert.match(
          result.code,
          /const s = "hello world"\.slice\(offset, offset \+ \(limit - offset\)\)/,
        )
        assert.doesNotMatch(result.code, /substr/)
      })
    })

    describe("chained methods", () => {
      test("substr().trim()", () => {
        const result = transform(`const s = "hello world".substr(0, 5).trim();`)

        assert(result.modified, "transform substr in method chain")
        assert.match(
          result.code,
          /const s = "hello world"\.slice\(0, 0 \+ 5\)\.trim\(\)/,
        )
        assert.doesNotMatch(result.code, /substr/)
      })

      test("trim().substr()", () => {
        const result = transform(`const s = "  hello  ".trim().substr(0, 3);`)

        assert(result.modified, "transform substr after trim")
        assert.match(result.code, /const s = "  hello  "\.trim\(\)\.slice\(0, 0 \+ 3\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("multiple string method chains", () => {
        const result = transform(
          `const s = "hello".toLowerCase().substr(1, 3).toUpperCase();`,
        )

        assert(result.modified, "transform substr in complex chain")
        assert.match(
          result.code,
          /const s = "hello"\.toLowerCase\(\)\.slice\(1, 1 \+ 3\)\.toUpperCase\(\)/,
        )
        assert.doesNotMatch(result.code, /substr/)
      })
    })

    describe("edge cases", () => {
      test("substr with negative start", () => {
        const result = transform(`const s = "hello".substr(-3, 2);`)

        assert(result.modified, "transform substr with negative start")
        assert.match(result.code, /const s = "hello"\.slice\(-3, -3 \+ 2\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr with more than 2 arguments", () => {
        const result = transform(`const s = "hello".substr(0, 3, extra);`)

        assert(result.modified, "transform substr even with extra arguments")
        assert.match(result.code, /const s = "hello"\.slice\(0, 0 \+ 3\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("multiple substr calls", () => {
        const result = transform(`
          const a = "hello".substr(0, 2);
          const b = "world".substr(1, 3);
        `)

        assert(result.modified, "transform multiple substr calls")
        assert.match(result.code, /"hello"\.slice\(0, 0 \+ 2\)/)
        assert.match(result.code, /"world"\.slice\(1, 1 \+ 3\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr in expression", () => {
        const result = transform(
          `const result = "prefix" + "hello".substr(0, 3) + "suffix";`,
        )

        assert(result.modified, "transform substr in expression")
        assert.match(result.code, /"hello"\.slice\(0, 0 \+ 3\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr in function call", () => {
        const result = transform(`console.log("test".substr(1, 2));`)

        assert(result.modified, "transform substr in function call")
        assert.match(result.code, /console\.info\("test"\.slice\(1, 1 \+ 2\)\)/)
        assert.doesNotMatch(result.code, /substr/)
      })

      test("substr in return statement", () => {
        const result = transform(`function get() { return "value".substr(0, 3); }`)

        assert(result.modified, "transform substr in return")
        assert.match(result.code, /return "value"\.slice\(0, 0 \+ 3\)/)
        assert.doesNotMatch(result.code, /substr/)
      })
    })

    describe("non-transformable patterns", () => {
      test("substr on unknown variable", () => {
        const result = transform(`const s = str.substr(0, 5);`)

        assert(!result.modified, "skip substr on unknown variable")
      })

      test("substr on object property", () => {
        const result = transform(`const s = obj.prop.substr(0, 5);`)

        assert(!result.modified, "skip substr on object property")
      })

      test("substr on function call result", () => {
        const result = transform(`const s = getString().substr(0, 5);`)

        assert(!result.modified, "skip substr on function call")
      })

      test("substr on array access", () => {
        const result = transform(`const s = arr[0].substr(0, 5);`)

        assert(!result.modified, "skip substr on array access")
      })
    })

    describe("argumentsToRestParameters", () => {
      test("Array.from(arguments) in function declaration", () => {
        const result = transform(`
function fn() {
  const args = Array.from(arguments);
  console.log(args);
}
        `)

        assert(result.modified, "transform Array.from(arguments)")
        assert.match(result.code, /function fn\(\.\.\.args\)/)
        assert.doesNotMatch(result.code, /Array\.from\(arguments\)/)
        assert.doesNotMatch(result.code, /const args/)
      })

      test("[].slice.call(arguments) in function declaration", () => {
        const result = transform(`
function fn() {
  const args = [].slice.call(arguments);
  process(args);
}
        `)

        assert(result.modified, "transform [].slice.call(arguments)")
        assert.match(result.code, /function fn\(\.\.\.args\)/)
        assert.doesNotMatch(result.code, /\[\]\.slice\.call\(arguments\)/)
        assert.doesNotMatch(result.code, /const args/)
      })

      test("Array.from(arguments) in function expression", () => {
        const result = transform(`
const myFunc = function() {
  const args = Array.from(arguments);
  return args.length;
};
        `)

        assert(
          result.modified,
          "transform Array.from(arguments) in function expression",
        )
        // Note: namedArrowFunctionToNamedFunction converts this to a named function declaration
        assert.match(result.code, /function myFunc\(\.\.\.args\)/)
        assert.doesNotMatch(result.code, /Array\.from\(arguments\)/)
      })

      test("skip if arguments is used elsewhere", () => {
        const result = transform(`
function fn() {
  const args = Array.from(arguments);
  console.log(arguments.length);
}
        `)

        // arrayFromToSpread will convert Array.from(arguments) to [...arguments]
        // but argumentsToRestParameters should NOT add rest params because arguments is used elsewhere
        assert(result.modified, "other transformers run")
        assert.doesNotMatch(
          result.code,
          /\.\.\.args\)/,
          "should NOT add rest parameter",
        )
        assert.match(result.code, /\[\.\.\.arguments\]/, "should keep [...arguments]")
        assert.match(result.code, /arguments\.length/, "arguments is still used")
      })

      test("skip if function already has rest parameters", () => {
        const result = transform(`
function fn(...existing) {
  const args = Array.from(arguments);
  console.log(args);
}
        `)

        // arrayFromToSpread will convert Array.from(arguments) to [...arguments]
        // but argumentsToRestParameters should NOT add another rest parameter
        assert(result.modified, "other transformers run")
        assert.match(
          result.code,
          /\.\.\.existing\)/,
          "should keep existing rest parameter",
        )
        assert.doesNotMatch(
          result.code,
          /\.\.\.args\)/,
          "should NOT add another rest parameter",
        )
        assert.match(result.code, /\[\.\.\.arguments\]/, "should keep [...arguments]")
      })

      test("skip arrow functions", () => {
        const result = transform(`
const fn = () => {
  const args = Array.from(arguments);
  console.log(args);
};
        `)

        // Arrow functions don't have arguments, so this pattern shouldn't exist in real code
        // but we should skip it anyway
        assert(result.modified, "other transformers run")
        assert.doesNotMatch(
          result.code,
          /\.\.\.args\)/,
          "should NOT add rest parameter to arrow",
        )
      })

      test("function with existing parameters", () => {
        const result = transform(`
function fn(a, b) {
  const args = Array.from(arguments);
  return args;
}
        `)

        assert(result.modified, "transform with existing parameters")
        assert.match(result.code, /function fn\(a, b, \.\.\.args\)/)
        assert.doesNotMatch(result.code, /Array\.from\(arguments\)/)
      })

      test("multiple variable declarations", () => {
        const result = transform(`
function fn() {
  const args = Array.from(arguments);
  const x = 1;
  return args;
}
        `)

        assert(result.modified, "transform with multiple declarations")
        assert.match(result.code, /function fn\(\.\.\.args\)/)
        assert.match(result.code, /const x = 1/)
        assert.doesNotMatch(result.code, /const args/)
      })

      test("skip if arguments is in nested function", () => {
        const result = transform(`
function fn() {
  const args = Array.from(arguments);
  function nested() {
    console.log(arguments);
  }
  return args;
}
        `)

        assert(result.modified, "transform outer function")
        assert.match(result.code, /function fn\(\.\.\.args\)/)
        assert.match(
          result.code,
          /console\.info\(arguments\)/,
          "nested function keeps its arguments",
        )
      })

      test("skip if Array.from has mapping function", () => {
        const result = transform(`
function fn() {
  const args = Array.from(arguments, x => x * 2);
  return args;
}
        `)

        assert(!result.modified, "skip Array.from with mapping function")
      })

      test("skip [].slice.call with additional arguments", () => {
        const result = transform(`
function fn() {
  const args = [].slice.call(arguments, 1);
  return args;
}
        `)

        assert(!result.modified, "skip [].slice.call with additional arguments")
      })

      test("variable with different name", () => {
        const result = transform(`
function fn() {
  const myArgs = Array.from(arguments);
  return myArgs;
}
        `)

        assert(result.modified, "transform with different variable name")
        assert.match(result.code, /function fn\(\.\.\.myArgs\)/)
        assert.doesNotMatch(result.code, /Array\.from\(arguments\)/)
      })

      test("multiple declarators in same statement", () => {
        const result = transform(`
function fn() {
  const args = Array.from(arguments), x = 1, y = 2;
  return args;
}
        `)

        assert(result.modified, "transform preserving other declarators")
        assert.match(result.code, /function fn\(\.\.\.args\)/)
        assert.match(
          result.code,
          /const x = 1, y = 2/,
          "should preserve other declarators",
        )
        assert.doesNotMatch(result.code, /const args/)
      })
    })
  })

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

  describe("indexOfToStartsWith", () => {
    describe("transformable patterns", () => {
      test("string literal with indexOf === 0", () => {
        const result = transform(`const found = "hello world".indexOf("hello") === 0;`)

        assert(result.modified, "transform indexOf === 0")
        assert.match(result.code, /"hello world"\.startsWith\("hello"\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("string literal with 0 === indexOf", () => {
        const result = transform(`const found = 0 === "hello world".indexOf("hello");`)

        assert(result.modified, "transform 0 === indexOf")
        assert.match(result.code, /"hello world"\.startsWith\("hello"\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("string literal with indexOf !== 0", () => {
        const result = transform(
          `const notFound = "hello world".indexOf("goodbye") !== 0;`,
        )

        assert(result.modified, "transform indexOf !== 0")
        assert.match(result.code, /!"hello world"\.startsWith\("goodbye"\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("template literal with indexOf === 0", () => {
        const result = transform("const found = `hello world`.indexOf('hello') === 0;")

        assert(result.modified, "transform template literal indexOf")
        assert.match(result.code, /`hello world`\.startsWith\('hello'\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })

      test("string method chain with indexOf === 0", () => {
        const result = transform(
          `const found = "HELLO".toLowerCase().indexOf("hello") === 0;`,
        )

        assert(result.modified, "transform string method chain indexOf")
        assert.match(result.code, /"HELLO"\.toLowerCase\(\)\.startsWith\("hello"\)/)
        assert.doesNotMatch(result.code, /indexOf/)
      })
    })

    describe("non-transformable patterns", () => {
      test("indexOf with two arguments", () => {
        const result = transform(`const found = str.indexOf("test", 5) === 0;`)

        assert(!result.modified, "skip indexOf with fromIndex")
      })

      test("indexOf on unknown variable", () => {
        const result = transform(`const found = str.indexOf("test") === 0;`)

        assert(!result.modified, "skip indexOf on unknown variable")
      })

      test("indexOf compared to non-zero", () => {
        const result = transform(`const found = "test".indexOf("e") === 1;`)

        assert(!result.modified, "skip indexOf === 1")
      })
    })
  })

  describe("substringToStartsWith", () => {
    describe("transformable patterns", () => {
      test("substring(0, prefix.length) === prefix", () => {
        const result = transform(
          `const matches = "hello world".substring(0, prefix.length) === prefix;`,
        )

        assert(result.modified, "transform substring prefix check")
        assert.match(result.code, /"hello world"\.startsWith\(prefix\)/)
        assert.doesNotMatch(result.code, /substring/)
      })

      test("prefix === substring(0, prefix.length)", () => {
        const result = transform(
          `const matches = prefix === "hello world".substring(0, prefix.length);`,
        )

        assert(result.modified, "transform reversed substring prefix check")
        assert.match(result.code, /"hello world"\.startsWith\(prefix\)/)
        assert.doesNotMatch(result.code, /substring/)
      })

      test("substring(0, prefix.length) !== prefix", () => {
        const result = transform(
          `const noMatch = "hello world".substring(0, prefix.length) !== prefix;`,
        )

        assert(result.modified, "transform substring !== prefix")
        assert.match(result.code, /!"hello world"\.startsWith\(prefix\)/)
        assert.doesNotMatch(result.code, /substring/)
      })

      test("substring with string literal prefix", () => {
        const result = transform(
          `const matches = "hello world".substring(0, "hello".length) === "hello";`,
        )

        assert(result.modified, "transform substring with literal prefix")
        assert.match(result.code, /"hello world"\.startsWith\("hello"\)/)
        assert.doesNotMatch(result.code, /substring/)
      })

      test("substring on template literal", () => {
        const result = transform(
          "const matches = `test`.substring(0, prefix.length) === prefix;",
        )

        assert(result.modified, "transform substring on template literal")
        assert.match(result.code, /`test`\.startsWith\(prefix\)/)
        assert.doesNotMatch(result.code, /substring/)
      })
    })

    describe("non-transformable patterns", () => {
      test("substring with wrong argument count", () => {
        const result = transform(`const sub = "hello".substring(0) === prefix;`)

        assert(!result.modified, "skip substring with one argument")
      })

      test("substring with non-zero start", () => {
        const result = transform(
          `const sub = "hello".substring(1, prefix.length) === prefix;`,
        )

        assert(!result.modified, "skip substring with non-zero start")
      })

      test("substring without length comparison", () => {
        const result = transform(`const sub = "hello".substring(0, 3) === "hel";`)

        assert(!result.modified, "skip substring without .length")
      })

      test("substring on unknown variable", () => {
        const result = transform(
          `const matches = str.substring(0, prefix.length) === prefix;`,
        )

        assert(!result.modified, "skip substring on unknown variable")
      })

      test("substring with wrong length reference", () => {
        const result = transform(
          `const matches = "test".substring(0, other.length) === prefix;`,
        )

        assert(!result.modified, "skip substring with mismatched length")
      })
    })
  })

  describe("lastIndexOfToEndsWith", () => {
    describe("transformable patterns", () => {
      test("lastIndexOf === str.length - suffix.length", () => {
        const result = transform(
          `const matches = "hello world".lastIndexOf(suffix) === "hello world".length - suffix.length;`,
        )

        assert(result.modified, "transform lastIndexOf suffix check")
        assert.match(result.code, /"hello world"\.endsWith\(suffix\)/)
        assert.doesNotMatch(result.code, /lastIndexOf/)
      })

      test("str.length - suffix.length === lastIndexOf", () => {
        const result = transform(
          `const matches = "test".length - suffix.length === "test".lastIndexOf(suffix);`,
        )

        assert(result.modified, "transform reversed lastIndexOf check")
        assert.match(result.code, /"test"\.endsWith\(suffix\)/)
        assert.doesNotMatch(result.code, /lastIndexOf/)
      })

      test("lastIndexOf !== str.length - suffix.length", () => {
        const result = transform(
          `const noMatch = "test".lastIndexOf(suffix) !== "test".length - suffix.length;`,
        )

        assert(result.modified, "transform lastIndexOf !== suffix check")
        assert.match(result.code, /!"test"\.endsWith\(suffix\)/)
        assert.doesNotMatch(result.code, /lastIndexOf/)
      })

      test("lastIndexOf with string literal suffix", () => {
        const result = transform(
          `const matches = "hello world".lastIndexOf("world") === "hello world".length - "world".length;`,
        )

        assert(result.modified, "transform lastIndexOf with literal suffix")
        assert.match(result.code, /"hello world"\.endsWith\("world"\)/)
        assert.doesNotMatch(result.code, /lastIndexOf/)
      })

      test("lastIndexOf on string literal with identifier suffix", () => {
        const result = transform(
          'const matches = "test string".lastIndexOf(suffix) === "test string".length - suffix.length;',
        )

        assert(result.modified, "transform lastIndexOf on string literal")
        assert.match(result.code, /"test string"\.endsWith\(suffix\)/)
        assert.doesNotMatch(result.code, /lastIndexOf/)
      })
    })

    describe("non-transformable patterns", () => {
      test("lastIndexOf with non-subtraction comparison", () => {
        const result = transform(`const matches = "test".lastIndexOf(suffix) === 5;`)

        assert(!result.modified, "skip lastIndexOf with non-subtraction")
      })

      test("lastIndexOf with wrong operator in subtraction", () => {
        const result = transform(
          `const matches = "test".lastIndexOf(suffix) === "test".length + suffix.length;`,
        )

        assert(!result.modified, "skip lastIndexOf with addition")
      })

      test("lastIndexOf with subtraction of non-length property", () => {
        const result = transform(
          `const matches = "test".lastIndexOf(suffix) === "test".length - suffix.size;`,
        )

        assert(!result.modified, "skip lastIndexOf with wrong property")
      })

      test("lastIndexOf with two arguments", () => {
        const result = transform(
          `const found = str.lastIndexOf("test", 5) === str.length - "test".length;`,
        )

        assert(!result.modified, "skip lastIndexOf with fromIndex")
      })

      test("lastIndexOf on unknown variable", () => {
        const result = transform(
          `const matches = str.lastIndexOf(suffix) === str.length - suffix.length;`,
        )

        assert(!result.modified, "skip lastIndexOf on unknown variable")
      })

      test("lastIndexOf with wrong subtraction pattern", () => {
        const result = transform(
          `const matches = "test".lastIndexOf(suffix) === 10 - suffix.length;`,
        )

        assert(!result.modified, "skip lastIndexOf with wrong subtraction")
      })

      test("lastIndexOf with mismatched string references", () => {
        const result = transform(
          `const matches = str1.lastIndexOf(suffix) === str2.length - suffix.length;`,
        )

        assert(!result.modified, "skip lastIndexOf with mismatched strings")
      })

      test("lastIndexOf with mismatched suffix references", () => {
        const result = transform(
          `const matches = "test".lastIndexOf(suffix1) === "test".length - suffix2.length;`,
        )

        assert(!result.modified, "skip lastIndexOf with mismatched suffixes")
      })
    })
  })
})
