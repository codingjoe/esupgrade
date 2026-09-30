import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import { transform } from "../src/index.js"

const DISPOSABLE_DECLARATION_KINDS = new Set(["using", "await using"])

const samples = [
  {
    name: "named arrow function assignment",
    code: `using resource = () => 1; const create = () => 2;`,
    expected: [/using resource = \(\) => 1/, /function create\(\)/],
  },
  {
    name: "awaited named arrow function assignment",
    code: `async function load() { await using resource = async () => 1; const create = async () => 1; return [resource, create]; }`,
    expected: [/await using resource = async \(\) => 1/, /async function create\(\)/],
  },
  {
    name: "destructured parameter extraction",
    code: `function load(param) { using value = param.value; return value; }`,
    expected: [/function load\(param\)/, /using value = param\.value/],
  },
  {
    name: "mixed destructured parameter extraction",
    code: `function load(param, other) { const value = param.value; using resource = other.resource; return value; }`,
    expected: [
      /function load\(\s*\{\s*value\s*\},\s*other\s*\)/,
      /using resource = other\.resource/,
    ],
  },
  {
    name: "awaited destructured parameter extraction",
    code: `async function load(param) { await using value = param.value; return value; }`,
    expected: [/function load\(param\)/, /await using value = param\.value/],
  },
  {
    name: "constructor declaration",
    code: `using Person = function () { this.name = name; }; Person.prototype.greet = function () { return this.name; };`,
    expected: [/using Person = function/, /Person\.prototype\.greet = function/],
  },
  {
    name: "error cause assignment",
    code: `using error = new Error("msg"); error.cause = cause; throw error;`,
    expected: [/using error = new Error\("msg"\)/, /error\.cause = cause/],
  },
  {
    name: "awaited error cause assignment",
    code: `async function load(cause) { await using error = new Error("msg"); error.cause = cause; throw error; }`,
    expected: [/await using error = new Error\("msg"\)/, /error\.cause = cause/],
  },
  {
    name: "arguments object",
    code: `function fn() { using args = Array.from(arguments); return args; }`,
    expected: [/function fn\(\)/, /using args = \[\.\.\.arguments\]/],
  },
  {
    name: "entries conversion",
    code: `Object.keys(obj).forEach(function (key) { using value = obj[key]; process(value); });`,
    expected: [/using value = obj\[key\]/, /process\(value\)/],
  },
  {
    name: "for loop conversion",
    code: `for (let index = 0; index < items.length; index++) { using item = items[index]; use(item); }`,
    expected: [/for \(using item of items\)/],
  },
  {
    name: "array copy conversion",
    code: `using copy = [3, 1, 2].slice(); copy.sort();`,
    expected: [/using copy = \[3, 1, 2\]\.toSorted\(\)/],
  },
  {
    name: "array from forEach conversion",
    code: `Array.from(items).forEach(function (value) { using item = value; use(item); });`,
    expected: [/for \(const value of items\)/, /using item = value/],
  },
  {
    name: "variable declaration conversion",
    code: `using resource = open(); var count = 1;`,
    expected: [/using resource = open\(\)/, /const count = 1/],
  },
  {
    name: "console conversion",
    code: `using logger = console; console.log("done");`,
    expected: [/using logger = console/, /console\.info\("done"\)/],
  },
  {
    name: "template literal conversion",
    code: `using message = "hello " + name;`,
    expected: [/using message = `hello \$\{name\}`/],
  },
  {
    name: "numeric separator conversion",
    code: `using big = 1000000;`,
    expected: [/using big = 1_000_000/],
  },
  {
    name: "optional chaining conversion",
    code: `using value = object && object.value;`,
    expected: [/using value = object\?\.value/],
  },
]

/**
 * Collect the names of the disposable bindings declared in the code.
 *
 * @param {string} code - The source code to parse
 * @returns {string[]} The declared binding names
 */
function collectDisposableBindings(code) {
  const bindings = []

  j.withParser("tsx")(code)
    .find(j.VariableDeclaration)
    .filter(({ node }) => DISPOSABLE_DECLARATION_KINDS.has(node.kind))
    .forEach(({ node }) => {
      node.declarations.forEach(({ id }) => {
        bindings.push(id.name)
      })
    })

  return bindings
}

for (const baseline of ["widely-available", "newly-available"]) {
  suite(baseline, () => {
    describe("using declarations", () => {
      for (const { name, code, expected } of samples) {
        test(`keep the disposable declaration of ${name}`, () => {
          const result = transform(code, baseline)

          expected.forEach((pattern) => assert.match(result.code, pattern))
          assert.deepEqual(
            collectDisposableBindings(result.code),
            collectDisposableBindings(code),
            `${name} keeps every disposable binding`,
          )
        })
      }

      test("leave a source without other declarations alone", () => {
        const source = `using resource = () => 1;
async function load() {
  await using handle = open();
  return handle;
}
`

        assert.deepEqual(transform(source, baseline), {
          code: source,
          modified: false,
        })
      })
    })
  })
}
