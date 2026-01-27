import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { readyToDOMContentLoaded } from "../../src/jQuery/readyToDOMContentLoaded.js"

suite("jQuery", () => {
  describe("readyToDOMContentLoaded", () => {
    test("transform document.ready", () => {
      const root = j("$(document).ready(function() { console.log('ready') })")
      assert(readyToDOMContentLoaded(root))
      const output = root.toSource()
      assert(output.includes("addEventListener"))
      assert(output.includes("DOMContentLoaded"))
      assert(output.includes("readyState"))
    })

    test("skip when not document", () => {
      const root = j("$(body).ready(handler)")
      assert.equal(readyToDOMContentLoaded(root), false)
      assert.equal(root.toSource(), "$(body).ready(handler)")
    })

    test("skip when not ready method", () => {
      const root = j("$(document).on('click', handler)")
      assert.equal(readyToDOMContentLoaded(root), false)
      assert.equal(root.toSource(), "$(document).on('click', handler)")
    })

    test("transform in expression context wraps in IIFE", () => {
      const root = j("const x = $(document).ready(fn)")
      assert(readyToDOMContentLoaded(root))
      const output = root.toSource()
      // In expression context, should wrap in arrow function IIFE
      assert(
        output.includes("() =>"),
        "should wrap in arrow function for expression context",
      )
    })
  })
})
