import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("arrayCopyToImmutableMethod", () => {
    describe("transformable patterns", () => {
      test("spread copy of an array literal", () => {
        const result = transform(`const sorted = [...[3, 1, 2]].sort((a, b) => a - b);`)

        assert(result.modified, "transform spread copy of an array literal")
        assert.equal(result.code, `const sorted = [3, 1, 2].toSorted((a, b) => a - b);`)
      })

      test("reversed spread copy", () => {
        const result = transform(`const reversed = [...[1, 2, 3]].reverse();`)

        assert(result.modified, "transform reversed spread copy")
        assert.equal(result.code, `const reversed = [1, 2, 3].toReversed();`)
      })

      test("slice() copy", () => {
        const result = transform(`const sorted = [1, 2, 3].slice().sort();`)

        assert(result.modified, "transform slice() copy")
        assert.equal(result.code, `const sorted = [1, 2, 3].toSorted();`)
      })

      test("slice(0) copy", () => {
        const result = transform(`const sorted = [1, 2, 3].slice(0).sort();`)

        assert(result.modified, "transform slice(0) copy")
        assert.equal(result.code, `const sorted = [1, 2, 3].toSorted();`)
      })

      test("new Array() receiver", () => {
        const result = transform(`const copy = [...new Array(3)].reverse();`)

        assert(result.modified, "transform new Array() receiver")
        assert.equal(result.code, `const copy = new Array(3).toReversed();`)
      })

      test("Array.from() receiver", () => {
        const result = transform(`[...Array.from(items)].sort();`)

        assert(result.modified, "transform Array.from() receiver")
        assert.equal(result.code, `[...items].toSorted();`)
      })

      test("Array.from() receiver with a mapping function", () => {
        const result = transform(
          `const copy = Array.from(items, mapFn).slice();
copy.sort();`,
        )

        assert(result.modified, "transform Array.from() with a mapping function")
        assert.equal(result.code, `const copy = Array.from(items, mapFn).toSorted();`)
      })

      test("Array.of() receiver", () => {
        const result = transform(`Array.of(3, 1, 2).slice().sort();`)

        assert(result.modified, "transform Array.of() receiver")
        assert.equal(result.code, `Array.of(3, 1, 2).toSorted();`)
      })

      test("array method chain receivers", () => {
        const cases = [
          ["slice", `[...Array.of(1, 2).slice()].sort();`],
          ["concat", `[...Array.of(1, 2).concat()].sort();`],
          ["map", `[...Array.of(1, 2).map(fn)].sort();`],
          ["filter", `[...Array.of(1, 2).filter(Boolean)].sort();`],
          ["flat", `[...Array.of(1, 2).flat()].sort();`],
          ["flatMap", `[...Array.of(1, 2).flatMap(fn)].sort();`],
          ["reverse", `[...Array.of(1, 2).reverse()].sort();`],
          ["sort", `[...Array.of(1, 2).sort()].sort();`],
          ["splice", `[...Array.of(1, 2).splice(0)].sort();`],
        ]

        for (const [method, code] of cases) {
          assert(
            transform(code).modified,
            `transform .${method}() array chain receiver`,
          )
        }
      })

      test("copy to a variable", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
copy.sort();`,
        )

        assert(result.modified, "transform copy to a variable")
        assert.equal(result.code, `const copy = Array.of(1, 2).toSorted();`)
      })

      test("copy to a variable with a comparator", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
copy.sort(compare);`,
        )

        assert(result.modified, "transform copy sort with a comparator")
        assert.equal(result.code, `const copy = Array.of(1, 2).toSorted(compare);`)
      })

      test("reversed copy to a variable", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
copy.reverse();`,
        )

        assert(result.modified, "transform reversed copy to a variable")
        assert.equal(result.code, `const copy = Array.of(1, 2).toReversed();`)
      })

      test("spliced copy to a variable", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
copy.splice(1, 2);`,
        )

        assert(result.modified, "transform spliced copy to a variable")
        assert.equal(result.code, `const copy = Array.of(1, 2).toSpliced(1, 2);`)
      })

      test("splice arguments are forwarded", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
copy.splice(0, other);`,
        )

        assert(result.modified, "transform splice with a non-copy argument")
        assert.equal(result.code, `const copy = Array.of(1, 2).toSpliced(0, other);`)
      })

      test("slice() copy to a variable", () => {
        const result = transform(
          `const copy = Array.of(1, 2).slice();
copy.reverse();`,
        )

        assert(result.modified, "transform slice() copy to a variable")
        assert.equal(result.code, `const copy = Array.of(1, 2).toReversed();`)
      })

      test("slice(0) copy to a let variable", () => {
        const result = transform(
          `let copy = [1, 2, 3].slice(0);
copy.sort();`,
        )

        assert(result.modified, "transform slice(0) copy to a let variable")
        assert.equal(result.code, `let copy = [1, 2, 3].toSorted();`)
      })

      test("copy and mutator in a block", () => {
        const result = transform(
          `if (enabled) { const copy = [...Array.of(1, 2)]; copy.sort(); }`,
        )

        assert(result.modified, "transform copy and mutator in a block")
        assert.equal(
          result.code,
          `if (enabled) {
  const copy = Array.of(1, 2).toSorted();
}`,
        )
      })

      test("optional mutator call", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
copy?.sort();`,
        )

        assert(result.modified, "transform optional mutator call")
        assert.equal(result.code, `const copy = Array.of(1, 2).toSorted();`)
      })

      test("optional sort call on a spread copy", () => {
        const result = transform(`[...Array.of(1, 2)]?.sort();`)

        assert(result.modified, "transform optional sort call")
        assert.equal(result.code, `Array.of(1, 2).toSorted();`)
      })
    })

    describe("skip patterns", () => {
      test("expression-form splice statement", () => {
        const result = transform(`[...Array.of(1, 2)].splice(1, 2);`)

        assert(!result.modified, "skip expression-form splice")
      })

      test("expression-form splice with a used result", () => {
        const result = transform(`const removed = [...Array.of(1, 2)].splice(1, 2);`)

        assert(!result.modified, "skip splice whose result is used")
      })

      test("mutating call without a copy", () => {
        const result = transform(`Array.of(1, 2).sort();`)

        assert(!result.modified, "skip sort without a copy")
      })

      test("mutating call on an unknown identifier", () => {
        const result = transform(`arr.reverse();`)

        assert(!result.modified, "skip reverse on an unknown identifier")
      })

      test("spread copy of an unknown identifier", () => {
        const result = transform(`[...arr].sort();`)

        assert(!result.modified, "skip spread copy of an unknown identifier")
      })

      test("slice() copy of an unknown identifier", () => {
        const result = transform(`arr.slice().sort();`)

        assert(!result.modified, "skip slice() copy of an unknown identifier")
      })

      test("variable declaration initialised from an unknown identifier", () => {
        const result = transform(
          `const copy = arr;
copy.sort();`,
        )

        assert(!result.modified, "skip declaration from an unknown identifier")
      })

      test("spread copy of an unknown identifier chain", () => {
        const result = transform(`[...arr.map(fn)].sort();`)

        assert(!result.modified, "skip spread copy of an unknown chain")
      })

      test("arguments object", () => {
        const result = transform(`[...arguments].sort();`)

        assert(!result.modified, "skip arguments object")
      })

      test("string literal", () => {
        const result = transform(`const sorted = [..."abc"].sort();`)

        assert(!result.modified, "skip string literal")
      })

      test("template literal", () => {
        const result = transform("const sorted = [...`abc`].sort();")

        assert(!result.modified, "skip template literal")
      })

      test("Array.isArray() result", () => {
        const result = transform(`[...Array.isArray(value)].sort();`)

        assert(!result.modified, "skip Array.isArray() result")
      })

      test("computed copy method on a spread copy", () => {
        const result = transform(`[...Array.of(1, 2)][sort]();`)

        assert(!result.modified, "skip computed copy method on a spread copy")
      })

      test("computed slice call on an array chain", () => {
        const result = transform(
          `const copy = Array.of(1, 2).concat()[slice]();
copy.sort();`,
        )

        assert(!result.modified, "skip computed slice call on an array chain")
      })

      test("computed member call", () => {
        const result = transform(`[...Array.of(1, 2)[map]()].sort();`)

        assert(!result.modified, "skip computed member call")
      })

      test("computed copy method", () => {
        const result = transform(`Array.of(1, 2)["sort"]();`)

        assert(!result.modified, "skip computed copy method")
      })

      test("array method not returning an array", () => {
        const result = transform(`[...Array.of(1, 2).join()].sort();`)

        assert(!result.modified, "skip array method not returning an array")
      })

      test("call expression receiver", () => {
        const result = transform(`[...createArray()].sort();`)

        assert(!result.modified, "skip call expression receiver")
      })

      test("private method call", () => {
        const result = transform(
          `class Holder { #items() {} sort(x) { return [...x.#items()].sort(); } }`,
        )

        assert(!result.modified, "skip private method call")
      })

      test("private copy method", () => {
        const result = transform(
          `class Holder { #slice() {} sort(x) { const copy = x.#slice(); copy.sort(); } }`,
        )

        assert(!result.modified, "skip private copy method")
      })

      test("slice with a start offset", () => {
        const result = transform(`Array.of(1, 2, 3).slice(1).sort();`)

        assert(!result.modified, "skip slice with a start offset")
      })

      test("slice with start and end", () => {
        const result = transform(`Array.of(1, 2, 3).slice(0, 2).sort();`)

        assert(!result.modified, "skip slice with start and end")
      })

      test("slice with a variable offset", () => {
        const result = transform(`Array.of(1, 2, 3).slice(offset).sort();`)

        assert(!result.modified, "skip slice with a variable offset")
      })

      test("spread copy with an extra element", () => {
        const result = transform(`[...[1, 2], 3].sort();`)

        assert(!result.modified, "skip spread copy with an extra element")
      })

      test("array literal without a spread", () => {
        const result = transform(`[first].sort();`)

        assert(!result.modified, "skip array literal without a spread")
      })

      test("empty array literal", () => {
        const result = transform(`[].sort();`)

        assert(!result.modified, "skip empty array literal")
      })

      test("declaration not immediately preceding", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
doNothing();
copy.sort();`,
        )

        assert(!result.modified, "skip declaration not immediately preceding")
      })

      test("declaration with several declarators", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)], other = 1;
copy.sort();`,
        )

        assert(!result.modified, "skip declaration with several declarators")
      })

      test("destructured declaration", () => {
        const result = transform(
          `const [copy] = [...Array.of(1, 2)];
copy.sort();`,
        )

        assert(!result.modified, "skip destructured declaration")
      })

      test("argument referencing the copy", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
copy.splice(0, copy.length);`,
        )

        assert(!result.modified, "skip argument referencing the copy")
      })

      test("argument equal to the copy", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
copy.splice(0, copy);`,
        )

        assert(!result.modified, "skip argument equal to the copy")
      })

      test("spread argument referencing the copy", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
copy.splice(...copy);`,
        )

        assert(!result.modified, "skip spread argument referencing the copy")
      })

      test("mutator as a for loop body", () => {
        const result = transform(`for (let i = 0; i < 2; i++) copy.sort();`)

        assert(!result.modified, "skip mutator as a for loop body")
      })

      test("mutator as a labeled statement", () => {
        const result = transform(`loop: copy.sort();`)

        assert(!result.modified, "skip mutator as a labeled statement")
      })

      test("mutator result assigned to a variable", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
const sorted = copy.sort();`,
        )

        assert(!result.modified, "skip mutator result assigned to a variable")
      })

      test("mutator nested in a call argument", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
consume(copy.sort());`,
        )

        assert(!result.modified, "skip mutator nested in a call argument")
      })

      test("mutator without a preceding declaration", () => {
        const result = transform(`copy.sort();`)

        assert(!result.modified, "skip mutator without a preceding declaration")
      })

      test("declaration for another variable", () => {
        const result = transform(
          `const other = [...Array.of(1, 2)];
copy.sort();`,
        )

        assert(!result.modified, "skip declaration for another variable")
      })

      test("declaration initialised from a call", () => {
        const result = transform(
          `const copy = createArray();
copy.sort();`,
        )

        assert(!result.modified, "skip declaration initialised from a call")
      })

      test("declaration initialised from a computed slice call", () => {
        const result = transform(
          `const copy = source["slice"]();
copy.sort();`,
        )

        assert(!result.modified, "skip declaration initialised from a computed call")
      })

      test("declaration initialised from a non-copy call", () => {
        const result = transform(
          `const copy = Array.of(1, 2).join();
copy.sort();`,
        )

        assert(!result.modified, "skip declaration initialised from a non-copy call")
      })

      test("assignment statement after a copy declaration", () => {
        const result = transform(
          `let copy = [...Array.of(1, 2)];
copy = other;`,
        )

        assert(!result.modified, "skip assignment statement after a copy declaration")
      })

      test("non-copy method on the copy", () => {
        const result = transform(
          `const copy = [...Array.of(1, 2)];
copy.join();`,
        )

        assert(!result.modified, "skip non-copy method on the copy")
      })
    })
  })
})
