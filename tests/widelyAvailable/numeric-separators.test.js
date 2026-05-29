import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import jscodeshift from "jscodeshift"
import { transform } from "../../src/index.js"
import { numericSeparators } from "../../src/widelyAvailable/numericSeparators.js"

suite("widely-available", () => {
  describe("numeric separators", () => {
    test("transform decimal integer literals", () => {
      const result = transform(`const budget = 1000000;`)

      assert.match(result.code, /1_000_000/)
      assert(result.modified)
    })

    test("transform negative decimal integer literals", () => {
      const result = transform(`const debt = -1000000;`)

      assert.match(result.code, /-1_000_000/)
      assert(result.modified)
    })

    test("transform bigint literals", () => {
      const result = transform(`const maxUsers = 1000000n;`)

      assert.match(result.code, /1_000_000n/)
      assert(result.modified)
    })

    test("transform newly-available baseline", () => {
      const result = transform(`const budget = 1000000;`, "newly-available")

      assert.match(result.code, /1_000_000/)
      assert(result.modified)
    })

    test("skip short and formatted literals", () => {
      const result = transform(`const year = 2025; const budget = 1_000_000;`)

      assert(!result.modified)
    })

    test("skip non-decimal literals", () => {
      const result = transform(
        `const hexMask = 0xabcdef; const exponent = 1e12; const ratio = 10000.25;`,
      )

      assert(!result.modified)
    })

    test("skip literals without raw source text", () => {
      const j = jscodeshift.withParser("tsx")
      const root = j(`const budget = 1000000;`)

      root.find(j.NumericLiteral).forEach((path) => {
        path.node.extra = undefined
      })

      assert(!numericSeparators(root))
    })
  })
})
