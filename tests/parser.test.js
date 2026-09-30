import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../src/index.js"
import { parseTypeScript } from "../src/parser.js"

suite("parser", () => {
  describe("parseTypeScript", () => {
    test("parse ambient const declaration", () => {
      const ast = parseTypeScript("export const program: Command;")

      assert.equal(ast.type, "File", "parse a Babel file node")
      assert.equal(ast.program.body.length, 1, "parse the whole declaration")
    })

    test("parse ambient const declaration in a namespace", () => {
      const ast = parseTypeScript("export namespace N { const x: number; }")

      assert.equal(ast.program.body.length, 1, "parse the typed ambient const")
    })

    test("report standard context error when both contexts fail", () => {
      assert.throws(
        () => parseTypeScript("export const a: A;\nconst 1x = 2;"),
        /Missing initializer in const declaration/,
        "report the error of the standard context",
      )
    })
  })

  describe("transform", () => {
    test("leave ambient const declaration unchanged", () => {
      const result = transform("export const program: Command;")

      assert(!result.modified, "keep declaration files unchanged")
      assert.equal(result.code, "export const program: Command;")
    })

    test("transform the understood parts of a declaration file", () => {
      const result = transform(
        "export const program: Command;\nconst timeout = 1000000;",
      )

      assert(result.modified, "transform literal bindings of declaration files")
      assert.match(result.code, /const timeout = 1_000_000/)
      assert.match(result.code, /export const program: Command;/)
    })

    test("transform source files in the standard context", () => {
      const result = transform("var x = 1;")

      assert(result.modified, "transform var declarations")
      assert.match(result.code, /const x = 1/)
    })
  })
})
