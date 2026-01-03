import { describe, suite, test } from "node:test"
import assert from "node:assert/strict"
import { transform } from "../src/index.js"

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
      assert.match(result.code, /console\.log\(item\)/)
    })

    test("Array.from().forEach() with arrow function expression", () => {
      const result = transform(`Array.from(numbers).forEach(n => console.log(n));`)

      assert(result.modified, "transform Array.from().forEach()")
      assert.match(result.code, /for \(const n of numbers\)/)
    })

    test("plain identifier forEach", () => {
      const result = transform(`
    items.forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip plain identifier forEach")
      assert.match(result.code, /items\.forEach/)
    })

    test("plain identifier forEach with function expression", () => {
      const result = transform(`numbers.forEach((n) => { console.log(n); });`)

      assert(!result.modified, "skip plain identifier forEach")
      assert.match(result.code, /numbers\.forEach/)
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
      console.log(item, index);
    });
  `)

      assert(!result.modified, "skip callback with index parameter")
      assert.match(result.code, /forEach\(\(item, index\)/)
    })

    test("forEach with index parameter", () => {
      const result = transform(`
    items.forEach((item, index) => {
      console.log(item, index);
    });
  `)

      assert(!result.modified, "skip callback with index parameter")
      assert.match(result.code, /forEach\(\(item, index\)/)
    })

    test("forEach on unknown objects", () => {
      const result = transform(`
    myCustomObject.forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip forEach on unknown objects")
      assert.match(result.code, /myCustomObject\.forEach/)
    })

    test("Map.forEach()", () => {
      const result = transform(`
    myMap.forEach((value, key) => {
      console.log(key, value);
    });
  `)

      assert(!result.modified, "skip Map.forEach() with 2 parameters")
      assert.match(result.code, /myMap\.forEach/)
    })

    test("Array.from().forEach() without callback", () => {
      const result = transform(`Array.from(items).forEach();`)

      assert(!result.modified, "skip Array.from().forEach() without callback")
      assert.match(result.code, /forEach\(\)/)
    })

    test("Array.from().forEach() with non-function callback", () => {
      const result = transform(`Array.from(items).forEach(callback);`)

      assert(!result.modified, "skip Array.from().forEach() with non-function callback")
      assert.match(result.code, /forEach\(callback\)/)
    })

    test("Array.from().forEach() with function expression", () => {
      const result = transform(`Array.from(items).forEach(function(item) {
        console.log(item);
      });`)

      assert(
        result.modified,
        "transform Array.from().forEach() with function expression",
      )
      assert.match(result.code, /for \(const item of items\)/)
    })

    test("tracks line numbers for Array.from().forEach()", () => {
      const result = transform(`// Line 1
Array.from(items).forEach(item => console.log(item));`)

      assert(result.modified, "tracks line numbers")
      assert.equal(result.changes.length, 1)
      assert.equal(result.changes[0].type, "arrayFromForEachToForOf")
      assert.equal(result.changes[0].line, 2)
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
      assert.match(result.code, /Array\.from\(numbers, n => n \* 2\)/)
    })

    test("Array.from() with thisArg", () => {
      const result = transform(
        `const result = Array.from(items, function(x) { return x * this.multiplier; }, context);`,
      )

      assert(!result.modified, "skip Array.from() with thisArg")
      assert.match(result.code, /Array\.from/)
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

    test("tracks line numbers for Array.from() to spread", () => {
      const result = transform(`// Line 1
const result = Array.from(items).map(x => x * 2);`)

      assert(result.modified, "tracks line numbers")
      assert.equal(result.changes.length, 1)
      assert.equal(result.changes[0].type, "arrayFromToSpread")
      assert.equal(result.changes[0].line, 2)
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
      assert.equal(result.changes.length, 3)
    })

    test("tracks line numbers", () => {
      const result = transform(`// Line 1
var x = 1;`)

      assert(result.modified, "tracks line numbers")
      assert.equal(result.changes.length, 1)
      assert.equal(result.changes[0].type, "varToLetOrConst")
      assert.equal(result.changes[0].line, 2)
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
      assert.match(result.code, /a \+ b \+ c/)
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
      const result = transform(`const str = "Line 1\\\\n" + "Line 2";`)

      assert(result.modified, "transform and preserve newline escapes")
      assert.ok(result.code.includes("\\\\n"), "preserve \\\\n escape sequence")
    })

    test("preserves tab escapes", () => {
      const result = transform(`const str = "Tab\\\\t" + value + "\\\\t";`)

      assert(result.modified, "transform and preserve tab escapes")
      assert.ok(result.code.includes("\\\\t"), "preserve \\\\t escape sequence")
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
      assert.match(result.code, /Object\.assign/)
    })

    test("non-object first arg", () => {
      const result = transform(`const obj = Object.assign(target, obj1);`)

      assert(!result.modified, "skip Object.assign with non-object first arg")
      assert.match(result.code, /Object\.assign/)
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
      assert.match(result.code, /Math\.pow\(2\)/)
    })

    test("nested calls", () => {
      const result = transform(`const result = Math.pow(Math.pow(2, 3), 4);`)

      assert(result.modified, "transform nested Math.pow() in single pass")
      assert.match(result.code, /Math\.pow\(2, 3\) \*\* 4/)
    })

    test("tracks line numbers", () => {
      const result = transform(`// Line 1
const result = Math.pow(2, 3);`)

      assert(result.modified, "tracks line numbers")
      const mathPowChanges = result.changes.filter(
        (c) => c.type === "mathPowToExponentiation",
      )
      assert.equal(mathPowChanges.length, 1)
      assert.equal(mathPowChanges[0].line, 2)
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
      assert.match(result.code, /console\.log\(item\)/)
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
  console.log(element);
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
  console.log(item, i);
}
      `)

      assert(!result.modified, "skip when index used in body")
      assert.match(result.code, /for \(let i = 0; i < items\.length; i\+\+\)/)
    })

    test("no array access statement", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
  console.log(i);
}
      `)

      assert(!result.modified, "skip when no array access statement")
      assert.match(result.code, /for \(let i = 0/)
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
  console.log(item);
}
      `)

      assert(!result.modified, "skip when using different increment")
      assert.match(result.code, /i \+= 2/)
    })

    test("non-zero start", () => {
      const result = transform(`
for (let i = 1; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when starting from non-zero")
      assert.match(result.code, /let i = 1/)
    })

    test("using <= instead of <", () => {
      const result = transform(`
for (let i = 0; i <= items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when using <= instead of <")
      assert.match(result.code, /i <= items\.length/)
    })

    test("different array access", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
  const item = otherArray[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when accessing different array")
      assert.match(result.code, /otherArray\[i\]/)
    })

    test("no variable declaration first", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
  console.log(items[i]);
}
      `)

      assert(!result.modified, "skip when first statement is not variable declaration")
      assert.match(result.code, /for \(let i = 0/)
    })

    test("different index variable", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
  const item = items[j];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when using different index variable")
    })

    test("prefix increment", () => {
      const result = transform(`
for (let i = 0; i < items.length; ++i) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(result.modified, "transform with prefix increment")
      assert.match(result.code, /for \(const item of items\)/)
    })

    test("multiple statements", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(item);
  process(item);
  cleanup();
}
      `)

      assert(result.modified, "transform with multiple statements")
      assert.match(result.code, /for \(const item of items\)/)
      assert.match(result.code, /console\.log\(item\)/)
      assert.match(result.code, /process\(item\)/)
      assert.match(result.code, /cleanup\(\)/)
    })

    test("init not variable declaration", () => {
      const result = transform(`
