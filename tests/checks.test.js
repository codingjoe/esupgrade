import { describe, suite, test } from "node:test"
import assert from "node:assert/strict"
import jscodeshift from "jscodeshift"
import { PatternChecker, NodeChecker, VariableChecker } from "../src/checks.js"

const j = jscodeshift.withParser("tsx")

suite("checks", () => {
  describe("PatternChecker", () => {
    describe("containsIdentifier", () => {
      test("returns false for null/undefined", () => {
        assert.strictEqual(PatternChecker.containsIdentifier(j, null, "x"), false)
        assert.strictEqual(PatternChecker.containsIdentifier(j, undefined, "x"), false)
      })

      test("returns true for matching identifier", () => {
        const code = "const x = 1"
        const root = j(code)
        const identifier = root.find(j.Identifier, { name: "x" }).at(0).get().node
        assert.strictEqual(PatternChecker.containsIdentifier(j, identifier, "x"), true)
      })

      test("returns false for non-matching identifier", () => {
        const code = "const x = 1"
        const root = j(code)
        const identifier = root.find(j.Identifier, { name: "x" }).at(0).get().node
        assert.strictEqual(PatternChecker.containsIdentifier(j, identifier, "y"), false)
      })

      test("finds identifier in object pattern", () => {
        const code = "const { x, y } = obj"
        const root = j(code)
        const pattern = root.find(j.ObjectPattern).at(0).get().node
        assert.strictEqual(PatternChecker.containsIdentifier(j, pattern, "x"), true)
        assert.strictEqual(PatternChecker.containsIdentifier(j, pattern, "y"), true)
        assert.strictEqual(PatternChecker.containsIdentifier(j, pattern, "z"), false)
      })

      test("finds identifier in nested object pattern", () => {
        const code = "const { a: { b } } = obj"
        const root = j(code)
        const pattern = root.find(j.ObjectPattern).at(0).get().node
        assert.strictEqual(PatternChecker.containsIdentifier(j, pattern, "b"), true)
        assert.strictEqual(PatternChecker.containsIdentifier(j, pattern, "a"), false)
      })

      test("finds identifier in array pattern", () => {
        const code = "const [x, y] = arr"
        const root = j(code)
        const pattern = root.find(j.ArrayPattern).at(0).get().node
        assert.strictEqual(PatternChecker.containsIdentifier(j, pattern, "x"), true)
        assert.strictEqual(PatternChecker.containsIdentifier(j, pattern, "y"), true)
        assert.strictEqual(PatternChecker.containsIdentifier(j, pattern, "z"), false)
      })

      test("finds identifier in rest element", () => {
        const code = "const { x, ...rest } = obj"
        const root = j(code)
        const pattern = root.find(j.ObjectPattern).at(0).get().node
        assert.strictEqual(PatternChecker.containsIdentifier(j, pattern, "rest"), true)
      })

      test("finds identifier in assignment pattern", () => {
        const code = "const { x = 5 } = obj"
        const root = j(code)
        const pattern = root.find(j.ObjectPattern).at(0).get().node
        assert.strictEqual(PatternChecker.containsIdentifier(j, pattern, "x"), true)
      })

      test("finds identifier in array rest element", () => {
        const code = "const [x, ...rest] = arr"
        const root = j(code)
        const pattern = root.find(j.ArrayPattern).at(0).get().node
        assert.strictEqual(PatternChecker.containsIdentifier(j, pattern, "rest"), true)
      })
    })

    describe("extractIdentifiers", () => {
      test("returns nothing for null/undefined", () => {
        const result = [...PatternChecker.extractIdentifiers(j, null)]
        assert.deepStrictEqual(result, [])
      })

      test("extracts simple identifier", () => {
        const code = "const x = 1"
        const root = j(code)
        const identifier = root.find(j.Identifier, { name: "x" }).at(0).get().node
        const result = [...PatternChecker.extractIdentifiers(j, identifier)]
        assert.deepStrictEqual(result, ["x"])
      })

      test("extracts identifiers from object pattern", () => {
        const code = "const { a, b } = obj"
        const root = j(code)
        const pattern = root.find(j.ObjectPattern).at(0).get().node
        const result = [...PatternChecker.extractIdentifiers(j, pattern)]
        assert.deepStrictEqual(result, ["a", "b"])
      })

      test("extracts identifiers from nested object pattern", () => {
        const code = "const { a: { b } } = obj"
        const root = j(code)
        const pattern = root.find(j.ObjectPattern).at(0).get().node
        const result = [...PatternChecker.extractIdentifiers(j, pattern)]
        assert.deepStrictEqual(result, ["b"])
      })

      test("extracts identifiers from array pattern", () => {
        const code = "const [x, y] = arr"
        const root = j(code)
        const pattern = root.find(j.ArrayPattern).at(0).get().node
        const result = [...PatternChecker.extractIdentifiers(j, pattern)]
        assert.deepStrictEqual(result, ["x", "y"])
      })

      test("extracts identifiers from rest element in object", () => {
        const code = "const { a, ...rest } = obj"
        const root = j(code)
        const pattern = root.find(j.ObjectPattern).at(0).get().node
        const result = [...PatternChecker.extractIdentifiers(j, pattern)]
        assert.deepStrictEqual(result, ["a", "rest"])
      })

      test("extracts identifiers from rest element in array", () => {
        const code = "const [x, ...rest] = arr"
        const root = j(code)
        const pattern = root.find(j.ArrayPattern).at(0).get().node
        const result = [...PatternChecker.extractIdentifiers(j, pattern)]
        assert.deepStrictEqual(result, ["x", "rest"])
      })

      test("extracts identifiers from assignment pattern", () => {
        const code = "const { x = 5 } = obj"
        const root = j(code)
        const pattern = root.find(j.ObjectPattern).at(0).get().node
        const result = [...PatternChecker.extractIdentifiers(j, pattern)]
        assert.deepStrictEqual(result, ["x"])
      })
    })
  })

  describe("NodeChecker", () => {
    describe("areEquivalent", () => {
      test("returns false for null/undefined", () => {
        assert.strictEqual(NodeChecker.areEquivalent(j, null, null), false)
        const code = "const x = 1"
        const root = j(code)
        const node = root.find(j.Identifier).at(0).get().node
        assert.strictEqual(NodeChecker.areEquivalent(j, node, null), false)
        assert.strictEqual(NodeChecker.areEquivalent(j, null, node), false)
      })

      test("compares identifiers", () => {
        const code = "const x = y"
        const root = j(code)
        const identifiers = root.find(j.Identifier).paths()
        const x = identifiers[0].node
        const y = identifiers[1].node
        assert.strictEqual(NodeChecker.areEquivalent(j, x, x), true)
        assert.strictEqual(NodeChecker.areEquivalent(j, x, y), false)
      })

      test("compares literals", () => {
        const code = "const a = 1; const b = 1; const c = 2"
        const root = j(code)
        const literals = root.find(j.Literal).paths()
        const lit1a = literals[0].node
        const lit1b = literals[1].node
        const lit2 = literals[2].node
        assert.strictEqual(NodeChecker.areEquivalent(j, lit1a, lit1b), true)
        assert.strictEqual(NodeChecker.areEquivalent(j, lit1a, lit2), false)
      })

      test("compares member expressions", () => {
        const code = "obj.prop; obj.prop; obj.other"
        const root = j(code)
        const members = root.find(j.MemberExpression).paths()
        const mem1 = members[0].node
        const mem2 = members[1].node
        const mem3 = members[2].node
        assert.strictEqual(NodeChecker.areEquivalent(j, mem1, mem2), true)
        assert.strictEqual(NodeChecker.areEquivalent(j, mem1, mem3), false)
      })

      test("compares computed member expressions", () => {
        const code = "obj[prop]; obj[prop]; obj[other]"
        const root = j(code)
        const members = root.find(j.MemberExpression).paths()
        const mem1 = members[0].node
        const mem2 = members[1].node
        const mem3 = members[2].node
        assert.strictEqual(NodeChecker.areEquivalent(j, mem1, mem2), true)
        assert.strictEqual(NodeChecker.areEquivalent(j, mem1, mem3), false)
      })

      test("compares call expressions", () => {
        const code = "fn(1, 2); fn(1, 2); fn(1, 3)"
        const root = j(code)
        const calls = root.find(j.CallExpression).paths()
        const call1 = calls[0].node
        const call2 = calls[1].node
        const call3 = calls[2].node
        assert.strictEqual(NodeChecker.areEquivalent(j, call1, call2), true)
        assert.strictEqual(NodeChecker.areEquivalent(j, call1, call3), false)
      })

      test("compares call expressions with different argument counts", () => {
        const code = "fn(1); fn(1, 2)"
        const root = j(code)
        const calls = root.find(j.CallExpression).paths()
        const call1 = calls[0].node
        const call2 = calls[1].node
        assert.strictEqual(NodeChecker.areEquivalent(j, call1, call2), false)
      })

      test("returns false for different node types", () => {
        const code = "x; 1"
        const root = j(code)
        const identifier = root.find(j.Identifier).at(0).get().node
        const literal = root.find(j.Literal).at(0).get().node
        assert.strictEqual(NodeChecker.areEquivalent(j, identifier, literal), false)
      })
    })

    describe("isVerifiableIterable", () => {
      test("returns true for array literal", () => {
        const code = "[1, 2, 3]"
        const root = j(code)
        const arrayExpr = root.find(j.ArrayExpression).at(0).get().node
        assert.strictEqual(NodeChecker.isVerifiableIterable(j, arrayExpr), true)
      })

      test("returns true for Array.from()", () => {
        const code = "Array.from(items)"
        const root = j(code)
        const callExpr = root.find(j.CallExpression).at(0).get().node
        assert.strictEqual(NodeChecker.isVerifiableIterable(j, callExpr), true)
      })

      test("returns true for Array.of()", () => {
        const code = "Array.of(1, 2, 3)"
        const root = j(code)
        const callExpr = root.find(j.CallExpression).at(0).get().node
        assert.strictEqual(NodeChecker.isVerifiableIterable(j, callExpr), true)
      })

      test("returns true for new Array()", () => {
        const code = "new Array(5)"
        const root = j(code)
        const newExpr = root.find(j.NewExpression).at(0).get().node
        assert.strictEqual(NodeChecker.isVerifiableIterable(j, newExpr), true)
      })

      test("returns true for string split", () => {
        const code = '"a,b,c".split(",")'
        const root = j(code)
        const callExpr = root.find(j.CallExpression).at(0).get().node
        assert.strictEqual(NodeChecker.isVerifiableIterable(j, callExpr), true)
      })

      test("returns true for string slice", () => {
        const code = '"hello".slice(0, 2)'
        const root = j(code)
        const callExpr = root.find(j.CallExpression).at(0).get().node
        assert.strictEqual(NodeChecker.isVerifiableIterable(j, callExpr), true)
      })

      test("returns false for non-iterable", () => {
        const code = "obj.method()"
        const root = j(code)
        const callExpr = root.find(j.CallExpression).at(0).get().node
        assert.strictEqual(NodeChecker.isVerifiableIterable(j, callExpr), false)
      })

      test("returns false for identifier", () => {
        const code = "items"
        const root = j(code)
        const identifier = root.find(j.Identifier).at(0).get().node
        assert.strictEqual(NodeChecker.isVerifiableIterable(j, identifier), false)
      })
    })
  })

  describe("VariableChecker", () => {
    describe("isAssignmentShadowed", () => {
      test("returns true when shadowed by function parameter", () => {
        const code = `
          var x = 1;
          function fn(x) {
            x = 2;
          }
        `
        const root = j(code)
        const declarationPath = root
          .find(j.VariableDeclaration, { kind: "var" })
          .at(0)
          .paths()[0]
        const assignmentPath = root.find(j.AssignmentExpression).at(0).paths()[0]

        assert.strictEqual(
          VariableChecker.isAssignmentShadowed(j, "x", declarationPath, assignmentPath),
          true,
        )
      })

      test("returns true when shadowed by local declaration", () => {
        const code = `
          var x = 1;
          function fn() {
            var x = 2;
            x = 3;
          }
        `
        const root = j(code)
        const outerDeclaration = root.find(j.VariableDeclaration).at(0).paths()[0]
        const assignmentPath = root.find(j.AssignmentExpression).at(0).paths()[0]

        assert.strictEqual(
          VariableChecker.isAssignmentShadowed(
            j,
            "x",
            outerDeclaration,
            assignmentPath,
          ),
          true,
        )
      })

      test("returns false when not shadowed", () => {
        const code = `
          var x = 1;
          x = 2;
        `
        const root = j(code)
        const declarationPath = root.find(j.VariableDeclaration).at(0).paths()[0]
        const assignmentPath = root.find(j.AssignmentExpression).at(0).paths()[0]

        assert.strictEqual(
          VariableChecker.isAssignmentShadowed(j, "x", declarationPath, assignmentPath),
          false,
        )
      })

      test("returns false when assignment belongs to declaration", () => {
        const code = `
          function fn() {
            var x = 1;
            x = 2;
          }
        `
        const root = j(code)
        const declarationPath = root.find(j.VariableDeclaration).at(0).paths()[0]
        const assignmentPath = root.find(j.AssignmentExpression).at(0).paths()[0]

        assert.strictEqual(
          VariableChecker.isAssignmentShadowed(j, "x", declarationPath, assignmentPath),
          false,
        )
      })
    })

    describe("isReassigned", () => {
      test("returns true when variable is reassigned", () => {
        const code = `
          var x = 1;
          x = 2;
        `
        const root = j(code)
        const declarationPath = root.find(j.VariableDeclaration).at(0).paths()[0]

        assert.strictEqual(
          VariableChecker.isReassigned(j, root, "x", declarationPath),
          true,
        )
      })

      test("returns true when variable is updated with ++", () => {
        const code = `
          var x = 1;
          x++;
        `
        const root = j(code)
        const declarationPath = root.find(j.VariableDeclaration).at(0).paths()[0]

        assert.strictEqual(
          VariableChecker.isReassigned(j, root, "x", declarationPath),
          true,
        )
      })

      test("returns false when variable is not reassigned", () => {
        const code = `
          var x = 1;
          console.log(x);
        `
        const root = j(code)
        const declarationPath = root.find(j.VariableDeclaration).at(0).paths()[0]

        assert.strictEqual(
          VariableChecker.isReassigned(j, root, "x", declarationPath),
          false,
        )
      })

      test("returns false when assignment is shadowed", () => {
        const code = `
          var x = 1;
          function fn() {
            var x = 2;
            x = 3;
          }
        `
        const root = j(code)
        const declarationPath = root.find(j.VariableDeclaration).at(0).paths()[0]

        assert.strictEqual(
          VariableChecker.isReassigned(j, root, "x", declarationPath),
          false,
        )
      })

      test("returns false when different variable is reassigned", () => {
        const code = `
          var x = 1;
          var y = 2;
          y = 3;
        `
        const root = j(code)
        const declarationPath = root
          .find(j.VariableDeclaration)
          .filter((p) => p.node.declarations[0].id.name === "x")
          .at(0)
          .paths()[0]

        assert.strictEqual(
          VariableChecker.isReassigned(j, root, "x", declarationPath),
          false,
        )
      })
    })
  })
})
