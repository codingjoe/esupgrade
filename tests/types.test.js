import { default as j } from "jscodeshift"
import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../src/index.js"
import {
  CallIndex,
  DirectEvalIndex,
  NodeTest,
  findEnclosingFunction,
  isShadowed,
  ReferenceIndex,
} from "../src/types.js"

/**
 * Run the var/let/const guard over every variable declaration in the code.
 *
 * @param {string} code - The source code to parse
 * @returns {boolean[]} One guard result per variable declaration
 */
function collectDeclarationGuards(code) {
  const guards = []

  j(code)
    .find(j.VariableDeclaration)
    .forEach(({ node }) => {
      guards.push(new NodeTest(node).isVarLetOrConstDeclaration())
    })

  return guards
}

/**
 * Parse code and return the path of its first node of a type.
 *
 * @param {string} code - Source code to parse
 * @param {import("ast-types").Type} type - Node type to find
 * @returns {import("ast-types").NodePath} Path of the first match
 */
function firstPath(code, type) {
  return j.withParser("tsx")(code).find(type).paths()[0]
}

/**
 * Build a method call without arguments on a receiver.
 *
 * @param {import("ast-types").ASTNode} object - The receiver node
 * @param {string} methodName - The method name to call
 * @returns {import("ast-types").ASTNode} The method call expression
 */
function callMethod(object, methodName) {
  return j.callExpression(
    j.memberExpression(object, j.identifier(methodName), false),
    [],
  )
}