for (i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when init is not variable declaration")
    })

    test("init multiple declarations", () => {
      const result = transform(`
for (let i = 0, j = 0; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when init has multiple declarations")
    })

    test("init id not identifier", () => {
      const result = transform(`
for (let [i] = [0]; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when init id is not identifier")
    })

    test("test not binary expression", () => {
      const result = transform(`
for (let i = 0; items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when test is not binary expression")
    })

    test("test operator not <", () => {
      const result = transform(`
for (let i = 0; i <= items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when test operator is not <")
    })

    test("test left not index variable", () => {
      const result = transform(`
for (let i = 0; j < items.length; i++) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when test left is not index variable")
    })

    test("test right not member expression", () => {
      const result = transform(`
for (let i = 0; i < 10; i++) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when test right is not member expression")
    })

    test("test right property not 'length'", () => {
      const result = transform(`
for (let i = 0; i < items.size; i++) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when test right property is not 'length'")
    })

    test("test right object not identifier", () => {
      const result = transform(`
for (let i = 0; i < getItems().length; i++) {
  const item = getItems()[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when test right object is not identifier")
    })

    test("update not update expression", () => {
      const result = transform(`
for (let i = 0; i < items.length; i = i + 1) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when update is not update expression")
    })

    test("update argument not index variable", () => {
      const result = transform(`
for (let i = 0; i < items.length; j++) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when update argument is not index variable")
    })

    test("update operator not ++", () => {
      const result = transform(`
for (let i = 0; i < items.length; i--) {
  const item = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when update operator is not ++")
    })

    test("body not block statement", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++)
  console.log(items[i]);
      `)

      assert(!result.modified, "skip when body is not block statement")
    })

    test("first statement multiple declarations", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
  const item = items[i], other = null;
  console.log(item);
}
      `)

      assert(!result.modified, "skip when first statement has multiple declarations")
    })

    test("first statement id not identifier", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
  const [item] = items[i];
  console.log(item);
}
      `)

      assert(!result.modified, "skip when first statement id is not identifier")
    })

    test("first statement init not member expression", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
  const item = getItem(i);
  console.log(item);
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
  console.log(item);
}
      `)

      assert(!result.modified, "skip when member expression object name doesn't match")
    })

    test("member expression property not matching index", () => {
      const result = transform(`
for (let i = 0; i < items.length; i++) {
  const item = items[j];
  console.log(item);
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
  console.log(item);
}
      `)

      assert(!result.modified, "skip when member expression is not computed")
    })

    test("tracks line numbers", () => {
      const result = transform(`// Line 1
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  console.log(item);
}`)

      assert(result.modified, "tracks line numbers")
      const forLoopChanges = result.changes.filter((c) => c.type === "forLoopToForOf")
      assert.equal(forLoopChanges.length, 1)
      assert.equal(forLoopChanges[0].line, 2)
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
      assert.match(result.code, /console\.log\(item\)/)
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
      console.log(item);
    });
  `)

      assert(!result.modified, "skip element variable querySelectorAll")
      assert.match(result.code, /element\.querySelectorAll/)
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
      assert.match(result.code, /for \(const frame of window\.frames\)/)
    })

    test("arrow function without braces", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach(item => item.remove());
  `)

      assert(!result.modified, "skip arrow function without braces")
      assert.match(result.code, /forEach\(item => item\.remove\(\)\)/)
    })

    test("with index parameter", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach((item, index) => {
      console.log(item, index);
    });
  `)

      assert(!result.modified, "skip forEach with index parameter")
      assert.match(result.code, /forEach\(\(item, index\) =>/)
    })

    test("with array parameter", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach((item, index, array) => {
      console.log(item, index, array);
    });
  `)

      assert(!result.modified, "skip forEach with array parameter")
      assert.match(result.code, /forEach\(\(item, index, array\) =>/)
    })

    test("non-inline callback", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach(handleItem);
  `)

      assert(!result.modified, "skip forEach with non-inline callback")
      assert.match(result.code, /forEach\(handleItem\)/)
    })

    test("without callback", () => {
      const result = transform(`
    document.querySelectorAll('.item').forEach();
  `)

      assert(!result.modified, "skip forEach without callback")
      assert.match(result.code, /forEach\(\)/)
    })

    test("unknown methods", () => {
      const result = transform(`
    document.querySomething('.item').forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip unknown methods")
      assert.match(result.code, /querySomething/)
    })

    test("non-document objects with querySelectorAll", () => {
      const result = transform(`
    myObject.querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip non-document objects with querySelectorAll")
      assert.match(result.code, /myObject\.querySelectorAll/)
    })

    test("window methods not in allowed list", () => {
      const result = transform(`
    window.querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip window methods not in allowed list")
      assert.match(result.code, /window\.querySelectorAll/)
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
  console.log(item);
});`)

      assert(result.modified, "tracks line numbers")
      assert.equal(result.changes.length, 1)
      assert.equal(result.changes[0].type, "iterableForEachToForOf")
      assert.equal(result.changes[0].line, 2)
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
      console.log(value);
      item.classList.add('processed');
    });
  `)

      assert(result.modified, "transform and preserve multiline function bodies")
      assert.match(result.code, /for \(const item of/)
      assert.match(result.code, /const value = item\.value/)
      assert.match(result.code, /console\.log\(value\)/)
      assert.match(result.code, /item\.classList\.add/)
    })

    test("element variables with getElementsByTagName", () => {
      const result = transform(`
    container.getElementsByTagName('input').forEach(input => {
      input.value = '';
    });
  `)

      assert(!result.modified, "skip element variables with getElementsByTagName")
      assert.match(result.code, /container\.getElementsByTagName/)
    })

    test("element variables with getElementsByClassName", () => {
      const result = transform(`
    section.getElementsByClassName('warning').forEach(warning => {
      warning.style.display = 'none';
    });
  `)

      assert(!result.modified, "skip element variables with getElementsByClassName")
      assert.match(result.code, /section\.getElementsByClassName/)
    })

    test("window.querySelectorAll not in allowed", () => {
      const result = transform(`
    window.querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip window.querySelectorAll")
      assert.match(result.code, /window\.querySelectorAll/)
    })

    test("property access on unknown objects", () => {
      const result = transform(`
    customObject.frames.forEach(frame => {
      frame.postMessage('test', '*');
    });
  `)

      assert(!result.modified, "skip property access on unknown objects")
      assert.match(result.code, /customObject\.frames/)
    })

    test("object not a member expression", () => {
      const result = transform(`
    items.forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip when forEach object is not a member expression")
      assert.match(result.code, /items\.forEach/)
    })

    test("method name computed property", () => {
      const result = transform(`
    document['querySelectorAll']('.item').forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip when method name is computed")
      assert.match(result.code, /document\['querySelectorAll'\]/)
    })

    test("unknown document methods", () => {
      const result = transform(`
    document.customMethod().forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip unknown document methods")
      assert.match(result.code, /document\.customMethod/)
    })

    test("chained call from non-document origin", () => {
      const result = transform(`
    element.querySelector('div').querySelectorAll('span').forEach(span => {
      span.remove();
    });
  `)

      assert(!result.modified, "skip chained call from non-document origin")
      assert.match(result.code, /element\.querySelector/)
    })

    test("chained call with unknown method", () => {
      const result = transform(`
    document.getElementById('x').customMethod().forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip chained call with unknown method")
      assert.match(result.code, /customMethod/)
    })

    test("caller neither identifier nor member/call expression", () => {
      const result = transform(`
    (() => { return document; })().querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip when caller is a function expression")
      assert.match(result.code, /forEach/)
    })

    test("caller is ThisExpression", () => {
      const result = transform(`
    this.querySelectorAll('.item').forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip when caller is this")
      assert.match(result.code, /this\.querySelectorAll/)
    })

    test("object neither MemberExpression nor CallExpression", () => {
      const result = transform(`
    items.forEach(item => {
      console.log(item);
    });
  `)

      assert(!result.modified, "skip when forEach object is just an identifier")
      assert.match(result.code, /items\.forEach/)
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
      console.log(item);
    });
  `)

      assert(!result.modified, "skip when callerObject is a binary expression")
      assert.match(result.code, /forEach/)
    })

    test("CallExpression with non-MemberExpression callee", () => {
      const result = transform(`
    getElements().forEach(item => {
      console.log(item);
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
      assert.match(result.code, /getDocument\(\)\.querySelectorAll/)
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
      assert.match(result.code, /const greet = name =>/)
      assert.match(result.code, /return/)
    })

    test("multiple parameters", () => {
      const result = transform(`
    const add = function(a, b) {
      return a + b;
    };
  `)

      assert(result.modified, "transform anonymous function with multiple parameters")
      assert.match(result.code, /const add = \(a, b\) =>/)
    })

    test("no parameters", () => {
      const result = transform(`
    const getValue = function() {
      return 42;
    };
  `)

      assert(result.modified, "transform anonymous function with no parameters")
      assert.match(result.code, /const getValue = \(\) =>/)
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
      assert.match(result.code, /method: function\(\)/)
    })

    test("using 'this' in nested code", () => {
      const result = transform(`
    const handler = function() {
      if (true) {
        console.log(this.name);
      }
    };
  `)

      assert(!result.modified, "skip function using 'this' in nested code")
      assert.match(result.code, /const handler = function\(\)/)
    })

    test("using 'arguments'", () => {
      const result = transform(`
    const sum = function() {
      return [...arguments].reduce((a, b) => a + b, 0);
    };
  `)

      assert(!result.modified, "skip function using 'arguments'")
      assert.match(result.code, /const sum = function\(\)/)
      assert.doesNotMatch(result.code, /const sum = \(\) =>/)
      assert.doesNotMatch(result.code, /const sum = =>/)
    })

    test("generator function", () => {
      const result = transform(`
    const gen = function*() {
      yield 1;
      yield 2;
    };
  `)

      assert(!result.modified, "skip generator function")
      assert.match(result.code, /const gen = function\*\(\)/)
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
      assert.match(result.code, /const outer = x =>/)
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
      assert.match(result.code, /const fetchData = async url =>/)
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
      assert.match(result.code, /const process = data =>/)
    })

    test("multiple transformations", () => {
      const result = transform(`
    const fn1 = function(x) { return x + 1; };
    const fn2 = function(y) { return y * 2; };
  `)

      assert(result.modified, "transform multiple functions")
      assert.match(result.code, /const fn1 = x =>/)
      assert.match(result.code, /const fn2 = y =>/)
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
      assert.match(result.code, /const outer = x =>/)
      assert.match(result.code, /return function\(\)/)
    })

    test("event handlers without 'this'", () => {
      const result = transform(`
    button.addEventListener('click', function(event) {
      console.log('Clicked', event.target);
    });
  `)

      assert(result.modified, "transform event handlers without 'this'")
      assert.match(result.code, /button\.addEventListener\('click', event =>/)
    })

    test("IIFE without 'this'", () => {
      const result = transform(`
    (function() {
      console.log('IIFE executed');
    })();
  `)

      assert(result.modified, "transform IIFE without 'this'")
      assert.match(result.code, /\(\(\) =>/)
    })

    test("named function expression", () => {
      const result = transform(`
    const factorial = function fact(n) {
      return n <= 1 ? 1 : n * fact(n - 1);
    };
  `)

      assert(!result.modified, "skip named function expression")
      assert.match(result.code, /function fact\(n\)/)
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
      assert.match(result.code, /arr\.concat\(\)/)
    })

    test("tracks line numbers", () => {
      const result = transform(`// Line 1
const result = [1, 2].concat(other);`)

      assert(result.modified, "tracks line numbers")
      assert.equal(result.changes.length, 1)
      assert.equal(result.changes[0].type, "arrayConcatToSpread")
      assert.equal(result.changes[0].line, 2)
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
      assert.match(result.code, /str\.concat/)
    })

    test("unknown identifier", () => {
      const result = transform(`const result = arr.concat(other);`)

      assert(!result.modified, "skip concat on unknown identifier")
      assert.match(result.code, /arr\.concat/)
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
      assert.match(result.code, /function helper/)
    })

    test("skip constructor without prototype methods", () => {
      const result = transform(`
function Person(name) {
  this.name = name;
}
      `)

      assert(!result.modified, "skip constructor without prototype methods")
      assert.match(result.code, /function Person/)
    })

    test("skip if not all methods are function expressions", () => {
      const result = transform(`
function Person(name) {
  this.name = name;
}

Person.prototype.greet = () => {
  return 'Hello';
};
      `)

      assert(!result.modified, "skip arrow functions on prototype")
      assert.match(result.code, /function Person/)
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

    test("skip function expression with method call in constructor", () => {
      const result = transform(`
var SomeClass = function (selector) {
  this.element = document.querySelector(selector);
  this.init();
};

SomeClass.prototype = {
  init: function () {
    console.log('init');
  }
};
      `)

      // Constructor with method call should not be transformed (not a simple constructor)
      assert.doesNotMatch(result.code, /class SomeClass/)
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
      assert.match(result.code, /function Widget/)
    })

    test("skip prototype assignment with arrow function methods", () => {
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

      assert(!result.modified, "skip prototype object with arrow functions")
      assert.match(result.code, /function Component/)
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
      assert.match(result.code, /function Model/)
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
      assert.match(result.code, /function Handler/)
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

      assert(!result.modified, "skip constructor with if statement")
      assert.match(result.code, /function Service/)
    })

    test("skip prototype method assignment with non-function value", () => {
      const result = transform(`
function Manager(id) {
  this.id = id;
}

Manager.prototype.defaultValue = 10;
      `)

      assert(!result.modified, "skip prototype with non-function assignment")
      assert.match(result.code, /function Manager/)
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
      assert.match(result.code, /function Parser/)
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

      assert(!result.modified, "skip constructor with throw")
      assert.match(result.code, /function Validator/)
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
      assert.match(result.code, /function Handler/)
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
      assert.match(result.code, /function Component/)
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

      assert(!result.modified, "skip constructor with return")
      assert.match(result.code, /function Creator/)
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
      assert.match(result.code, /function Box/)
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
      assert.match(result.code, /function Widget/)
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

      assert.doesNotMatch(
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
})
