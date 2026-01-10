import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
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
})
