import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
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
})
