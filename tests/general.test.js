import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../src/index.js"

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

    test("multiple passes until stable", () => {
      const result = transform(
        `$('#test').val(forms.length);`,
        "widely-available",
        true,
      )

      assert(result.modified, "should transform jQuery code")
      assert.match(
        result.code,
        /document\.getElementById\("test"\)\.value/,
        "should fully resolve nested transformations in one run",
      )
      assert(!result.code.includes("$"), "should not have any jQuery left")
    })
  })
})
