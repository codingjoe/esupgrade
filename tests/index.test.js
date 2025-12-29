import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { transform } from "../src/index.js"

describe("transform", () => {
  test("return TransformResult with correct structure", () => {
    const result = transform(`var x = 1;`)
    assert(result.hasOwnProperty("code"), "result has code property")
    assert(result.hasOwnProperty("modified"), "result has modified property")
    assert(result.hasOwnProperty("changes"), "result has changes property")
    assert(typeof result.code === "string", "code is string")
    assert(typeof result.modified === "boolean", "modified is boolean")
    assert(Array.isArray(result.changes), "changes is array")
  })

  test("handle empty string", () => {
    const result = transform(``)
    assert(!result.modified, "modified is false for empty string")
    assert(result.changes.length === 0, "changes length is 0")
    assert(result.code === "", "code is empty")
  })

  test("handle whitespace-only string", () => {
    const result = transform(`   \n\n   `)
    assert(!result.modified, "modified is false for whitespace")
    assert(result.changes.length === 0, "changes length is 0")
  })

  test("handle comments only", () => {
    const result = transform(`// This is a comment\n/* Another comment */`)
    assert(!result.modified, "modified is false for comments")
    assert(result.changes.length === 0, "changes length is 0")
  })

  test("apply multiple transformations and track all changes", () => {
    const result = transform(`
        var x = 1;
        var y = 'Hello ' + name;
        var obj = Object.assign({}, data);
      `)
    assert(result.modified, "modified is true")
    assert(result.changes.length > 0, "changes length greater than 0")
    const changeTypes = result.changes.map((c) => c.type)
    assert(changeTypes.includes("varToLetOrConst"), "changes include varToConst")
    assert.match(result.code, /const/, "code contains const")
    assert.match(result.code, /`Hello/, "code contains template literal")
    assert.match(result.code, /\.\.\.data/, "code contains spread")
  })

  test("aggregate changes from multiple transformers", () => {
    const result = transform(
      `
        var a = 1;
        var b = 'Hello ' + world;
        Array.from(items).forEach(item => console.log(item));
      `,
      "widely-available",
    )
    assert(result.modified, "modified is true")
    assert(
      result.changes.every((c) => c.hasOwnProperty("line")),
      "all changes have line property",
    )
    assert(
      result.changes.every((c) => c.hasOwnProperty("type")),
      "all changes have type property",
    )
  })

  test("use widely-available transformers by default", () => {
    const result = transform(`var x = 1;`)
    assert(result.modified, "modified is true")
    assert(result.changes[0].type === "varToLetOrConst", "first change type is varToConst")
  })

  test("include newly-available transformers when specified", () => {
    const result = transform(
      `
        var x = 1;
        const p = new Promise((resolve) => resolve(getData()));
      `,
      "newly-available",
    )
    assert(result.modified, "modified is true")
    const changeTypes = result.changes.map((c) => c.type)
    assert(changeTypes.includes("varToLetOrConst"), "changes include varToConst")
    assert(changeTypes.includes("promiseTry"), "changes include promiseTry")
  })

  test("handle complex nested structures", () => {
    const result = transform(`
        function test() {
          var result = Object.assign({}, {
            message: 'Hello ' + name
          });
          return result;
        }
      `)
    assert(result.modified, "modified is true")
    assert.match(result.code, /const result/, "code contains const result")
    assert.match(result.code, /\.\.\./, "code contains spread")
    assert.match(result.code, /`Hello/, "code contains template literal")
  })

  test("handle JSX syntax", () => {
    const result = transform(`
        var Component = () => {
          var title = 'Hello ' + name;
          return <div>{title}</div>;
        };
      `)
    assert(result.modified, "modified is true")
    assert.match(result.code, /const/, "code contains const")
    assert.match(result.code, /<div>/, "code contains JSX")
  })

  test("handle TypeScript syntax", () => {
    const result = transform(`
        var x: number = 1;
        const greeting: string = 'Hello ' + name;
      `)
    assert(result.modified, "modified is true")
    assert.match(result.code, /const x: number/, "code contains const x: number")
    assert.match(result.code, /`Hello/, "code contains template literal")
  })

  test("preserve code formatting structure", () => {
    const result = transform(`var x = 1;
var y = 2;`)
    assert.match(result.code, /const x = 1/, "code contains const x = 1")
    assert.match(result.code, /const y = 2/, "code contains const y = 2")
  })

  test("handle very large code", () => {
    const lines = []
    for (let i = 0; i < 100; i++) {
      lines.push(`var x${i} = ${i};`)
    }
    const result = transform(lines.join("\n"))
    assert(result.modified, "modified is true")
    assert(result.changes.length === 100, "changes length is 100")
    assert.match(result.code, /const x0 = 0/, "code contains const x0 = 0")
    assert.match(result.code, /const x99 = 99/, "code contains const x99 = 99")
  })

  test("handle code with special characters", () => {
    const result = transform(`var msg = 'Hello \\n' + 'World\\t!';`)
    assert(result.modified, "modified is true")
    assert.match(result.code, /const msg/, "code contains const msg")
    assert.match(result.code, /`Hello/, "code contains template literal")
  })

  test("handle code with unicode characters", () => {
    const result = transform(`var msg = 'Hello ' + '世界' + '!';`)
    assert(result.modified, "modified is true")
    assert.match(result.code, /const msg/, "code contains const msg")
  })

  test("handle all transformers returning no changes", () => {
    const result = transform(`const x = 1; const y = 2;`)
    assert(!result.modified, "modified is false")
    assert(result.changes.length === 0, "changes length is 0")
  })

  test("handle baseline parameter case sensitivity", () => {
    const result1 = transform(`var x = 1;`, "widely-available")
    assert(result1.modified, "modified is true for widely-available")
    const result2 = transform(`var x = 1;`, "newly-available")
    assert(result2.modified, "modified is true for newly-available")
  })

  test("merge transformers correctly for newly-available", () => {
    const result = transform(
      `
        var x = 1;
        var obj = Object.assign({}, data);
        const p = new Promise((resolve) => resolve(getData()));
      `,
      "newly-available",
    )
    assert(result.modified, "modified is true")
    const changeTypes = result.changes.map((c) => c.type)
    assert(changeTypes.includes("varToLetOrConst"), "changes include varToConst")
    assert(changeTypes.includes("promiseTry"), "changes include promiseTry")
    assert.match(result.code, /const/, "code contains const")
    assert.match(result.code, /\.\.\.data/, "code contains spread")
    assert.match(result.code, /Promise\.try/, "code contains Promise.try")
  })

  test("handle code without location info gracefully", () => {
    const result = transform(`var x = 1;`)
    assert(result.modified, "modified is true")
  })

  test("generate valid JavaScript output", () => {
    const result = transform(`
        var x = 1;
        var greeting = 'Hello ' + name;
        Array.from(items).forEach(item => console.log(item));
      `)
    assert.doesNotThrow(() => {
      new Function(result.code)
    }, "code is valid JavaScript")
  })

  test("handle single-line code", () => {
    const result = transform(`var x = 1; var y = 2; var z = 3;`)
    assert(result.modified, "modified is true")
    assert.match(result.code, /const x = 1/, "code contains const x = 1")
    assert.match(result.code, /const y = 2/, "code contains const y = 2")
    assert.match(result.code, /const z = 3/, "code contains const z = 3")
  })

  test("handle code with existing template literals", () => {
    const result = transform(`
        var msg = \`Hello \${name}\`;
        var other = 'Test ' + value;
      `)
    assert(result.modified, "modified is true")
    assert.match(result.code, /const msg/, "code contains const msg")
    assert.match(result.code, /const other/, "code contains const other")
  })
})

