import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import jscodeshift from "jscodeshift"
import { transform } from "../../src/index.js"
import { unicodePointEscapes } from "../../src/widelyAvailable/unicodePointEscapes.js"

/**
 * Evaluate an expression in the scope of a snippet.
 *
 * @param {string} code - Snippet that declares the bindings the expression uses.
 * @param {string} expression - Expression to evaluate.
 * @returns {unknown} The value the expression evaluates to.
 */
function evaluateValue(code, expression) {
  return new Function(`${code}\nreturn (${expression})`)()
}

suite("widely-available", () => {
  describe("unicodePointEscapes", () => {
    test("transform double-quoted string literals", () => {
      const source = `const emoji = "\\uD83D\\uDE00";`
      const result = transform(source)

      assert(result.modified, "merge the surrogate pair")
      assert.equal(result.code, `const emoji = "\\u{1F600}";`)
      assert.equal(evaluateValue(result.code, "emoji"), evaluateValue(source, "emoji"))
    })

    test("transform single-quoted string literals", () => {
      const source = `const emoji = '\\ud83d\\ude00';`
      const result = transform(source)

      assert(result.modified, "merge the surrogate pair")
      assert.equal(result.code, `const emoji = '\\u{1f600}';`)
      assert.equal(evaluateValue(result.code, "emoji"), evaluateValue(source, "emoji"))
    })

    test("follow the hex case of the leading escape", () => {
      const lowerSource = `const a = "\\ud83d\\uDE00";`
      const upperSource = `const b = "\\uD83D\\ude00";`
      const lowerLead = transform(lowerSource)
      const upperLead = transform(upperSource)

      assert.equal(lowerLead.code, `const a = "\\u{1f600}";`)
      assert.equal(upperLead.code, `const b = "\\u{1F600}";`)
      assert.equal(evaluateValue(lowerLead.code, "a"), evaluateValue(lowerSource, "a"))
      assert.equal(evaluateValue(upperLead.code, "b"), evaluateValue(upperSource, "b"))
    })

    test("transform multiple pairs in one literal", () => {
      const source = `const s = "\\uD83D\\uDE00 \\uD83D\\uDC4B";`
      const result = transform(source)

      assert(result.modified, "merge both pairs")
      assert.equal(result.code, `const s = "\\u{1F600} \\u{1F44B}";`)
      assert.equal(evaluateValue(result.code, "s"), evaluateValue(source, "s"))
    })

    test("transform pairs next to other escapes", () => {
      const source = `const s = "\\n\\uD83D\\uDE00\\x41";`
      const result = transform(source)

      assert(result.modified, "merge the pair")
      assert.equal(result.code, `const s = "\\n\\u{1F600}\\x41";`)
      assert.equal(evaluateValue(result.code, "s"), evaluateValue(source, "s"))
    })

    test("transform template literals", () => {
      const source = "const s = `a\\uD83D\\uDE00b`;"
      const result = transform(source)

      assert(result.modified, "merge the pair")
      assert.equal(result.code, "const s = `a\\u{1F600}b`;")
      assert.equal(evaluateValue(result.code, "s"), evaluateValue(source, "s"))
    })

    test("transform template literals with expressions", () => {
      const source = "const x = 1, y = 2;\nconst s = `a${x}\\uD83D\\uDE00!${y}c`;"
      const result = transform(source)

      assert(result.modified, "merge the pair")
      assert.equal(
        result.code,
        "const x = 1, y = 2;\nconst s = `a${x}\\u{1F600}!${y}c`;",
      )
      assert.equal(evaluateValue(result.code, "s"), evaluateValue(source, "s"))
      assert.equal(evaluateValue(result.code, "s"), "a1\u{1F600}!2c")
    })

    test("transform template literals with empty quasis", () => {
      const source = "const x = 1, y = 2;\nconst s = `${x}\\uD83D\\uDE00${y}`;"
      const result = transform(source)

      assert(result.modified, "merge the pair between expressions")
      assert.equal(result.code, "const x = 1, y = 2;\nconst s = `${x}\\u{1F600}${y}`;")
      assert.equal(evaluateValue(result.code, "s"), evaluateValue(source, "s"))
      assert.equal(evaluateValue(result.code, "s"), "1\u{1F600}2")
    })

    test("skip a quasi ending in an identifier character before an expression", () => {
      const letter = transform("const s = `a${1}\\uD83D\\uDE00b${2}c`;")
      const digit = transform("const s = `a${1}\\uD83D\\uDE009${2}c`;")
      const underscore = transform("const s = `a${1}\\uD83D\\uDE00_${2}c`;")
      const dollar = transform("const s = `a${1}\\uD83D\\uDE00$${2}c`;")
      const upper = transform("const s = `a${1}\\uD83D\\uDE00B${2}c`;")

      assert(!letter.modified, "skip the pair before a letter")
      assert.equal(letter.code, "const s = `a${1}\\uD83D\\uDE00b${2}c`;")
      assert.equal(evaluateValue(letter.code, "s"), "a1\u{1F600}b2c")
      assert(!digit.modified, "skip the pair before a digit")
      assert.equal(digit.code, "const s = `a${1}\\uD83D\\uDE009${2}c`;")
      assert.equal(evaluateValue(digit.code, "s"), "a1\u{1F600}92c")
      assert(!underscore.modified, "skip the pair before an underscore")
      assert.equal(underscore.code, "const s = `a${1}\\uD83D\\uDE00_${2}c`;")
      assert.equal(evaluateValue(underscore.code, "s"), "a1\u{1F600}_2c")
      assert(!dollar.modified, "skip the pair before a dollar")
      assert.equal(dollar.code, "const s = `a${1}\\uD83D\\uDE00$${2}c`;")
      assert.equal(evaluateValue(dollar.code, "s"), "a1\u{1F600}$2c")
      assert(!upper.modified, "skip the pair before an uppercase letter")
      assert.equal(upper.code, "const s = `a${1}\\uD83D\\uDE00B${2}c`;")
      assert.equal(evaluateValue(upper.code, "s"), "a1\u{1F600}B2c")
    })

    test("skip a quasi ending in an escape before an expression", () => {
      const tab = transform("const s = `a${1}\\uD83D\\uDE00\\t${2}c`;")
      const newline = transform("const s = `a${1}\\uD83D\\uDE00\\n${2}c`;")

      assert(!tab.modified, "skip the pair before a tab escape")
      assert.equal(tab.code, "const s = `a${1}\\uD83D\\uDE00\\t${2}c`;")
      assert.equal(evaluateValue(tab.code, "s"), "a1\u{1F600}\t2c")
      assert(!newline.modified, "skip the pair before a newline escape")
      assert.equal(newline.code, "const s = `a${1}\\uD83D\\uDE00\\n${2}c`;")
      assert.equal(evaluateValue(newline.code, "s"), "a1\u{1F600}\n2c")
    })

    test("merge a pair in a tail quasi with a risky ending", () => {
      const source = "const s = `a${1}\\uD83D\\uDE00b`;"
      const result = transform(source)

      assert(result.modified, "merge the pair in the tail quasi")
      assert.equal(result.code, "const s = `a${1}\\u{1F600}b`;")
      assert.equal(evaluateValue(result.code, "s"), evaluateValue(source, "s"))
    })

    test("merge a tail quasi after a skipped head quasi", () => {
      const source = "const s = `a\\uD83D\\uDE00b${2}c\\uD83D\\uDE00`;"
      const result = transform(source)

      assert(result.modified, "merge the pair in the tail quasi")
      assert.equal(result.code, "const s = `a\\uD83D\\uDE00b${2}c\\u{1F600}`;")
      assert.equal(evaluateValue(result.code, "s"), evaluateValue(source, "s"))
      assert.equal(evaluateValue(result.code, "s"), "a\u{1F600}b2c\u{1F600}")
    })

    test("transform newly-available baseline", () => {
      const source = `const emoji = "\\uD83D\\uDE00";`
      const result = transform(source, "newly-available")

      assert(result.modified, "merge the surrogate pair")
      assert.equal(result.code, `const emoji = "\\u{1F600}";`)
      assert.equal(evaluateValue(result.code, "emoji"), evaluateValue(source, "emoji"))
    })

    test("skip lone and reversed surrogate escapes", () => {
      const lead = transform(`const a = "\\uD83D";`)
      const trail = transform(`const b = "\\uDE00";`)
      const reversed = transform(`const c = "\\uDE00\\uD83D";`)

      assert(!lead.modified, "skip the lone leading surrogate")
      assert(!trail.modified, "skip the lone trailing surrogate")
      assert(!reversed.modified, "skip the reversed pair")
    })

    test("skip escaped backslashes", () => {
      const string = transform(`const s = "\\\\uD83D\\\\uDE00";`)
      const template = transform("const s = `\\\\uD83D\\\\uDE00`;")

      assert(!string.modified, "skip the escaped pair in a string")
      assert(!template.modified, "skip the escaped pair in a template")
    })

    test("merge a pair after an escaped backslash", () => {
      const source = `const s = "\\\\\\uD83D\\uDE00";`
      const result = transform(source)

      assert(result.modified, "merge the pair after the escaped backslash")
      assert.equal(result.code, `const s = "\\\\\\u{1F600}";`)
      assert.equal(evaluateValue(result.code, "s"), evaluateValue(source, "s"))
    })

    test("skip code points already written as escapes", () => {
      const codePoint = transform(`const a = "\\u{1F600}";`)
      const halves = transform(`const b = "\\u{D83D}\\u{DE00}";`)

      assert(!codePoint.modified, "skip the existing code point escape")
      assert(!halves.modified, "skip surrogate halves written as code points")
    })

    test("skip tagged templates", () => {
      const result = transform("const s = String.raw`\\uD83D\\uDE00`;")

      assert(!result.modified, "skip the raw text observed through String.raw")
    })

    test("merge an untagged template inside a tagged template", () => {
      const result = transform("const s = tag`a${`b\\uD83D\\uDE00`}c`;")

      assert(result.modified, "merge the pair in the nested template")
      assert.equal(result.code, "const s = tag`a${`b\\u{1F600}`}c`;")
    })

    test("skip JSX attribute values", () => {
      const result = transform(`const el = <div title="\\uD83D\\uDE00" />;`)

      assert(!result.modified, "keep the backslashes in a JSX attribute value")
    })

    test("skip JSX text children", () => {
      const plain = transform(`const el = <div>a\\uD83D\\uDE00b</div>;`)
      const quoted = transform(`const el = <div>"\\uD83D\\uDE00"</div>;`)

      assert(!plain.modified, "keep a plain JSX text child as written")
      assert(!quoted.modified, "keep a quote-delimited JSX text child as written")
    })

    test("transform string values in JSX expression containers", () => {
      const result = transform(`const el = <div title={"\\uD83D\\uDE00"} />;`)

      assert(result.modified, "merge the pair in the expression container")
      assert.equal(result.code, `const el = <div title={"\\u{1F600}"} />;`)
    })

    test("skip non-string literals", () => {
      const result = transform(
        `const n = 1; const b = null; const t = true; const r = /\\uD83D\\uDE00/;`,
      )

      assert(!result.modified, "skip numeric, null, boolean, and regexp literals")
    })

    test("skip bigint literals", () => {
      const result = transform(`const big = 10n;`)

      assert(!result.modified, "skip the bigint literal")
    })

    test("skip code without surrogate pairs", () => {
      const string = transform(`const plain = "hello";`)
      const template = transform("const tpl = `plain ${x}`;")

      assert(!string.modified, "leave a plain string literal alone")
      assert(!template.modified, "leave a template literal without pairs alone")
    })

    test("keep a tab after the opening backtick", () => {
      const result = transform("const t = `\t\\uD83D\\uDE00`;")

      assert(result.modified, "merge the pair after the tab")
      assert.equal(result.code, "const t = `\\t\\u{1F600}`;")
      assert.equal(evaluateValue(result.code, "t"), "\t\u{1F600}")
    })

    test("keep a line-leading tab after a newline", () => {
      const source = "const t = `a\n\tb\\uD83D\\uDE00`;"
      const result = transform(source)

      assert(result.modified, "merge the pair after the tab")
      assert.equal(result.code, "const t = `a\n\\tb\\u{1F600}`;")
      assert.equal(evaluateValue(result.code, "t"), evaluateValue(source, "t"))
      assert.equal(evaluateValue(result.code, "t"), "a\n\tb\u{1F600}")
    })

    test("keep two line-leading tabs", () => {
      const result = transform("const t = `a\n\t\tb\\uD83D\\uDE00`;")

      assert(result.modified, "merge the pair after the tabs")
      assert.equal(result.code, "const t = `a\n\\t\\tb\\u{1F600}`;")
      assert.equal(evaluateValue(result.code, "t"), "a\n\t\tb\u{1F600}")
    })

    test("keep tabs followed by spaces", () => {
      const result = transform("const t = `a\n\t  b\\uD83D\\uDE00`;")

      assert(result.modified, "merge the pair after the indent")
      assert.equal(result.code, "const t = `a\n\\t  b\\u{1F600}`;")
      assert.equal(evaluateValue(result.code, "t"), "a\n\t  b\u{1F600}")
    })

    test("keep a tab after leading spaces", () => {
      const result = transform("const t = `a\n  \tb\\uD83D\\uDE00`;")

      assert(result.modified, "merge the pair after the indent")
      assert.equal(result.code, "const t = `a\n  \\tb\\u{1F600}`;")
      assert.equal(evaluateValue(result.code, "t"), "a\n  \tb\u{1F600}")
    })

    test("keep a line-leading tab in a returned template", () => {
      const source =
        "function f() {\n  return `a\n\tb\\uD83D\\uDE00`;\n}\nconst s = f();"
      const result = transform(source)

      assert(result.modified, "merge the pair in the returned template")
      assert.equal(
        result.code,
        "function f() {\n  return `a\n\\tb\\u{1F600}`;\n}\nconst s = f();",
      )
      assert.equal(evaluateValue(result.code, "s"), "a\n\tb\u{1F600}")
    })

    test("keep the indentation of a statement with an untouched quasi", () => {
      const twoSpaces =
        "function f() {\n  return `a\n\tx${1}\\uD83D\\uDE00`;\n}\nconst s = f();"
      const fourSpaces =
        "function f() {\n    return `a\n\tx${1}\\uD83D\\uDE00`;\n}\nconst s = f();"
      const narrow = transform(twoSpaces)
      const wide = transform(fourSpaces)

      assert(narrow.modified, "merge the pair in the returned template")
      assert.equal(
        narrow.code,
        "function f() {\n  return `a\n\tx${1}\\u{1F600}`;\n}\nconst s = f();",
      )
      assert.equal(evaluateValue(narrow.code, "s"), evaluateValue(twoSpaces, "s"))
      assert(wide.modified, "merge the pair with wider indentation")
      assert.equal(
        wide.code,
        "function f() {\n    return `a\n\tx${1}\\u{1F600}`;\n}\nconst s = f();",
      )
      assert.equal(evaluateValue(wide.code, "s"), evaluateValue(fourSpaces, "s"))
    })

    test("keep a tab after a string line continuation", () => {
      const source = 'const s = "a\\\n\tb\\uD83D\\uDE00";'
      const result = transform(source)

      assert(result.modified, "merge the pair after the continuation")
      assert.equal(result.code, 'const s = "a\\\n\\tb\\u{1F600}";')
      assert.equal(evaluateValue(result.code, "s"), "a\tb\u{1F600}")
    })

    test("keep a mid-line tab", () => {
      const result = transform("const t = `a\tb\\uD83D\\uDE00`;")

      assert(result.modified, "merge the pair")
      assert.equal(result.code, "const t = `a\tb\\u{1F600}`;")
      assert.equal(evaluateValue(result.code, "t"), "a\tb\u{1F600}")
    })

    test("keep leading spaces", () => {
      const result = transform("const t = `a\n  b\\uD83D\\uDE00`;")

      assert(result.modified, "merge the pair")
      assert.equal(result.code, "const t = `a\n  b\\u{1F600}`;")
      assert.equal(evaluateValue(result.code, "t"), "a\n  b\u{1F600}")
    })

    test("keep an author-written tab escape", () => {
      const source = "const t = `a\n\\tb\\uD83D\\uDE00`;"
      const result = transform(source)

      assert(result.modified, "merge the pair after the escape")
      assert.equal(result.code, "const t = `a\n\\tb\\u{1F600}`;")
      assert.equal(evaluateValue(result.code, "t"), evaluateValue(source, "t"))
    })

    test("skip literals without a surrogate pair", () => {
      const template = transform("const t = `a\n\tb`;")
      const string = transform('const s = "a\\\n\tb";')

      assert(!template.modified, "leave a template without a pair alone")
      assert.equal(template.code, "const t = `a\n\tb`;")
      assert(!string.modified, "leave a string without a pair alone")
      assert.equal(string.code, 'const s = "a\\\n\tb";')
    })

    test("skip tagged templates with line-leading tabs", () => {
      const result = transform("const s = String.raw`a\n\tb\\uD83D\\uDE00`;")

      assert(!result.modified, "keep the raw text observed through String.raw")
      assert.equal(result.code, "const s = String.raw`a\n\tb\\uD83D\\uDE00`;")
    })

    test("skip JSX attribute values with tabs", () => {
      const result = transform(`const el = <div title="a\tb\\uD83D\\uDE00" />;`)

      assert(!result.modified, "keep the backslashes in a JSX attribute value")
      assert.equal(result.code, 'const el = <div title="a\tb\\uD83D\\uDE00" />;')
    })

    test("keep the tab of a quasi the merge leaves alone", () => {
      const result = transform("const s = `\n\ta${1}b\\uD83D\\uDE00`;")

      assert(result.modified, "merge the pair in the last quasi")
      assert.equal(result.code, "const s = `\n\ta${1}b\\u{1F600}`;")
      assert.equal(evaluateValue(result.code, "s"), "\n\ta1b\u{1F600}")
    })

    test("keep the source text of an expression with a comment", () => {
      const leading = transform("const s = `a\\uD83D\\uDE00!${/* note */ x}c`;")
      const trailing = transform("const s = `a\\uD83D\\uDE00!${x /* note */}c`;")

      assert(leading.modified, "merge the pair before the leading comment")
      assert.equal(leading.code, "const s = `a\\u{1F600}!${/* note */ x}c`;")
      assert(trailing.modified, "merge the pair before the trailing comment")
      assert.equal(trailing.code, "const s = `a\\u{1F600}!${x /* note */}c`;")
    })

    test("keep expression gaps byte-exact around a merge", () => {
      const spaced = transform("const x = 1; const s = `a\\uD83D\\uDE00!${ x }b`;")
      const padded = transform("const x = 1; const s = `a\\uD83D\\uDE00!${  x  }b`;")
      const parenthesized = transform(
        "const x = 1; const s = `a\\uD83D\\uDE00!${(x  +  1)}b`;",
      )
      const called = transform(
        "function f(a, b) { return a + b; } const x = 1; const s = `a\\uD83D\\uDE00!${ f( (x) , 1 ) }b`;",
      )
      const commented = transform(
        "const x = 1; const s = `a\\uD83D\\uDE00!${/* note */ x}b`;",
      )

      assert.equal(spaced.code, "const x = 1; const s = `a\\u{1F600}!${ x }b`;")
      assert.equal(evaluateValue(spaced.code, "s"), "a\u{1F600}!1b")
      assert.equal(padded.code, "const x = 1; const s = `a\\u{1F600}!${  x  }b`;")
      assert.equal(evaluateValue(padded.code, "s"), "a\u{1F600}!1b")
      assert.equal(
        parenthesized.code,
        "const x = 1; const s = `a\\u{1F600}!${(x  +  1)}b`;",
      )
      assert.equal(evaluateValue(parenthesized.code, "s"), "a\u{1F600}!2b")
      assert.equal(
        called.code,
        "function f(a, b) { return a + b; } const x = 1; const s = `a\\u{1F600}!${ f( (x) , 1 ) }b`;",
      )
      assert.equal(evaluateValue(called.code, "s"), "a\u{1F600}!2b")
      assert.equal(
        commented.code,
        "const x = 1; const s = `a\\u{1F600}!${/* note */ x}b`;",
      )
      assert.equal(evaluateValue(commented.code, "s"), "a\u{1F600}!1b")
    })

    test("merge a parsed literal whose extra raw is missing", () => {
      const j = jscodeshift.withParser("tsx")
      const root = j(`const emoji = "\\uD83D\\uDE00";`)

      root.find(j.StringLiteral).forEach((path) => {
        path.node.extra = undefined
      })

      assert(unicodePointEscapes(root), "read the text from the source")
      assert.equal(root.toSource(), `const emoji = "\\u{1F600}";`)
    })

    test("merge a pair in a template another transformer built", () => {
      const source = 'const x = 5;\nconst s = "a\\uD83D\\uDE00" + x;'
      const result = transform(source)

      assert(result.modified, "merge the pair in the built template")
      assert.equal(result.code, "const x = 5;\nconst s = `a\\u{1F600}${x}`;")
      assert.equal(evaluateValue(result.code, "s"), evaluateValue(source, "s"))
      assert.equal(evaluateValue(result.code, "s"), "a\u{1F600}5")
    })

    test("leave a built search string without source text alone", () => {
      const source = 'const s = "a".replace(/x/g, "b");'
      const result = transform(source)

      assert(result.modified, "rewrite the call to replaceAll")
      assert.equal(result.code, 'const s = "a".replaceAll("x", "b");')
      assert.equal(evaluateValue(result.code, "s"), evaluateValue(source, "s"))
    })

    test("leave transformed output alone on a second pass", () => {
      const merged = transform("const s = `a\\uD83D\\uDE00b`;")
      const skipped = transform("const s = `a${1}\\uD83D\\uDE00b${2}c`;")
      const gap = transform("const s = `a\\uD83D\\uDE00!${ x }b`;")
      const tab = transform("const t = `a\n\tb\\uD83D\\uDE00`;")
      const attribute = transform(`const el = <div title="a\tb\\uD83D\\uDE00" />;`)
      const typescript = transform("const s: string = `a\\uD83D\\uDE00b`;")

      assert(merged.modified, "merge the pair on the first pass")
      assert(!transform(merged.code).modified, "leave the merged quasi alone")
      assert(!transform(skipped.code).modified, "leave the skipped quasi alone")
      assert(!transform(gap.code).modified, "leave the expression gap alone")
      assert(tab.modified, "merge the pair after the tab on the first pass")
      assert(!transform(tab.code).modified, "leave the tab shape alone")
      assert(!transform(attribute.code).modified, "leave the JSX attribute value alone")
      assert(!transform(typescript.code).modified, "leave the TypeScript source alone")
    })
  })
})
