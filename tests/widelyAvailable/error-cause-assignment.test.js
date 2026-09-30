import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("errorCauseAssignment", () => {
    describe("transformable patterns", () => {
      test("inlines the error into a directly following throw", () => {
        const result = transform(`
const error = new Error("msg");
error.cause = cause;
throw error;
`)

        assert(result.modified, "transform error.cause assignment")
        assert.match(result.code, /throw new Error\("msg", \{\s*cause\s*\}\)/)
        assert.doesNotMatch(result.code, /const error/)
      })

      test("inlines inside a function", () => {
        const result = transform(`
function wrap(cause) {
  const error = new TypeError("msg");
  error.cause = cause;
  throw error;
}
`)

        assert(result.modified, "transform error.cause assignment in a function")
        assert.match(result.code, /throw new TypeError\("msg", \{\s*cause\s*\}\)/)
        assert.doesNotMatch(result.code, /error\.cause/)
      })

      test("inlines inside an async function", () => {
        const result = transform(`
async function wrap(cause) {
  const error = new RangeError("msg");
  error.cause = cause;
  throw error;
}
`)

        assert(result.modified, "transform error.cause assignment in an async function")
        assert.match(result.code, /throw new RangeError\("msg", \{\s*cause\s*\}\)/)
      })

      test("inlines inside a nested block", () => {
        const result = transform(`
function wrap(cause) {
  {
    const error = new ReferenceError("msg");
    error.cause = cause;
    throw error;
  }
}
`)

        assert(result.modified, "transform error.cause assignment in a block")
        assert.match(result.code, /throw new ReferenceError\("msg", \{\s*cause\s*\}\)/)
      })

      test("inlines inside a switch case", () => {
        const result = transform(`
function wrap(kind, cause) {
  switch (kind) {
    case 1:
      const error = new SyntaxError("msg");
      error.cause = cause;
      throw error;
  }
}
`)

        assert(result.modified, "transform error.cause assignment in a switch case")
        assert.match(result.code, /throw new SyntaxError\("msg", \{\s*cause\s*\}\)/)
      })

      test("inlines inside a class static block", () => {
        const result = transform(`
class Holder {
  static {
    const error = new URIError("msg");
    error.cause = cause;
    throw error;
  }
}
`)

        assert(result.modified, "transform error.cause assignment in a static block")
        assert.match(result.code, /throw new URIError\("msg", \{\s*cause\s*\}\)/)
      })

      test("merges when the assignment is the last statement", () => {
        const result = transform(`
const error = new Error("msg");
error.cause = cause;
`)

        assert(result.modified, "merge error.cause assignment")
        assert.match(result.code, /const error = new Error\("msg", \{\s*cause\s*\}\)/)
        assert.doesNotMatch(result.code, /error\.cause/)
      })

      test("merges when a later statement reads the binding", () => {
        const result = transform(`
const error = new Error("msg");
error.cause = cause;
report(error);
`)

        assert(result.modified, "merge while keeping the binding")
        assert.match(result.code, /const error = new Error\("msg", \{\s*cause\s*\}\)/)
        assert.match(result.code, /report\(error\)/)
        assert.doesNotMatch(result.code, /error\.cause/)
      })

      test("merges when a nested function reads the binding", () => {
        const result = transform(`
function wrap(cause) {
  const error = new Error("msg");
  error.cause = cause;
  throw error;
  function read() { return error; }
}
`)

        assert(result.modified, "merge when a nested function reads the binding")
        assert.match(result.code, /const error = new Error\("msg", \{\s*cause\s*\}\)/)
        assert.match(result.code, /throw error;/)
        assert.doesNotMatch(result.code, /error\.cause/)
      })

      test("keeps the cause key for a non-identifier value", () => {
        const result = transform(`
const error = new Error("msg");
error.cause = getCause();
throw error;
`)

        assert(result.modified, "merge a call expression cause")
        assert.match(
          result.code,
          /throw new Error\("msg", \{\s*cause: getCause\(\)\s*\}\)/,
        )
      })

      test("appends the options argument for AggregateError", () => {
        const result = transform(`
const error = new AggregateError(errors, "msg");
error.cause = cause;
throw error;
`)

        assert(result.modified, "transform AggregateError cause assignment")
        assert.match(
          result.code,
          /throw new AggregateError\(errors, "msg", \{\s*cause\s*\}\)/,
        )
      })

      test("appends the options argument for every built-in error constructor", () => {
        const constructors = [
          "Error",
          "EvalError",
          "RangeError",
          "ReferenceError",
          "SyntaxError",
          "TypeError",
          "URIError",
        ]

        for (const name of constructors) {
          const result = transform(`
const error = new ${name}("msg");
error.cause = cause;
throw error;
`)

          assert(result.modified, `transform new ${name} cause assignment`)
          assert.match(
            result.code,
            new RegExp(`throw new ${name}\\("msg", \\{\\s*cause\\s*\\}\\)`),
          )
        }
      })

      test("preserves comments when inlining", () => {
        const result = transform(`
function wrap(cause) {
  // lead
  const error = new Error("msg"); // trail
  // assign
  error.cause = cause;
  // throwing
  throw error;
}
`)

        assert(result.modified, "inline with comments")
        assert.match(result.code, /\/\/ lead/)
        assert.match(result.code, /\/\/ trail/)
        assert.match(result.code, /\/\/ assign/)
        assert.match(result.code, /\/\/ throwing/)
        assert.match(result.code, /throw new Error\("msg", \{\s*cause\s*\}\)/)
      })

      test("preserves comments when merging", () => {
        const result = transform(`
// lead
const error = new Error("msg");
// assign
error.cause = cause;
report(error);
`)

        assert(result.modified, "merge with comments")
        assert.match(result.code, /\/\/ lead/)
        assert.match(result.code, /\/\/ assign/)
        assert.match(result.code, /const error = new Error\("msg", \{\s*cause\s*\}\)/)
      })

      test("transforms a let declaration", () => {
        const result = transform(`
let error = new Error("msg");
error.cause = cause;
throw error;
`)

        assert(result.modified, "transform let declaration")
        assert.match(result.code, /throw new Error\("msg", \{\s*cause\s*\}\)/)
      })

      test("merges when the throw carries another binding", () => {
        const result = transform(`
function wrap(cause) {
  const error = new Error("msg");
  error.cause = cause;
  throw other;
}
`)

        assert(result.modified, "merge when the throw carries another binding")
        assert.match(result.code, /const error = new Error\("msg", \{\s*cause\s*\}\);/)
        assert.match(result.code, /throw other;/)
        assert.doesNotMatch(result.code, /error\.cause/)
      })

      test("merges when the throw carries an expression", () => {
        const result = transform(`
function wrap(cause) {
  const error = new Error("msg");
  error.cause = cause;
  throw wrap(error);
}
`)

        assert(result.modified, "merge when the throw carries an expression")
        assert.match(result.code, /const error = new Error\("msg", \{\s*cause\s*\}\);/)
        assert.match(result.code, /throw wrap\(error\);/)
        assert.doesNotMatch(result.code, /error\.cause/)
      })

      test("transforms a var declaration", () => {
        const result = transform(`
var error = new Error("msg");
error.cause = cause;
throw error;
`)

        assert(result.modified, "transform var declaration")
        assert.match(result.code, /throw new Error\("msg", \{\s*cause\s*\}\)/)
      })
    })

    describe("skip patterns", () => {
      test("skips a custom error class", () => {
        const result = transform(`
const error = new HttpError("msg");
error.cause = cause;
`)

        assert(!result.modified, "skip custom error class")
      })

      test("skips a namespaced constructor", () => {
        const result = transform(`
const error = new lib.Error("msg");
error.cause = cause;
`)

        assert(!result.modified, "skip namespaced constructor")
      })

      test("skips a factory call", () => {
        const result = transform(`
const error = makeError("msg");
error.cause = cause;
`)

        assert(!result.modified, "skip factory call")
      })

      test("skips a declaration with multiple declarators", () => {
        const result = transform(`
const error = new Error("msg"), other = 1;
error.cause = cause;
`)

        assert(!result.modified, "skip multiple declarators")
      })

      test("skips a destructured binding", () => {
        const result = transform(`
const { message } = new Error("msg");
message.cause = cause;
`)

        assert(!result.modified, "skip destructured binding")
      })

      test("skips a declaration outside a statement list", () => {
        const result = transform(`
for (const error = new Error("msg"); false; ) {
  error.cause = cause;
}
`)

        assert(!result.modified, "skip declaration in a for initializer")
      })

      test("skips a shadowed Error constructor", () => {
        const result = transform(`
function wrap(Error, cause) {
  const error = new Error("msg");
  error.cause = cause;
}
`)

        assert(!result.modified, "skip shadowed Error")
      })

      test("skips a class shadowing Error", () => {
        const result = transform(`
function wrap(cause) {
  class Error {}
  const error = new Error("msg");
  error.cause = cause;
}
`)

        assert(!result.modified, "skip Error shadowed by a class")
      })

      test("skips a construction without a message", () => {
        const result = transform(`
const error = new Error();
error.cause = cause;
`)

        assert(!result.modified, "skip construction without a message")
      })

      test("skips a construction that already passes options", () => {
        const result = transform(`
const error = new Error("msg", options);
error.cause = cause;
`)

        assert(!result.modified, "skip construction with options")
      })

      test("skips a spread argument", () => {
        const result = transform(`
const error = new Error(...args);
error.cause = cause;
`)

        assert(!result.modified, "skip spread argument")
      })

      test("skips a self-referencing cause", () => {
        const result = transform(`
function wrap() {
  const error = new Error("msg");
  error.cause = error;
  throw error;
}
`)

        assert(!result.modified, "skip self-referencing cause")
      })

      test("skips a cause that captures the binding in a closure", () => {
        const result = transform(`
function wrap(cause) {
  const error = new Error("msg");
  error.cause = () => error;
  throw error;
}
`)

        assert(!result.modified, "skip closure-capturing cause")
      })

      test("skips an assignment that is not adjacent", () => {
        const result = transform(`
const error = new Error("msg");
const other = 1;
error.cause = cause;
`)

        assert(!result.modified, "skip non-adjacent assignment")
      })

      test("skips a cause assignment without a construction", () => {
        const result = transform(`
let error;
error.cause = cause;
`)

        assert(!result.modified, "skip cause assignment without construction")
      })

      test("skips a computed cause property", () => {
        const result = transform(`
const error = new Error("msg");
error["cause"] = cause;
`)

        assert(!result.modified, "skip computed cause property")
      })

      test("skips a non-cause property", () => {
        const result = transform(`
const error = new Error("msg");
error.message = cause;
`)

        assert(!result.modified, "skip non-cause property")
      })

      test("skips a compound cause assignment", () => {
        const result = transform(`
const error = new Error("msg");
error.cause ??= cause;
`)

        assert(!result.modified, "skip compound cause assignment")
      })

      test("skips a reassigned binding", () => {
        const result = transform(`
let error = new Error("msg");
error = cause;
`)

        assert(!result.modified, "skip reassigned binding")
      })

      test("skips a different receiver", () => {
        const result = transform(`
const error = new Error("msg");
other.cause = cause;
`)

        assert(!result.modified, "skip different receiver")
      })

      test("skips a member receiver", () => {
        const result = transform(`
const error = new Error("msg");
other.error.cause = cause;
`)

        assert(!result.modified, "skip member receiver")
      })

      test("skips a cause update", () => {
        const result = transform(`
const error = new Error("msg");
error.cause++;
`)

        assert(!result.modified, "skip cause update")
      })

      test("skips a declaration without a cause assignment", () => {
        const result = transform(`
const error = new Error("msg");
throw error;
`)

        assert(!result.modified, "skip declaration without cause assignment")
      })

      test("leaves already transformed code alone", () => {
        const result = transform(`
throw new Error("msg", { cause });
`)

        assert(!result.modified, "skip already transformed code")
      })
    })
  })
})
