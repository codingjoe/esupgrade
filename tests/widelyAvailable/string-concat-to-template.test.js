import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"
import { NodeTest } from "../../src/types.js"

suite("widely-available", () => {
  describe("stringConcatToTemplate", () => {
    test("string concatenation", () => {
      const result = transform(`const greeting = 'Hello ' + name + '!';`)

      assert(result.modified, "transform string concatenation")
      assert.match(result.code, /`Hello \$\{name\}!`/)
    })

    test("multiple concatenations", () => {
      const result = transform(
        `const msg = 'Hello ' + firstName + ' ' + lastName + '!';`,
      )

      assert(result.modified, "transform multiple concatenations")
      assert.match(result.code, /`Hello \$\{firstName\} \$\{lastName\}!`/)
    })

    test("starting with expression", () => {
      const result = transform(`const msg = prefix + ' world';`)

      assert(result.modified, "transform concatenation starting with expression")
      assert.match(result.code, /`\$\{prefix\} world`/)
    })

    test("only expressions", () => {
      const result = transform(`const msg = a + b + c;`)

      assert(!result.modified, "skip concatenation with only expressions")
    })

    test("ending with expression", () => {
      const result = transform(`const msg = 'Value: ' + value;`)

      assert(result.modified, "transform concatenation ending with expression")
      assert.match(result.code, /`Value: \$\{value\}`/)
    })

    test("complex nested", () => {
      const result = transform(`const msg = 'Start ' + (a + 'middle') + ' end';`)

      assert(result.modified, "transform complex nested concatenation")
      assert.match(result.code, /`/)
    })

    test("numeric addition followed by string", () => {
      const result = transform(`cal_box.style.left = findPosX(cal_link) + 17 + 'px';`)

      assert(
        result.modified,
        "transform numeric addition followed by string concatenation",
      )
      assert.match(result.code, /`\$\{findPosX\(cal_link\) \+ 17\}px`/)
    })

    test("multiple numeric additions followed by string", () => {
      const result = transform(`const result = a + b + c + 'd';`)

      assert(
        result.modified,
        "transform multiple numeric additions followed by string concatenation",
      )
      assert.match(result.code, /`\$\{a \+ b \+ c\}d`/)
    })

    test("string followed by numeric addition", () => {
      const result = transform(`const result = 'Value: ' + x + y;`)

      assert(
        result.modified,
        "transform string concatenation followed by numeric addition",
      )
      assert.match(result.code, /`Value: \$\{x\}\$\{y\}`/)
    })

    test("numeric addition in middle", () => {
      const result = transform(`const result = 'start' + (a + b) + 'end';`)

      assert(result.modified, "transform numeric addition in middle of concatenations")
      assert.match(result.code, /`start\$\{(\()?a \+ b(\))?\}end`/)
    })

    test("consecutive string literals", () => {
      const result = transform(`const msg = 'Hello' + ' ' + 'world';`)

      assert(result.modified, "merge consecutive string literals")
      assert.match(result.code, /`Hello world`/)
    })

    test("string literal followed by expression", () => {
      const result = transform(`const msg = 'Value: ' + getValue();`)

      assert(result.modified, "transform string literal followed by expression")
      assert.match(result.code, /`Value: \$\{getValue\(\)\}`/)
    })

    test("expression followed by string literal", () => {
      const result = transform(`const msg = getValue() + ' is the value';`)

      assert(result.modified, "transform expression followed by string literal")
      assert.match(result.code, /`\$\{getValue\(\)\} is the value`/)
    })

    test("expression in middle", () => {
      const result = transform(`const msg = 'start' + getValue() + 'end';`)

      assert(result.modified, "transform expression in middle")
      assert.match(result.code, /`start\$\{getValue\(\)\}end`/)
    })

    test("preserves escape sequences in regex", () => {
      const result = transform(
        `const id_regex = new RegExp("(" + prefix + "-(\\\\d+|__prefix__))");`,
      )

      assert(result.modified, "transform and preserve escape sequences")
      assert.match(result.code, /`\(\$\{prefix\}-\(\\\\d\+\|__prefix__\)\)`/)
      assert.ok(result.code.includes("\\\\d"), "preserve \\\\d escape sequence")
    })

    test("preserves newline escapes", () => {
      // Use single backslash which represents the escape sequence in source code
      const result = transform('const str = "Line 1\\n" + "Line 2";')

      assert(result.modified, "transform and convert \\n to actual newline")
      // \n should become an actual newline in template literal
      assert.ok(result.code.includes("\n"), "\\n should become actual newline")
      assert.match(
        result.code,
        /`Line 1\nLine 2`/,
        "should have template literal with newline",
      )
    })

    test("preserves carriage return and newline escapes", () => {
      // Use single backslash which represents the escape sequence in source code
      const result = transform('const a = "foo\\r\\n" + "bar"')

      assert(
        result.modified,
        "transform and preserve \\r escape, convert \\n to newline",
      )
      assert.ok(result.code.includes("\\r"), "preserve \\r escape sequence")
      // \n should become an actual newline in template literal
      assert.ok(result.code.includes("\n"), "\\n should become actual newline")
      // Should match `foo\r<newline>bar` pattern
      assert.match(
        result.code,
        /`foo\\r\nbar`/,
        "output should be template literal with \\r escape and actual newline",
      )
    })

    test("regression: no extra backslash with \\r\\n on multiline concatenation", () => {
      // Regression test for issue #94
      // When "foo\r\n" + "bar" spans multiple lines, the \n at the end of the first string
      // should prevent adding a line continuation backslash
      const result = transform(`const myVar = "foo\\r\\n" +
              "bar"`)

      assert(result.modified, "transform multiline concatenation with \\r\\n")
      assert.ok(result.code.includes("\\r"), "preserve \\r escape sequence")
      // \n should become an actual newline in template literal
      assert.ok(result.code.includes("\n"), "\\n should become actual newline")
      // Should NOT have an extra backslash after the newline
      assert.match(
        result.code,
        /`foo\\r\nbar`/,
        "should not have extra line continuation after \\n",
      )
      // Verify no double backslash or extra continuation
      assert.ok(
        !result.code.includes("\\\n\\\n"),
        "should not have double line continuation",
      )
    })

    test("preserves multiline formatting with line continuation", () => {
      const result = transform(`const myVar = "foo" +
              "bar"`)

      assert(result.modified, "transform multiline concatenation")
      assert.match(
        result.code,
        /`foo\\\nbar`/,
        "should have line continuation backslash",
      )
    })

    test("preserves multiline formatting with multiple strings", () => {
      const result = transform(`const myVar = "foo" +
              "bar" +
              "baz"`)

      assert(result.modified, "transform multiline concatenation with multiple strings")
      // Should have two line continuations
      assert.match(result.code, /`foo\\\nbar\\\nbaz`/, "should have line continuations")
    })

    test("single line concatenation has no line continuation", () => {
      const result = transform(`const myVar = "foo" + "bar"`)

      assert(result.modified, "transform single line concatenation")
      assert.match(result.code, /`foobar`/, "should not have line continuation")
      assert.ok(!result.code.includes("\\"), "should not have backslash")
    })

    test("preserves tab escapes", () => {
      const result = transform(`const str = "Tab\\\\t" + value + "\\\\t";`)

      assert(result.modified, "transform and preserve tab escapes")
      assert.ok(result.code.includes("\\\\t"), "preserve \\\\t escape sequence")
    })

    test("escapes backticks", () => {
      const result = transform(`const str = '\`' + myvar + '\` something';`)

      assert(result.modified, "transform and escape backticks")
      assert.match(result.code, /`\\`\$\{myvar\}\\` something`/)
    })

    test("escapes backtick at start", () => {
      const result = transform(`const str = '\`hello' + myvar;`)

      assert(result.modified, "transform and escape backtick at start")
      assert.match(result.code, /`\\`hello\$\{myvar\}`/)
    })

    test("escapes backtick at end", () => {
      const result = transform(`const str = myvar + 'world\`';`)

      assert(result.modified, "transform and escape backtick at end")
      assert.match(result.code, /`\$\{myvar\}world\\``/)
    })

    test("escapes multiple backticks", () => {
      const result = transform(`const str = '\`a\`' + myvar + '\`b\`';`)

      assert(result.modified, "transform and escape multiple backticks")
      assert.match(result.code, /`\\`a\\`\$\{myvar\}\\`b\\``/)
    })

    test("escapes dollar-brace", () => {
      const result = transform(`const str = 'Price: \${10}' + myvar;`)

      assert(result.modified, "transform and escape dollar-brace")
      assert.match(result.code, /`Price: \\\$\{10\}\$\{myvar\}`/)
    })

    test("escapes complex dollar-brace pattern", () => {
      const result = transform(`const str = 'Template: \${name}' + myvar + ' end';`)

      assert(result.modified, "transform and escape complex dollar-brace")
      assert.match(result.code, /`Template: \\\$\{name\}\$\{myvar\} end`/)
    })

    test("preserves dollar sign without brace", () => {
      const result = transform(`const str = 'Price: $10' + myvar;`)

      assert(result.modified, "transform but don't escape lone dollar")
      assert.match(result.code, /`Price: \$10\$\{myvar\}`/)
      assert.doesNotMatch(result.code, /\\\$10/)
    })

    test("escapes all special characters together", () => {
      const result = transform(`const str = '\\\\ \` \${x}' + myvar;`)

      assert(result.modified, "transform and escape all special chars")
      // Input: '\\' (one backslash), '`' (one backtick), '${x}' (dollar-brace)
      // Output: `\\` (one backslash), `\`` (escaped backtick), `\${x}` (escaped dollar-brace)
      // In result.code string: \\ (2 chars), \` (2 chars), \${ (3 chars)
      assert.ok(result.code.includes("\\\\"))
      assert.ok(result.code.includes("\\`"))
      assert.ok(result.code.includes("\\${"))
    })

    test("fallback when extra.raw is missing", () => {
      // Test NodeTest.getRawStringValue() fallback for nodes without extra.raw.
      // Exercise fallback behavior for nodes that lack extra.raw without going through transform.
      const mockNode = {
        type: "Literal",
        value: "hello\nworld",
      }

      const nodeTest = new NodeTest(mockNode)
      const result = nodeTest.getRawStringValue()

      // Should use fallback and keep newline as actual newline (result should be "hello\nworld" with actual newline)
      assert.ok(result.includes("\n"), "should have actual newline")
      assert.equal(result, "hello\nworld")
    })

    test("fallback escapes special chars", () => {
      // Test that fallback path properly escapes backticks and ${
      const mockNode = {
        type: "Literal",
        value: "test`${value}",
      }

      const nodeTest = new NodeTest(mockNode)
      const result = nodeTest.getRawStringValue()

      assert.ok(result.includes("\\`"), "should escape backticks in fallback")
      assert.ok(result.includes("\\${"), "should escape dollar-brace in fallback")
    })
  })
})
