import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
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

    test("preserves leading comments", () => {
      const result = transform(`
    // Process all test elements with data-test attribute
    document.querySelectorAll("[data-test]").forEach(function (element) {
    element.classList.add("processed")
    })
    `)

      assert(result.modified, "transform querySelectorAll with leading comment")
      assert.match(result.code, /for \(const element of document\.querySelectorAll/)
      assert.match(
        result.code,
        /\/\/ Process all test elements with data-test attribute/,
        "comment should be preserved",
      )
    })

    test("preserves trailing comments", () => {
      const result = transform(`
    document.querySelectorAll("[data-test]").forEach(function (element) {
    element.classList.add("processed")
    })
    // End of element processing
    `)

      assert(result.modified, "transform with trailing comment")
      assert.match(result.code, /for \(const element of document\.querySelectorAll/)
      assert.match(
        result.code,
        /\/\/ End of element processing/,
        "trailing comment should be preserved",
      )
    })

    test("preserves multiple comments", () => {
      const result = transform(`
    // Start processing
    document.querySelectorAll("[data-test]").forEach(function(item) {
    console.log(item)
    })
    // Done processing
    `)

      assert(result.modified, "transform with leading and trailing comments")
      assert.match(result.code, /for \(const item of document\.querySelectorAll/)
      assert.match(
        result.code,
        /\/\/ Start processing/,
        "leading comment should be preserved",
      )
      assert.match(
        result.code,
        /\/\/ Done processing/,
        "trailing comment should be preserved",
      )
    })
  })
})
