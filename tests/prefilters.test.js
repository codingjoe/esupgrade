import assert from "node:assert/strict"
import jscodeshift from "jscodeshift"
import { describe, suite, test } from "node:test"
import { transform } from "../src/index.js"
import * as newlyAvailable from "../src/newlyAvailable.js"
import { matchesPrefilter, prefilters } from "../src/prefilters.js"
import * as widelyAvailable from "../src/widelyAvailable.js"

/**
 * Source sample per transformer. Each sample must trigger its transformer, which
 * proves that the prefilter of the transformer accepts the source text.
 */
const samples = new Map([
  ["anonymousFunctionToArrow", `const f = [1].map(function (n) { return n; });`],
  [
    "argumentsToRestParameters",
    `function f() { const args = Array.from(arguments); return args; }`,
  ],
  ["arrayConcatToSpread", `const a = [1].concat([2]);`],
  ["arrayFilterToFind", `const a = [1, 2].filter((n) => n > 1)[0];`],
  ["arrayFromForEachToForOf", `Array.from([1]).forEach((n) => console.debug(n));`],
  ["arrayFromToSpread", `const a = Array.from(new Set([1]));`],
  ["arraySliceToSpread", `const a = [1, 2].slice();`],
  ["compoundAssignment", `let a = 1; a = a + 2;`],
  ["concatToTemplateLiteral", `const s = "a" + b;`],
  ["consoleLogToInfo", `console.log("a");`],
  [
    "constructorToClass",
    `function C() { this.x = 1; }\nC.prototype.get = function () { return this.x; };`,
  ],
  ["defaultParameterValues", `function f(a) { if (a === undefined) a = 1; return a; }`],
  [
    "errorCauseAssignment",
    `const error = new Error("msg");\nerror.cause = cause;\nthrow error;`,
  ],
  [
    "forLoopToForOf",
    `const arr = [1];\nfor (let i = 0; i < arr.length; i++) { const item = arr[i]; console.debug(item); }`,
  ],
  ["globalContextToGlobalThis", `const w = window;`],
  ["indexOfToIncludes", `const ok = "abc".indexOf("b") !== -1;`],
  ["indexOfToStartsWith", `const ok = "abc".indexOf("a") === 0;`],
  [
    "iterableForEachToForOf",
    `document.querySelectorAll(".item").forEach((item) => { console.debug(item); });`,
  ],
  [
    "lastIndexOfToEndsWith",
    `const ok = "abc".lastIndexOf(suffix) === "abc".length - suffix.length;`,
  ],
  ["logicalAssignment", `let a = 1; a = a || 2;`],
  ["mathPowToExponentiation", `const a = Math.pow(2, 3);`],
  ["namedArrowFunctionToNamedFunction", `const f = () => 1;`],
  [
    "negativeIndexToAt",
    `const last = Array.of(1, 2, 3)[Array.of(1, 2, 3).length - 1];`,
  ],
  ["nullishCoalescingOperator", `const a = b !== null && b !== undefined ? b : 1;`],
  ["numericSeparators", `const n = 100000;`],
  ["objectAssignToSpread", `const o = Object.assign({}, a);`],
  ["objectHasOwn", `const has = Object.prototype.hasOwnProperty.call(obj, "a");`],
  [
    "objectKeysForEachToEntries",
    `Object.keys(obj).forEach((k) => { const v = obj[k]; console.debug(k, v); });`,
  ],
  ["objectKeysMapToValues", `const v = Object.keys(obj).map((k) => obj[k]);`],
  [
    "objectPropertyExtractionToDestructuring",
    `function f(p) { const a = p.a; return a; }`,
  ],
  ["optionalChaining", `const a = obj && obj.prop;`],
  [
    "promiseToAsyncAwait",
    `function f() {\n  return Promise.resolve(1).then((v) => v).catch((e) => e);\n}`,
  ],
  [
    "removeUseStrictFromModules",
    `"use strict";\nimport x from "y";\nexport default x;`,
  ],
  ["replaceAll", `const s = "abc".replace(/b/g, "c");`],
  ["substrToSlice", `const s = "abc".substr(1);`],
  ["substringToStartsWith", `const ok = "abc".substring(0, prefix.length) === prefix;`],
  ["trimLeftRightToTrimStartEnd", `const t = "  a  ".trimLeft();`],
  ["varToLetOrConst", `var a = 1;`],
  ["promiseTry", `const p = new Promise((resolve) => resolve(1));`],
])

const transformers = { ...widelyAvailable, ...newlyAvailable }

/**
 * Transform source code with the prefilters in place.
 *
 * @param {string} code - Source code to transform
 * @param {string} baseline - Baseline level for transformations
 * @returns {string} Transformed code
 */
function runTransform(code, baseline) {
  return transform(code, baseline).code
}

/**
 * Transform source code with every prefilter condition dropped.
 *
 * @param {string} code - Source code to transform
 * @param {string} baseline - Baseline level for transformations
 * @returns {string} Transformed code
 */
function runWithoutPrefilters(code, baseline) {
  const conditions = new Map(prefilters)

  for (const name of prefilters.keys()) {
    prefilters.set(name, [])
  }

  try {
    return runTransform(code, baseline)
  } finally {
    for (const [name, patterns] of conditions) {
      prefilters.set(name, patterns)
    }
  }
}

suite("prefilters", () => {
  describe("coverage", () => {
    test("every transformer has a prefilter", () => {
      for (const name of Object.keys(transformers)) {
        assert(prefilters.has(name), `${name} needs a prefilter`)
      }
    })

    test("every transformer has a sample", () => {
      for (const name of Object.keys(transformers)) {
        assert(samples.has(name), `${name} needs a sample`)
      }
    })
  })

  describe("matchesPrefilter", () => {
    test("rejects source text without the pattern", () => {
      assert(
        !matchesPrefilter("varToLetOrConst", "const a = 1;"),
        "skips absent pattern",
      )
    })

    test("accepts source text with every condition", () => {
      assert(
        matchesPrefilter("forLoopToForOf", "for (let i = 0; i < a.length; i++) a++;"),
        "runs matching text",
      )
    })

    test("rejects source text that misses one condition", () => {
      assert(
        !matchesPrefilter("forLoopToForOf", "for (const a of b) c();"),
        "needs every condition",
      )
    })
  })

  describe("necessary conditions", () => {
    for (const [name, code] of samples) {
      test(`${name} sample triggers its transformer`, () => {
        const root = jscodeshift.withParser("tsx")(code)

        assert(transformers[name](root), `${name} transforms its sample`)
      })

      test(`${name} prefilter keeps the output`, () => {
        for (const baseline of ["widely-available", "newly-available"]) {
          assert.deepEqual(
            runTransform(code, baseline),
            runWithoutPrefilters(code, baseline),
            `${name} sample with ${baseline}`,
          )
        }
      })
    }

    test("keeps the output for mixed legacy sources", () => {
      const source = `
        "use strict";
        var a = 1, b = 2;
        var c;
        c = a;
        function f(p) { var x = p.a, y = p.b; return x + y; }
        for (var i = 0; i < 10; i++) a++;
        const s = "x" + a;
        const o = { "x": 1 };
        const last = [1, 2][a - 1];
        module.exports = { f, s, o, last, b, c };
      `
      for (const baseline of ["widely-available", "newly-available"]) {
        assert.deepEqual(
          runTransform(source, baseline),
          runWithoutPrefilters(source, baseline),
          `mixed source with ${baseline}`,
        )
      }
    })
  })
})
