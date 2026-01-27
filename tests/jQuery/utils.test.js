import assert from "node:assert/strict"
import { default as j } from "jscodeshift"
import { describe, suite, test } from "node:test"
import {
  isTransformableJQueryMethod,
  areAllChainedMethodsTransformable,
  getJQueryInitTarget,
  isSafeToTransformInitializer,
  isJQueryObject,
} from "../../src/jQuery/utils.js"

suite("jQuery utils", () => {
  describe("isTransformableJQueryMethod", () => {
    test("return true for valid DOM method", () => {
      assert.equal(isTransformableJQueryMethod("addEventListener"), true)
    })

    test("return false for invalid method", () => {
      assert.equal(isTransformableJQueryMethod("notARealMethod"), false)
    })
  })

  describe("areAllChainedMethodsTransformable", () => {
    test("return true for null callPath", () => {
      assert.equal(areAllChainedMethodsTransformable(null), true)
    })

    test("return true for callPath without node", () => {
      const mockPath = {}
      assert.equal(areAllChainedMethodsTransformable(mockPath), true)
    })

    test("return true for callPath with non-CallExpression node", () => {
      const mockPath = { node: { type: "Identifier" } }
      assert.equal(areAllChainedMethodsTransformable(mockPath), true)
    })

    test("return true for no chained methods", () => {
      const root = j("$(element)")
      const callPath = root.find(j.CallExpression).paths()[0]
      assert.equal(areAllChainedMethodsTransformable(callPath), true)
    })

    test("return false for untransformable chained method", () => {
      const root = j("$(element).notADOMMethod()")
      const callPath = root
        .find(j.CallExpression, {
          callee: { type: "Identifier" },
        })
        .paths()[0]
      assert.equal(areAllChainedMethodsTransformable(callPath), false)
    })

    test("return true for transformable chained method", () => {
      const root = j("$(element).addEventListener('click', fn)")
      const callPath = root
        .find(j.CallExpression, {
          callee: { type: "Identifier" },
        })
        .paths()[0]
      assert.equal(areAllChainedMethodsTransformable(callPath), true)
    })

    test("return true for member expression not being called", () => {
      const root = j("$(element).prop")
      const callPath = root.find(j.CallExpression).paths()[0]
      assert.equal(areAllChainedMethodsTransformable(callPath), true)
    })
  })

  describe("getJQueryInitTarget", () => {
    test("return null for empty identifier name", () => {
      const root = j("")
      assert.equal(getJQueryInitTarget(root, ""), null)
    })

    test("return null for null identifier name", () => {
      const root = j("")
      assert.equal(getJQueryInitTarget(root, null), null)
    })

    test("resolve variable declaration", () => {
      const root = j("const el = $(node);")
      const result = getJQueryInitTarget(root, "el")
      assert.notEqual(result, null)
    })

    test("return null for non-jQuery variable declaration", () => {
      const root = j("const el = someFunc();")
      assert.equal(getJQueryInitTarget(root, "el"), null)
    })

    test("return null for variable with no init", () => {
      const root = j("let el;")
      assert.equal(getJQueryInitTarget(root, "el"), null)
    })

    test("return null for top-level $-prefixed variable", () => {
      const root = j("const $el = $(node);")
      assert.equal(getJQueryInitTarget(root, "$el"), null)
    })

    test("return null for jQuery call with no arguments", () => {
      const root = j("const el = $();")
      assert.equal(getJQueryInitTarget(root, "el"), null)
    })

    test("find first declaration when multiple assignments exist", () => {
      const root = j("let el = $(node1); el = $(node2);")
      const result = getJQueryInitTarget(root, "el")
      // Current behavior: returns first declaration
      assert.notEqual(result, null)
    })

    test("return null when declaration exists without jQuery init", () => {
      const root = j("let el; el = $(node);")
      const result = getJQueryInitTarget(root, "el")
      // Returns null because the declaration exists but has no init,
      // and it doesn't check assignments when a declaration exists
      assert.equal(result, null)
    })

    test("resolve pure assignment expression without declaration", () => {
      const root = j("el = $(node);")
      const result = getJQueryInitTarget(root, "el")
      // This should succeed since there's no variable declaration
      assert.notEqual(result, null)
      assert.equal(result.type, "Identifier")
    })

    test("return null for non-jQuery assignment", () => {
      const root = j("let el; el = someFunc();")
      assert.equal(getJQueryInitTarget(root, "el"), null)
    })

    test("return null for assignment with no arguments", () => {
      const root = j("let el; el = $();")
      assert.equal(getJQueryInitTarget(root, "el"), null)
    })

    test("return null for inconsistent assignments", () => {
      const root = j("let el; el = $(node1); el = $(node2);")
      assert.equal(getJQueryInitTarget(root, "el"), null)
    })

    test("return null when no declaration or assignment found", () => {
      const root = j("const other = $(node);")
      assert.equal(getJQueryInitTarget(root, "el"), null)
    })

    test("return null when variable has update expression", () => {
      const root = j("const el = $(node); el++;")
      assert.equal(getJQueryInitTarget(root, "el"), null)
    })

    test("return null when variable has prefix update expression", () => {
      const root = j("const el = $(node); ++el;")
      assert.equal(getJQueryInitTarget(root, "el"), null)
    })

    test("find initial declaration even when reassigned later", () => {
      const root = j("let el = $(node); el = $(otherNode);")
      const result = getJQueryInitTarget(root, "el")
      // Current behavior: finds the first declaration, doesn't detect reassignment
      // This could be improved but matches current implementation
      assert.notEqual(result, null)
    })

    test("resolve variable used in member expression", () => {
      const root = j("const el = $(node); el.classList;")
      const result = getJQueryInitTarget(root, "el")
      // This should succeed because member expression is a safe usage
      assert.notEqual(result, null)
      assert.equal(result.type, "Identifier")
      assert.equal(result.name, "node")
    })

    test("return null when variable used in non-safe context", () => {
      const root = j("const el = $(node); func(el);")
      assert.equal(getJQueryInitTarget(root, "el"), null)
    })

    test("cache results for same identifier", () => {
      const root = j("const el = $(node);")
      const result1 = getJQueryInitTarget(root, "el")
      const result2 = getJQueryInitTarget(root, "el")
      assert.equal(result1, result2)
    })
  })

  describe("isSafeToTransformInitializer", () => {
    test("return true for null callPath", () => {
      const root = j("")
      assert.equal(isSafeToTransformInitializer(root, null), true)
    })

    test("return false for top-level $-prefixed variable", () => {
      const root = j("const $el = $(node);")
      const callPath = root.find(j.CallExpression).paths()[0]
      assert.equal(isSafeToTransformInitializer(root, callPath), false)
    })

    test("return true for unused variable", () => {
      const root = j("const el = $(node);")
      const callPath = root.find(j.CallExpression).paths()[0]
      assert.equal(isSafeToTransformInitializer(root, callPath), true)
    })

    test("return true for used variable with safe usage", () => {
      const root = j("const el = $(node); el.classList;")
      const callPath = root.find(j.CallExpression).paths()[0]
      const result = isSafeToTransformInitializer(root, callPath)
      assert.equal(result, true)
    })

    test("return false for assignment to $-prefixed identifier", () => {
      const root = j("let $el; $el = $(node);")
      const callPath = root.find(j.CallExpression).paths()[0]
      assert.equal(isSafeToTransformInitializer(root, callPath), false)
    })

    test("check assignment to non-$-prefixed identifier", () => {
      const root = j("let el; el = $(node);")
      const callPath = root.find(j.CallExpression).paths()[0]
      const result = isSafeToTransformInitializer(root, callPath)
      // This returns false because el is used in the assignment expression itself
      assert.equal(result, false)
    })

    test("return true for non-variable-declarator parent", () => {
      const root = j("func($(node));")
      const callPath = root
        .find(j.CallExpression, {
          callee: { type: "Identifier", name: "$" },
        })
        .paths()[0]
      assert.equal(isSafeToTransformInitializer(root, callPath), true)
    })
  })

  describe("isJQueryObject", () => {
    test("return false for null object", () => {
      const root = j("")
      assert.equal(isJQueryObject(root, null), false)
    })

    test("return true for direct jQuery call with arguments", () => {
      const root = j("$(node)")
      const callExpr = root.find(j.CallExpression).paths()[0].node
      assert.equal(isJQueryObject(root, callExpr), true)
    })

    test("return false for direct jQuery call without arguments", () => {
      const root = j("$()")
      const callExpr = root.find(j.CallExpression).paths()[0].node
      assert.equal(isJQueryObject(root, callExpr), false)
    })

    test("return false for identifier in unsafe context", () => {
      const root = j("const el = $(node); func(el);")
      // Get the identifier passed to func
      const funcCall = root
        .find(j.CallExpression, {
          callee: { type: "Identifier", name: "func" },
        })
        .paths()[0]
      const ident = funcCall.node.arguments[0]
      assert.equal(isJQueryObject(root, ident), false)
    })

    test("return false for non-jQuery identifier", () => {
      const root = j("const el = someFunc(); el;")
      const ident = root.find(j.Identifier, { name: "el" }).paths()[1].node
      assert.equal(isJQueryObject(root, ident), false)
    })

    test("return false for other expression types", () => {
      const root = j("123")
      const literal = root.find(j.Literal).paths()[0].node
      assert.equal(isJQueryObject(root, literal), false)
    })
  })
})
