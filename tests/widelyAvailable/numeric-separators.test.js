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

    test("skip non-integer literals", () => {
      const result = transform(
        `const exponent = 1e12; const ratio = 10000.25;`,
      )

      assert(!result.modified)
    })

    test("transform hex literals", () => {
      const result = transform(`const mask = 0xabcdef;`)

      assert.match(result.code, /0xab_cd_ef/)
      assert(result.modified)
    })

    test("transform uppercase hex literals", () => {
      const result = transform(`const mask = 0xABCDEF;`)

      assert.match(result.code, /0xAB_CD_EF/)
      assert(result.modified)
    })

    test("transform hex literals with odd digit count", () => {
      const result = transform(`const mask = 0xabcde;`)

      assert.match(result.code, /0xa_bc_de/)
      assert(result.modified)
    })

    test("transform hex bigint literals", () => {
      const result = transform(`const id = 0xabcdefn;`)

      assert.match(result.code, /0xab_cd_efn/)
      assert(result.modified)
    })

    test("skip short hex literals", () => {
      const result = transform(`const byte = 0xff;`)

      assert(!result.modified)
    })

    test("skip already formatted hex literals", () => {
      const result = transform(`const mask = 0xab_cd_ef;`)

      assert(!result.modified)
    })

    test("transform binary literals", () => {
      const result = transform(`const flags = 0b1010000111000011;`)

      assert.match(result.code, /0b10100001_11000011/)
      assert(result.modified)
    })

    test("transform binary literals with partial leading byte", () => {
      const result = transform(`const flags = 0b100000001;`)

      assert.match(result.code, /0b1_00000001/)
      assert(result.modified)
    })

    test("transform binary bigint literals", () => {
      const result = transform(`const flags = 0b1010000111000011n;`)

      assert.match(result.code, /0b10100001_11000011n/)
      assert(result.modified)
    })

    test("skip short binary literals", () => {
      const result = transform(`const byte = 0b11111111;`)

      assert(!result.modified)
    })

    test("skip already formatted binary literals", () => {
      const result = transform(`const flags = 0b10100001_11000011;`)

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
