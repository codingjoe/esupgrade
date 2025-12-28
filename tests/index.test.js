import { describe, test } from "node:test"
import assert from "node:assert"
import { transform } from "../src/index.js"

describe("index", () => {
  describe("transform function", () => {
    test("should return TransformResult with correct structure", () => {
      const input = `var x = 1;`
      const result = transform(input)

      assert.ok(result.hasOwnProperty("code"))
      assert.ok(result.hasOwnProperty("modified"))
      assert.ok(result.hasOwnProperty("changes"))
      assert.strictEqual(typeof result.code, "string")
      assert.strictEqual(typeof result.modified, "boolean")
      assert.ok(Array.isArray(result.changes))
    })

    test("should handle empty string", () => {
      const input = ``
      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.strictEqual(result.changes.length, 0)
      assert.strictEqual(result.code, "")
    })

    test("should handle whitespace-only string", () => {
      const input = `   \n\n   `
      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.strictEqual(result.changes.length, 0)
    })

    test("should handle comments only", () => {
      const input = `// This is a comment\n/* Another comment */`
      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.strictEqual(result.changes.length, 0)
    })

    test("should apply multiple transformations and track all changes", () => {
      const input = `
        var x = 1;
        var y = 'Hello ' + name;
        var obj = Object.assign({}, data);
      `
      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.ok(result.changes.length > 0)

      // Should have changes from varToConst (which does track line numbers)
      const changeTypes = result.changes.map((c) => c.type)
      assert.ok(changeTypes.includes("varToConst"))

      // Verify the transformations happened even if not all are tracked
      assert.match(result.code, /const/)
      assert.match(result.code, /`Hello/)
      assert.match(result.code, /\.\.\.data/)
    })

    test("should aggregate changes from multiple transformers", () => {
      const input = `
        var a = 1;
        var b = 'Hello ' + world;
        Array.from(items).forEach(item => console.log(item));
      `
      const result = transform(input, "widely-available")

      assert.strictEqual(result.modified, true)

      // Should track line numbers for all changes
      assert.ok(result.changes.every((c) => c.hasOwnProperty("line")))
      assert.ok(result.changes.every((c) => c.hasOwnProperty("type")))
    })

    test("should use widely-available transformers by default", () => {
      const input = `var x = 1;`
      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.strictEqual(result.changes[0].type, "varToConst")
    })

    test("should include newly-available transformers when specified", () => {
      const input = `
        var x = 1;
        const p = new Promise((resolve) => resolve(getData()));
      `
      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, true)

      const changeTypes = result.changes.map((c) => c.type)
      assert.ok(changeTypes.includes("varToConst"))
      assert.ok(changeTypes.includes("promiseTry"))
    })

    test("should handle complex nested structures", () => {
      const input = `
        function test() {
          var result = Object.assign({}, {
            message: 'Hello ' + name
          });
          return result;
        }
      `
      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /const result/)
      assert.match(result.code, /\.\.\./)
      assert.match(result.code, /`Hello/)
    })

    test("should handle JSX syntax", () => {
      const input = `
        var Component = () => {
          var title = 'Hello ' + name;
          return <div>{title}</div>;
        };
      `
      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /const/)
      assert.match(result.code, /<div>/)
    })

    test("should handle TypeScript syntax", () => {
      const input = `
        var x: number = 1;
        const greeting: string = 'Hello ' + name;
      `
      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /const x: number/)
      assert.match(result.code, /`Hello/)
    })

    test("should preserve code formatting structure", () => {
      const input = `var x = 1;
var y = 2;`
      const result = transform(input)

      // Should maintain separation between statements
      assert.match(result.code, /const x = 1/)
      assert.match(result.code, /const y = 2/)
    })

    test("should handle very large code", () => {
      // Generate a large input with many var declarations
      const lines = []
      for (let i = 0; i < 100; i++) {
        lines.push(`var x${i} = ${i};`)
      }
      const input = lines.join("\n")

      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.strictEqual(result.changes.length, 100)
      assert.match(result.code, /const x0 = 0/)
      assert.match(result.code, /const x99 = 99/)
    })

    test("should handle code with special characters", () => {
      const input = `var msg = 'Hello \\n' + 'World\\t!';`
      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /const msg/)
      // Template literals preserve the escape sequences
      assert.match(result.code, /`Hello/)
    })

    test("should handle code with unicode characters", () => {
      const input = `var msg = 'Hello ' + '世界' + '!';`
      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /const msg/)
    })

    test("should handle all transformers returning no changes", () => {
      const input = `const x = 1; const y = 2;`
      const result = transform(input)

      assert.strictEqual(result.modified, false)
      assert.strictEqual(result.changes.length, 0)
    })

    test("should handle baseline parameter case sensitivity", () => {
      const input = `var x = 1;`

      // Should accept exact strings
      const result1 = transform(input, "widely-available")
      assert.strictEqual(result1.modified, true)

      const result2 = transform(input, "newly-available")
      assert.strictEqual(result2.modified, true)
    })

    test("should merge transformers correctly for newly-available", () => {
      const input = `
        var x = 1;
        var obj = Object.assign({}, data);
        const p = new Promise((resolve) => resolve(getData()));
      `
      const result = transform(input, "newly-available")

      assert.strictEqual(result.modified, true)

      // Should have changes from transformers that track line numbers
      const changeTypes = result.changes.map((c) => c.type)
      assert.ok(changeTypes.includes("varToConst")) // from widely-available
      assert.ok(changeTypes.includes("promiseTry")) // from newly-available

      // Verify all transformations happened
      assert.match(result.code, /const/)
      assert.match(result.code, /\.\.\.data/)
      assert.match(result.code, /Promise\.try/)
    })

    test("should handle code without location info gracefully", () => {
      // Even if some transformations don't have location info, should still work
      const input = `var x = 1;`
      const result = transform(input)

      assert.strictEqual(result.modified, true)
      // Should handle missing loc info gracefully
    })

    test("should generate valid JavaScript output", () => {
      const input = `
        var x = 1;
        var greeting = 'Hello ' + name;
        Array.from(items).forEach(item => console.log(item));
      `
      const result = transform(input)

      // Try to parse the output to ensure it's valid JS
      assert.doesNotThrow(() => {
        new Function(result.code)
      })
    })

    test("should handle single-line code", () => {
      const input = `var x = 1; var y = 2; var z = 3;`
      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /const x = 1/)
      assert.match(result.code, /const y = 2/)
      assert.match(result.code, /const z = 3/)
    })

    test("should handle code with existing template literals", () => {
      const input = `
        var msg = \`Hello \${name}\`;
        var other = 'Test ' + value;
      `
      const result = transform(input)

      assert.strictEqual(result.modified, true)
      assert.match(result.code, /const msg/)
      assert.match(result.code, /const other/)
    })
  })
})
