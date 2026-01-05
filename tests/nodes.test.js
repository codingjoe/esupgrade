import { describe, suite, test } from "node:test"
import assert from "node:assert/strict"
import jscodeshift from "jscodeshift"
import * as nodes from "../src/nodes.js"

const j = jscodeshift.withParser("tsx")

suite("nodes", () => {
  describe("containsIdentifier", () => {
    test("returns false for null/undefined", () => {
      assert.strictEqual(nodes.containsIdentifier(j, null, "x"), false)
      assert.strictEqual(nodes.containsIdentifier(j, undefined, "x"), false)
    })

    test("finds identifier in simple pattern", () => {
      const code = "const x = 1"
      const root = j(code)
      const id = root.find(j.Identifier, { name: "x" }).at(0).get().node
      assert.strictEqual(nodes.containsIdentifier(j, id, "x"), true)
      assert.strictEqual(nodes.containsIdentifier(j, id, "y"), false)
    })

    test("finds identifier in object destructuring", () => {
      const code = "const { x, y } = obj"
      const root = j(code)
      const pattern = root.find(j.ObjectPattern).at(0).get().node
      assert.strictEqual(nodes.containsIdentifier(j, pattern, "x"), true)
      assert.strictEqual(nodes.containsIdentifier(j, pattern, "z"), false)
    })

    test("finds identifier in array destructuring", () => {
      const code = "const [a, b] = arr"
      const root = j(code)
      const pattern = root.find(j.ArrayPattern).at(0).get().node
      assert.strictEqual(nodes.containsIdentifier(j, pattern, "a"), true)
      assert.strictEqual(nodes.containsIdentifier(j, pattern, "c"), false)
    })

    test("finds identifier in rest element", () => {
      const code = "const { x, ...rest } = obj"
      const root = j(code)
      const pattern = root.find(j.ObjectPattern).at(0).get().node
      assert.strictEqual(nodes.containsIdentifier(j, pattern, "rest"), true)
    })
  })

  describe("extractIdentifiers", () => {
    test("extracts from simple identifier", () => {
      const code = "const x = 1"
      const root = j(code)
      const id = root.find(j.Identifier, { name: "x" }).at(0).get().node
      const result = [...nodes.extractIdentifiers(j, id)]
      assert.deepStrictEqual(result, ["x"])
    })

    test("extracts from object destructuring", () => {
      const code = "const { a, b } = obj"
      const root = j(code)
      const pattern = root.find(j.ObjectPattern).at(0).get().node
      const result = [...nodes.extractIdentifiers(j, pattern)]
      assert.deepStrictEqual(result, ["a", "b"])
    })

    test("extracts from array destructuring", () => {
      const code = "const [x, y] = arr"
      const root = j(code)
      const pattern = root.find(j.ArrayPattern).at(0).get().node
      const result = [...nodes.extractIdentifiers(j, pattern)]
      assert.deepStrictEqual(result, ["x", "y"])
    })
  })

  describe("areEquivalent", () => {
    test("returns false for null/undefined", () => {
      assert.strictEqual(nodes.areEquivalent(j, null, null), false)
    })

    test("compares identifiers", () => {
      const code = "const x = y"
      const root = j(code)
      const ids = root.find(j.Identifier).paths()
      assert.strictEqual(nodes.areEquivalent(j, ids[0].node, ids[0].node), true)
      assert.strictEqual(nodes.areEquivalent(j, ids[0].node, ids[1].node), false)
    })

    test("compares literals", () => {
      const code = "const a = 1; const b = 1; const c = 2"
      const root = j(code)
      const lits = root.find(j.Literal).paths()
      assert.strictEqual(nodes.areEquivalent(j, lits[0].node, lits[1].node), true)
      assert.strictEqual(nodes.areEquivalent(j, lits[0].node, lits[2].node), false)
    })

    test("compares member expressions", () => {
      const code = "obj.prop; obj.prop; obj.other"
      const root = j(code)
      const members = root.find(j.MemberExpression).paths()
      assert.strictEqual(nodes.areEquivalent(j, members[0].node, members[1].node), true)
      assert.strictEqual(
        nodes.areEquivalent(j, members[0].node, members[2].node),
        false,
      )
    })
  })

  describe("isVerifiableIterable", () => {
    test("array literal", () => {
      const code = "[1, 2, 3]"
      const root = j(code)
      const node = root.find(j.ArrayExpression).at(0).get().node
      assert.strictEqual(nodes.isVerifiableIterable(j, node), true)
    })

    test("Array.from()", () => {
      const code = "Array.from(items)"
      const root = j(code)
      const node = root.find(j.CallExpression).at(0).get().node
      assert.strictEqual(nodes.isVerifiableIterable(j, node), true)
    })

    test("Array.of()", () => {
      const code = "Array.of(1, 2, 3)"
      const root = j(code)
      const node = root.find(j.CallExpression).at(0).get().node
      assert.strictEqual(nodes.isVerifiableIterable(j, node), true)
    })

    test("new Array()", () => {
      const code = "new Array(5)"
      const root = j(code)
      const node = root.find(j.NewExpression).at(0).get().node
      assert.strictEqual(nodes.isVerifiableIterable(j, node), true)
    })

    test("string.split()", () => {
      const code = '"a,b".split(",")'
      const root = j(code)
      const node = root.find(j.CallExpression).at(0).get().node
      assert.strictEqual(nodes.isVerifiableIterable(j, node), true)
    })

    test("string.slice()", () => {
      const code = '"hello".slice(0)'
      const root = j(code)
      const node = root.find(j.CallExpression).at(0).get().node
      assert.strictEqual(nodes.isVerifiableIterable(j, node), true)
    })

    test("unknown identifier", () => {
      const code = "items"
      const root = j(code)
      const node = root.find(j.Identifier).at(0).get().node
      assert.strictEqual(nodes.isVerifiableIterable(j, node), false)
    })

    test("non-iterable method call", () => {
      const code = "obj.method()"
      const root = j(code)
      const node = root.find(j.CallExpression).at(0).get().node
      assert.strictEqual(nodes.isVerifiableIterable(j, node), false)
    })
  })

  describe("isReassigned", () => {
    test("detects reassignment", () => {
      const code = `var x = 1; x = 2;`
      const root = j(code)
      const decl = root.find(j.VariableDeclaration).at(0).paths()[0]
      assert.strictEqual(nodes.isReassigned(j, root, "x", decl), true)
    })

    test("detects update expression", () => {
      const code = `var x = 1; x++;`
      const root = j(code)
      const decl = root.find(j.VariableDeclaration).at(0).paths()[0]
      assert.strictEqual(nodes.isReassigned(j, root, "x", decl), true)
    })

    test("no reassignment", () => {
      const code = `var x = 1; console.log(x);`
      const root = j(code)
      const decl = root.find(j.VariableDeclaration).at(0).paths()[0]
      assert.strictEqual(nodes.isReassigned(j, root, "x", decl), false)
    })

    test("ignores shadowed reassignment", () => {
      const code = `var x = 1; function fn() { var x = 2; x = 3; }`
      const root = j(code)
      const decl = root.find(j.VariableDeclaration).at(0).paths()[0]
      assert.strictEqual(nodes.isReassigned(j, root, "x", decl), false)
    })
  })

  describe("isAssignmentShadowed", () => {
    test("shadowed by function parameter", () => {
      const code = `var x = 1; function fn(x) { x = 2; }`
      const root = j(code)
      const decl = root.find(j.VariableDeclaration).at(0).paths()[0]
      const assign = root.find(j.AssignmentExpression).at(0).paths()[0]
      assert.strictEqual(nodes.isAssignmentShadowed(j, "x", decl, assign), true)
    })

    test("shadowed by local declaration", () => {
      const code = `var x = 1; function fn() { var x = 2; x = 3; }`
      const root = j(code)
      const decl = root.find(j.VariableDeclaration).at(0).paths()[0]
      const assign = root.find(j.AssignmentExpression).at(0).paths()[0]
      assert.strictEqual(nodes.isAssignmentShadowed(j, "x", decl, assign), true)
    })

    test("not shadowed", () => {
      const code = `var x = 1; x = 2;`
      const root = j(code)
      const decl = root.find(j.VariableDeclaration).at(0).paths()[0]
      const assign = root.find(j.AssignmentExpression).at(0).paths()[0]
      assert.strictEqual(nodes.isAssignmentShadowed(j, "x", decl, assign), false)
    })
  })
})