describe("transformers", () => {
  describe("varToLetOrConst", () => {
    test("transform var to const", () => {
      assert(transform(`var x = 1;`).modified)
      assert.match(transform(`var x = 1;`).code, /const/)
    })

    test("transform multiple vars to consts", () => {
      const result = transform(`var x = 1; var y = 2;`)
      assert(result.modified)
      assert.match(result.code, /const x = 1/)
      assert.match(result.code, /const y = 2/)
    })
  })

  describe("stringConcatToTemplate", () => {
    test("transform string concat to template literal", () => {
      const result = transform(`var msg = 'Hello ' + name;`)
      assert(result.modified)
      assert.match(result.code, /const msg/)
      assert.match(result.code, /`Hello/)
    })

    test("transform complex concat to template", () => {
      const result = transform(`var greeting = 'Hello ' + name + '!';`)
      assert(result.modified)
      assert.match(result.code, /const greeting/)
      assert.match(result.code, /`Hello/)
    })
  })

  describe("objectAssignToSpread", () => {
    test("transform Object.assign to spread", () => {
      const result = transform(`var obj = Object.assign({}, data);`)
      assert(result.modified)
      assert.match(result.code, /const obj/)
      assert.match(result.code, /\.\.\.data/)
    })

    test("transform nested Object.assign", () => {
      const result = transform(`var result = Object.assign({}, { message: 'test' });`)
      assert(result.modified)
      assert.match(result.code, /const result/)
      assert.match(result.code, /\.\.\./)
    })
  })

  describe("promiseTry", () => {
    test("transform Promise constructor to Promise.try", () => {
      const result = transform(
        `const p = new Promise((resolve) => resolve(getData()));`,
        "newly-available",
      )
      assert(result.modified)
      assert.match(result.code, /Promise\.try/)
    })

    test("transform Promise with resolve", () => {
      const result = transform(
        `const p = new Promise((resolve) => resolve(data));`,
        "newly-available",
      )
      assert(result.modified)
      assert.match(result.code, /Promise\.try/)
    })
  })
})
