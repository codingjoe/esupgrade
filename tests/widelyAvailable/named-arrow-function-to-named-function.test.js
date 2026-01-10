import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("namedArrowFunctionToNamedFunction", () => {
    test("arrow function with generic type parameters", () => {
      const result = transform(`const identity = <T>(value: T): T => value`)

      assert(result.modified, "transform arrow function with generics")
      assert.match(result.code, /function identity<T>\(value: T\): T/)
      assert.match(result.code, /return value/)
    })

    test("arrow function with multiple generic type parameters", () => {
      const result = transform(
        `const merge = <T, U>(a: T, b: U): T & U => ({ ...a, ...b })`,
      )

      assert(result.modified, "transform arrow function with multiple generics")
      assert.match(result.code, /function merge<T, U>\(a: T, b: U\): T & U/)
    })

    test("arrow function with constrained generic type parameters", () => {
      const result = transform(
        `const process = <T extends string>(value: T): T => { return value; }`,
      )

      assert(result.modified, "transform arrow function with constrained generics")
      assert.match(result.code, /function process<T extends string>\(value: T\): T/)
    })

    test("arrow function with default generic type parameters", () => {
      const result = transform(
        `const create = <T = string>(value?: T): T | undefined => value`,
      )

      assert(result.modified, "transform arrow function with default generics")
      assert.match(
        result.code,
        /function create<T = string>\(value\?: T\): T \| undefined/,
      )
    })

    test("exported arrow function with generics", () => {
      const result = transform(
        `export const useHook = <T extends object>(props: T) => { return props; }`,
      )

      assert(result.modified, "transform exported arrow function with generics")
      assert.match(result.code, /export function useHook<T extends object>\(props: T\)/)
    })

    test("arrow function with complex generic constraints", () => {
      const result = transform(
        `const manager = <TForm extends BaseForm<TAccount>, TAccount = unknown>(params: TForm): void => {}`,
      )

      assert(
        result.modified,
        "transform arrow function with complex generic constraints",
      )
      assert.match(
        result.code,
        /function manager<TForm extends BaseForm<TAccount>, TAccount = unknown>\(params: TForm\): void/,
      )
    })

    test("simple const arrow function", () => {
      const result = transform(`const myFunc = () => {}`)

      assert(result.modified, "transform const arrow function to function declaration")
      assert.match(result.code, /function myFunc\(\)/)
      assert.doesNotMatch(result.code, /const myFunc/)
    })

    test("arrow function with parameters", () => {
      const result = transform(`const add = (a, b) => { return a + b; }`)

      assert(result.modified, "transform arrow function with parameters")
      assert.match(result.code, /function add\(a, b\)/)
      assert.match(result.code, /return a \+ b/)
    })

    test("arrow function with expression body", () => {
      const result = transform(`const double = x => x * 2`)

      assert(result.modified, "transform arrow function with expression body")
      assert.match(result.code, /function double\(x\)/)
      assert.match(result.code, /return x \* 2/)
    })

    test("arrow function with no parameters", () => {
      const result = transform(`const getValue = () => 42`)

      assert(result.modified, "transform arrow function with no parameters")
      assert.match(result.code, /function getValue\(\)/)
      assert.match(result.code, /return 42/)
    })

    test("async arrow function", () => {
      const result = transform(
        `const fetchData = async () => { return await getData(); }`,
      )

      assert(result.modified, "transform async arrow function")
      assert.match(result.code, /async function fetchData\(\)/)
      assert.match(result.code, /return await getData\(\)/)
    })

    test("let arrow function", () => {
      const result = transform(`let myFunc = () => { console.log('test'); }`)

      assert(result.modified, "transform let arrow function")
      assert.match(result.code, /function myFunc\(\)/)
      assert.match(result.code, /console\.info\('test'\)/)
    })

    test("skip arrow function using this", () => {
      const result = transform(`const method = () => { return this.value; }`)

      assert(!result.modified, "skip arrow function using this")
    })

    test("skip arrow function in callback", () => {
      const result = transform(`items.map(item => item * 2)`)

      assert(!result.modified, "skip arrow function in callback position")
    })

    test("skip multiple declarators", () => {
      const result = transform(`const a = () => {}, b = () => {}`)

      assert(!result.modified, "skip variable declaration with multiple declarators")
    })

    test("skip destructuring assignment", () => {
      const result = transform(`const { func } = obj`)

      assert(!result.modified, "skip destructuring assignment")
    })

    test("skip var declarations", () => {
      const result = transform(`var myFunc = () => {}`)

      // var gets transformed to const, then const arrow gets transformed to function
      assert(result.modified, "transform var to const to function")
      assert.match(result.code, /function myFunc\(\)/)
    })

    test("arrow function with multiple statements", () => {
      const result = transform(`
  const process = (data) => {
    const result = data * 2;
    console.log(result);
    return result;
  }
`)

      assert(result.modified, "transform arrow function with multiple statements")
      assert.match(result.code, /function process\(data\)/)
      assert.match(result.code, /const result = data \* 2/)
      assert.match(result.code, /console\.info\(result\)/)
    })

    test("arrow function with rest parameters", () => {
      const result = transform(
        `const sum = (...args) => args.reduce((a, b) => a + b, 0)`,
      )

      assert(result.modified, "transform arrow function with rest parameters")
      assert.match(result.code, /function sum\(\.\.\.args\)/)
      assert.match(result.code, /return args\.reduce/)
    })

    test("arrow function with default parameters", () => {
      const result = transform(
        `const greet = (name = 'World') => { return 'Hello ' + name; }`,
      )

      assert(result.modified, "transform arrow function with default parameters")
      assert.match(result.code, /function greet\(name = 'World'\)/)
      // String concatenation gets transformed to template literal
      assert.match(result.code, /return `Hello \$\{name\}`/)
    })

    test("nested arrow functions are all transformed", () => {
      const result = transform(
        `const outer = () => { const inner = () => {}; return inner; }`,
      )

      assert(result.modified, "transform both outer and inner arrow functions")
      assert.match(result.code, /function outer\(\)/)
      // Inner also gets transformed since it's a const declaration
      assert.match(result.code, /function inner\(\)/)
    })

    test("arrow function with array pattern parameter", () => {
      const result = transform(`const sum = ([a, b]) => a + b`)

      assert(result.modified, "transform arrow function with array pattern parameter")
      assert.match(result.code, /function sum\(\[a, b\]\)/)
      assert.match(result.code, /return a \+ b/)
    })

    test("arrow function with object pattern parameter", () => {
      const result = transform(`const getName = ({ name }) => name`)

      assert(result.modified, "transform arrow function with object pattern parameter")
      assert.match(result.code, /function getName\(\{ name \}\)/)
      assert.match(result.code, /return name/)
    })

    test("skip arrow function with variable type annotation and no function return type", () => {
      const result = transform(
        `const Template: StoryFn<MyType> = () => { return <div>Hello</div>; }`,
      )

      assert(
        !result.modified,
        "skip arrow function with variable type and no function return type",
      )
      assert.match(result.code, /const Template: StoryFn<MyType> = \(\) =>/)
    })

    test("skip function expression with variable type annotation and no function return type", () => {
      const result = transform(
        `const handler: EventHandler = function() { return true; }`,
      )

      assert(
        !result.modified,
        "skip function expression with variable type and no function return type",
      )
      assert.match(result.code, /const handler: EventHandler = function\(\)/)
    })

    test("transform function with return type annotation", () => {
      const result = transform(
        `let myAdd = function (x: number, y: number): number { return x + y; }`,
      )

      assert(result.modified, "transform function with return type annotation")
      assert.match(result.code, /function myAdd\(x: number, y: number\): number/)
      assert.match(result.code, /return x \+ y/)
    })

    test("transform arrow function with return type annotation", () => {
      const result = transform(
        `const myFunc = (x: number): string => { return x.toString(); }`,
      )

      assert(result.modified, "transform arrow function with return type")
      assert.match(result.code, /function myFunc\(x: number\): string/)
    })

    test("transform arrow function with variable and function return types", () => {
      const result = transform(`const myFunc: MyType = (x: number): number => x * 2`)

      assert(
        result.modified,
        "transform when function has return type even with variable type",
      )
      assert.match(result.code, /function myFunc\(x: number\): number/)
      assert.match(result.code, /return x \* 2/)
    })

    test("transform function expression with parameter types only", () => {
      const result = transform(
        `const add = function(a: number, b: number) { return a + b; }`,
      )

      assert(result.modified, "transform function with parameter types")
      assert.match(result.code, /function add\(a: number, b: number\)/)
    })

    test("preserve leading line comment", () => {
      const result = transform(
        `// This is a comment\nconst myFunc = () => { return 42; }`,
      )

      assert(result.modified, "transform arrow function")
      assert.match(result.code, /\/\/ This is a comment/)
      assert.match(result.code, /function myFunc\(\)/)
    })

    test("preserve JSDoc comment", () => {
      const result = transform(
        `/**\n * JSDoc comment\n */\nconst greet = function(name) { return "Hello"; }`,
      )

      assert(result.modified, "transform function expression")
      assert.match(result.code, /\/\*\*/)
      assert.match(result.code, /\* JSDoc comment/)
      assert.match(result.code, /\*\//)
      assert.match(result.code, /function greet\(name\)/)
    })

    test("preserve multiple leading comments", () => {
      const result = transform(
        `// Comment 1\n// Comment 2\nconst add = (a, b) => a + b`,
      )

      assert(result.modified, "transform arrow function")
      assert.match(result.code, /\/\/ Comment 1/)
      assert.match(result.code, /\/\/ Comment 2/)
      assert.match(result.code, /function add\(a, b\)/)
    })

    test("preserve block comment", () => {
      const result = transform(`/* Block comment */\nconst multiply = (x, y) => x * y`)

      assert(result.modified, "transform arrow function")
      assert.match(result.code, /\/\* Block comment \*\//)
      assert.match(result.code, /function multiply\(x, y\)/)
    })

    test("preserve trailing comment", () => {
      const result = transform(`const getValue = () => 42 // trailing comment`)

      assert(result.modified, "transform arrow function")
      assert.match(result.code, /function getValue\(\)/)
      assert.match(result.code, /return 42/)
      assert.match(result.code, /\/\/ trailing comment/)
    })
  })
})