suite("types", () => {
  describe("NodeTest", () => {
    describe("getComparisonCall", () => {
      test("reject a non-binary expression", () => {
        const node = j.literal(1)
        const test = new NodeTest(node)
        assert.equal(test.getComparisonCall(["indexOf"]), null)
      })

      test("report the left-hand method call", () => {
        const path = firstPath(`"abc".indexOf("a") !== -1`, j.BinaryExpression)
        const info = new NodeTest(path.node, path).getComparisonCall(["indexOf"])

        assert.equal(info.isLeftCall, true)
        assert.equal(info.call, path.node.left)
        assert.equal(info.comparisonValue, path.node.right)
      })

      test("report the right-hand method call", () => {
        const path = firstPath(`-1 !== "abc".indexOf("a")`, j.BinaryExpression)
        const info = new NodeTest(path.node, path).getComparisonCall(["indexOf"])

        assert.equal(info.isLeftCall, false)
        assert.equal(info.call, path.node.right)
        assert.equal(info.comparisonValue, path.node.left)
      })
    })

    describe("Array verification", () => {
      test("verify Array.of() with the global binding", () => {
        const path = firstPath(`Array.of(1, 2)`, j.CallExpression)

        assert(new NodeTest(path.node, path).isIterable())
      })

      test("reject a shadowed Array parameter", () => {
        const path = firstPath(
          `function fn(Array) { return Array.of(1, 2) }`,
          j.CallExpression,
        )

        assert(!new NodeTest(path.node, path).isIterable())
      })

      test("reject a shadowed Array local", () => {
        const path = firstPath(
          `function fn() { const Array = []\nreturn new Array(5) }`,
          j.NewExpression,
        )

        assert(!new NodeTest(path.node, path).isNewArray())
      })

      test("reject a shadowed Array import", () => {
        const path = firstPath(
          `import Array from "./array.js"\nArray.from(items)`,
          j.CallExpression,
        )

        assert(!new NodeTest(path.node, path).isIterable())
      })

      test("reject a shadowed Array catch parameter", () => {
        const path = firstPath(
          `try {} catch (Array) { Array.from(items) }`,
          j.CallExpression,
        )

        assert(!new NodeTest(path.node, path).isIterable())
      })

      test("reject an Array static call without a path", () => {
        const path = firstPath(`Array.of(1, 2)`, j.CallExpression)

        assert(!new NodeTest(path.node).isIterable(), "unverifiable Array.of()")
        assert(new NodeTest(j.arrayExpression([])).isIterable(), "array literal")
      })

      test("reject a computed Array static call", () => {
        const path = firstPath(`Array[of](1, 2)`, j.CallExpression)

        assert(!new NodeTest(path.node, path).isIterable())
      })

      test("reject a computed method chain", () => {
        const path = firstPath(`Array.of(1, 2)[slice]()`, j.CallExpression)

        assert(!new NodeTest(path.node, path).hasIndexOfAndIncludes())
      })

      test("reject a computed string method", () => {
        const path = firstPath(`"abc"[trim]()`, j.CallExpression)

        assert(!new NodeTest(path.node, path).hasIndexOfAndIncludes())
      })

      test("reject a computed slice member", () => {
        const path = firstPath(
          `function fn() { [][slice].call(arguments) }`,
          j.CallExpression,
        )

        assert(!new NodeTest(path.node, path).isArraySliceCallArguments())
      })

      test("reject a computed indexOf member", () => {
        const path = firstPath(`"abc"[indexOf]("a") !== -1`, j.BinaryExpression)

        assert.equal(new NodeTest(path.node, path).getComparisonCall(["indexOf"]), null)
      })

      test("reject a TypeScript enum binding", () => {
        const path = firstPath(
          `enum Array { A }\nconst items = Array.of(1, 2)`,
          j.CallExpression,
        )

        assert(!new NodeTest(path.node, path).isIterable())
      })

      test("reject a TypeScript namespace binding", () => {
        const path = firstPath(
          `namespace Array { export const of = 1 }\nconst items = Array.of(1, 2)`,
          j.CallExpression,
        )

        assert(!new NodeTest(path.node, path).isIterable())
      })

      test("reject a TypeScript import equals binding", () => {
        const path = firstPath(
          `import Array = require("./array")\nconst items = Array.of(1, 2)`,
          j.CallExpression,
        )

        assert(!new NodeTest(path.node, path).isIterable())
      })
    })

    describe("isMethodCall", () => {
      test("accept a call to one of the given methods", () => {
        const path = firstPath(`x.concat(y)`, j.CallExpression)

        assert(new NodeTest(path.node, path).isMethodCall(["concat"]))
      })

      test("reject another method name", () => {
        const path = firstPath(`x.slice(y)`, j.CallExpression)

        assert(!new NodeTest(path.node, path).isMethodCall(["concat"]))
      })

      test("reject a computed member call", () => {
        const path = firstPath(`x[concat](y)`, j.CallExpression)

        assert(!new NodeTest(path.node, path).isMethodCall(["concat"]))
      })

      test("reject a plain call", () => {
        const path = firstPath(`f()`, j.CallExpression)

        assert(!new NodeTest(path.node, path).isMethodCall(["concat"]))
      })
    })

    describe("unwrapPromiseResolveReject", () => {
      test("unwrap a Promise.resolve() argument", () => {
        const path = firstPath(`Promise.resolve(value)`, j.CallExpression)
        const result = new NodeTest(path.node, path).unwrapPromiseResolveReject()

        assert.equal(result.kind, "resolve")
        assert.equal(result.argument, path.node.arguments[0])
      })

      test("unwrap a Promise.reject() argument", () => {
        const path = firstPath(`Promise.reject(error)`, j.CallExpression)
        const result = new NodeTest(path.node, path).unwrapPromiseResolveReject()

        assert.equal(result.kind, "reject")
        assert.equal(result.argument, path.node.arguments[0])
      })

      test("default the Promise.resolve() argument to undefined", () => {
        const path = firstPath(`Promise.resolve()`, j.CallExpression)
        const result = new NodeTest(path.node, path).unwrapPromiseResolveReject()

        assert.equal(result.kind, "resolve")
        assert(j.Identifier.check(result.argument))
        assert.equal(result.argument.name, "undefined")
      })

      test("reject a static call on another object", () => {
        const path = firstPath(`foo.resolve(value)`, j.CallExpression)

        assert.equal(new NodeTest(path.node, path).unwrapPromiseResolveReject(), null)
      })
    })

    describe("containsIdentifier", () => {
      test("find a name in the node itself", () => {
        const path = firstPath(
          `const result = value.map((item) => item.length)`,
          j.VariableDeclaration,
        )

        assert(new NodeTest(path.node, path).containsIdentifier("value"))
      })

      test("ignore a name inside a nested function", () => {
        const path = firstPath(
          `const result = value.map((item) => item.length)`,
          j.VariableDeclaration,
        )

        assert(!new NodeTest(path.node, path).containsIdentifier("item"))
      })

      test("find a name inside a nested function when crossing functions", () => {
        const path = firstPath(
          `const result = value.map((item) => item.length)`,
          j.VariableDeclaration,
        )

        assert(
          new NodeTest(path.node, path).containsIdentifier("item", {
            crossFunctions: true,
          }),
        )
      })
    })

    describe("isFunctionExpression", () => {
      test("accept a function expression", () => {
        const path = firstPath(`const fn = function () {}`, j.FunctionExpression)

        assert(new NodeTest(path.node, path).isFunctionExpression())
      })

      test("accept an arrow function", () => {
        const path = firstPath(`const fn = () => {}`, j.ArrowFunctionExpression)

        assert(new NodeTest(path.node, path).isFunctionExpression())
      })

      test("reject a function declaration", () => {
        const path = firstPath(`function fn() {}`, j.FunctionDeclaration)

        assert(!new NodeTest(path.node, path).isFunctionExpression())
      })
    })
  })

  describe("isString", () => {
    test("accept string literals", () => {
      assert(new NodeTest(j.stringLiteral("x")).isString())
    })

    test("accept string-valued literals", () => {
      assert(new NodeTest(j.literal("x")).isString())
    })

    test("accept template literals", () => {
      assert(new NodeTest(j.templateLiteral([], [])).isString())
    })

    test("accept string method calls", () => {
      const call = callMethod(j.stringLiteral("x"), "toUpperCase")

      assert(new NodeTest(call).isString())
    })

    test("accept nested string method calls", () => {
      const call = callMethod(
        callMethod(j.stringLiteral("x"), "toUpperCase"),
        "toLowerCase",
      )

      assert(new NodeTest(call).isString())
    })

    test("accept method calls on a template literal", () => {
      const call = callMethod(
        callMethod(j.templateLiteral([], []), "trimLeft"),
        "trimRight",
      )

      assert(new NodeTest(call).isString())
    })

    test("reject array literals", () => {
      assert(!new NodeTest(j.arrayExpression([])).isString())
    })

    test("reject identifiers", () => {
      assert(!new NodeTest(j.identifier("value")).isString())
    })

    test("reject method calls returning other types", () => {
      const call = callMethod(j.stringLiteral("a,b"), "split")

      assert(!new NodeTest(call).isString())
    })

    test("reject non-string methods on a string receiver", () => {
      const call = callMethod(
        callMethod(j.stringLiteral("a,b"), "toUpperCase"),
        "split",
      )

      assert(!new NodeTest(call).isString())
    })
  })

  describe("hasIndexOfAndIncludes", () => {
    test("accept nested string method calls", () => {
      const call = callMethod(
        callMethod(j.stringLiteral("x"), "toUpperCase"),
        "toLowerCase",
      )

      assert(new NodeTest(call).hasIndexOfAndIncludes())
    })

    test("accept method calls on a template literal", () => {
      const call = callMethod(j.templateLiteral([], []), "trim")

      assert(new NodeTest(call).hasIndexOfAndIncludes())
    })

    test("reject method calls on unknown receivers", () => {
      const call = callMethod(j.identifier("value"), "toUpperCase")

      assert(!new NodeTest(call).hasIndexOfAndIncludes())
    })
  })

  describe("isVarLetOrConstDeclaration", () => {
    test("accepts var, let and const declarations", () => {
      const guards = collectDeclarationGuards(`var a = 1; let b = 2; const c = 3;`)

      assert.deepEqual(guards, [true, true, true])
    })

    test("rejects using and await using declarations", () => {
      const guards = collectDeclarationGuards(
        `using a = b; async function f() { await using c = d; }`,
      )

      assert.deepEqual(guards, [false, false])
    })

    test("rejects nodes that are not declarations", () => {
      assert(!new NodeTest(j.literal(1)).isVarLetOrConstDeclaration())
    })
  })

  describe("patternContainsIdentifier with null/undefined", () => {
    test("array destructuring with holes (null elements)", () => {
      const result = transform(`
    var [a, , b] = arr;
  `)

      assert(result.modified, "transform var with array holes")
      assert.match(result.code, /const \[a, , b\] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring with holes and reassignment", () => {
      const result = transform(`
    var [a, , b] = arr;
    a = 5;
  `)

      assert(result.modified, "transform var with array holes and reassignment")
      assert.match(result.code, /let \[a, , b\]/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring assignment with hole", () => {
      const result = transform(`
    var a, b;
    [a, , b] = arr;
  `)

      assert(
        result.modified,
        "transform vars reassigned via array destructuring with hole",
      )
      assert.match(result.code, /let a/)
      assert.match(result.code, /let b/)
    })

    test("nested array destructuring with holes", () => {
      const result = transform(`
    var [[x, , y], , z] = nestedArr;
  `)

      assert(result.modified, "transform var with nested array holes")
      assert.match(result.code, /const \[\[x, , y\], , z\] = nestedArr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring with multiple consecutive holes", () => {
      const result = transform(`
    var [a, , , b] = arr;
  `)

      assert(result.modified, "transform var with multiple consecutive holes")
      assert.match(result.code, /const \[a, , , b\] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring with trailing hole", () => {
      const result = transform(`
    var [a, b, ] = arr;
  `)

      assert(result.modified, "transform var with trailing hole")
      assert.match(result.code, /const \[a, b, \] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })

    test("array destructuring with leading hole", () => {
      const result = transform(`
    var [ , a, b] = arr;
  `)

      assert(result.modified, "transform var with leading hole")
      assert.match(result.code, /const \[ , a, b\] = arr/)
      assert.doesNotMatch(result.code, /var/)
    })
  })

  describe("isShadowed", () => {
    test("report a parameter of the enclosing function", () => {
      const path = firstPath(`function fn(shadow) { return shadow }`, j.ReturnStatement)

      assert(isShadowed(path, "shadow"))
    })

    test("report a local binding of the enclosing function", () => {
      const path = firstPath(
        `function fn() { const local = 1; return local }`,
        j.ReturnStatement,
      )

      assert(isShadowed(path, "local"))
    })

    test("ignore a free name", () => {
      const path = firstPath(`function fn() { return free }`, j.ReturnStatement)

      assert(!isShadowed(path, "free"))
    })
  })

  describe("ReferenceIndex", () => {
    test("returns no paths for an unbound name", () => {
      const index = new ReferenceIndex(j(`var a = 1;`))

      assert.deepEqual(index.getPathsFor("b"), [])
    })

    test("returns the binding and every read of a name", () => {
      const index = new ReferenceIndex(j(`var a = 1; use(a);`))

      assert.equal(index.getPathsFor("a").length, 2)
    })
  })

  describe("CallIndex", () => {
    test("returns no paths for an uncalled function", () => {
      const root = j(`function g() {}`)
      const index = new CallIndex(root)
      const functionNode = root.find(j.FunctionDeclaration).nodes()[0]

      assert.deepEqual(index.getPathsFor(functionNode), [])
    })

    test("returns every call of a function declaration", () => {
      const root = j(`function g() {}\ng();\ng();`)
      const index = new CallIndex(root)
      const functionNode = root.find(j.FunctionDeclaration).nodes()[0]

      assert.equal(index.getPathsFor(functionNode).length, 2)
    })

    test("returns the call of a function expression", () => {
      const root = j(`const g = () => {};\ng();`)
      const index = new CallIndex(root)
      const functionNode = root.find(j.ArrowFunctionExpression).nodes()[0]

      assert.equal(index.getPathsFor(functionNode).length, 1)
    })

    test("ignores a var declaration", () => {
      const root = j(`
function g() {}
function f() {
  var g = function () {};
  g();
}
g();
`)
      const index = new CallIndex(root)
      const functionNode = root.find(j.FunctionDeclaration).nodes()[0]

      assert.equal(index.getPathsFor(functionNode).length, 1)
    })

    test("ignores a declaration that holds no function", () => {
      const root = j(`
function g() {}
function f() {
  const g = 1;
  g();
}
g();
`)
      const index = new CallIndex(root)
      const functionNode = root.find(j.FunctionDeclaration).nodes()[0]

      assert.equal(index.getPathsFor(functionNode).length, 1)
    })

    test("ignores a property call", () => {
      const root = j(`const g = { run() {} };\ng.run();`)
      const index = new CallIndex(root)
      const method = root.find(j.ObjectMethod).nodes()[0]

      assert.deepEqual(index.getPathsFor(method), [])
    })

    test("ignores a global callee", () => {
      const root = j(`
use();
const f = () => {
  function use() {}
  use();
};
`)
      const index = new CallIndex(root)
      const functionNode = root.find(j.FunctionDeclaration).nodes()[0]

      assert.equal(index.getPathsFor(functionNode).length, 1)
    })

    test("ignores a parameter that shares the function name", () => {
      const root = j(`
function g(callback) {
  callback();
}
g();
`)
      const index = new CallIndex(root)
      const functionNode = root.find(j.FunctionDeclaration).nodes()[0]

      assert.equal(index.getPathsFor(functionNode).length, 1)
    })
  })

  describe("DirectEvalIndex", () => {
    test("lists the calls that run inside a scope", () => {
      const root = j(`function g() { eval("a"); } function f() { eval("b"); }`)
      const index = new DirectEvalIndex(root)
      const [scope] = root.find(j.FunctionDeclaration).paths()

      assert.equal(index.getPathsInScope(scope.node).length, 1)
    })

    test("ignores a call to a shadowed eval", () => {
      const root = j.withParser("tsx")(
        `declare const eval: (source: string) => unknown; eval("a");`,
      )
      const index = new DirectEvalIndex(root)

      assert.equal(index.getPathsInScope(root.paths()[0].node).length, 0)
    })
  })

  describe("findEnclosingFunction", () => {
    test("returns null when path has no parent", () => {
      const code = `function test() { return 42; }`
      const root = j(code)
      const program = root.find(j.Program).paths()[0]

      const result = findEnclosingFunction(program)

      assert.equal(result, null, "should return null for path with no parent function")
    })
  })
})
