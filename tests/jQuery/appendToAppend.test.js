import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { appendToAppend } from "../../src/jQuery/appendToAppend.js"

suite("jQuery", () => {
  describe("appendToAppend", () => {
    test("transform element append with alias", () => {
      const root = j("const el = $(node); el.append(otherNode)")
      assert(appendToAppend(root))
      assert.equal(root.toSource(), "const el = $(node); el.append(otherNode)")
    })

    test("transform string append to innerHTML with alias", () => {
      const root = j("const el = $(node); el.append('text')")
      assert(appendToAppend(root))
      assert.equal(root.toSource(), "const el = $(node); el.innerHTML += 'text'")
    })

    test("skip when no arguments", () => {
      const root = j("const el = $(node); el.append()")
      assert.equal(appendToAppend(root), false)
      assert.equal(root.toSource(), "const el = $(node); el.append()")
    })

    test("skip when not jQuery object", () => {
      const root = j("element.append('text')")
      assert.equal(appendToAppend(root), false)
      assert.equal(root.toSource(), "element.append('text')")
    })

    test("transform direct jQuery call with string", () => {
      const root = j("$('.class').append('text')")
      assert(appendToAppend(root))
      assert.equal(root.toSource(), "$('.class').innerHTML += 'text'")
    })

    test("transform direct jQuery call with element", () => {
      const root = j("$('.class').append(child)")
      assert(appendToAppend(root))
      assert.equal(root.toSource(), "$('.class').append(child)")
    })
  })
})
