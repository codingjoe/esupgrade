import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import jscodeshift from "jscodeshift"
import { transform } from "../../src/index.js"
import { promiseWithResolvers } from "../../src/widelyAvailable/promiseWithResolvers.js"

suite("widely-available", () => {
  describe("promiseWithResolvers", () => {
    test("transform combined binding declaration", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(result.modified, "transform combined binding declaration")
      assert.match(
        result.code,
        /const \{[\s\S]*promise,[\s\S]*resolve,[\s\S]*reject[\s\S]*\} = Promise\.withResolvers\(\)/,
      )
      assert.doesNotMatch(result.code, /new Promise/)
      assert.doesNotMatch(result.code, /let resolve/)
    })

    test("transform split binding declaration", () => {
      const result = transform(`
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(result.modified, "transform split binding declaration")
      assert.match(
        result.code,
        /const \{[\s\S]*promise,[\s\S]*resolve,[\s\S]*reject[\s\S]*\} = Promise\.withResolvers\(\)/,
      )
      assert.doesNotMatch(result.code, /new Promise/)
      assert.doesNotMatch(result.code, /let resolve/)
      assert.doesNotMatch(result.code, /let reject/)
    })

    test("transform renamed bindings to aliased properties", () => {
      const result = transform(`
  let done, fail;
  const p = new Promise((res, rej) => {
    done = res;
    fail = rej;
  });
  p.then(handle);
`)

      assert(result.modified, "transform renamed bindings")
      assert.match(
        result.code,
        /const \{[\s\S]*promise: p,[\s\S]*resolve: done,[\s\S]*reject: fail[\s\S]*\} = Promise\.withResolvers\(\)/,
      )
      assert.doesNotMatch(result.code, /new Promise/)
      assert.doesNotMatch(result.code, /let done/)
    })

    test("transform pattern inside a function body", () => {
      const result = transform(`
  function make() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    promise.then(handle);
  }
`)

      assert(result.modified, "transform pattern inside a function body")
      assert.match(result.code, /Promise\.withResolvers\(\)/)
      assert.match(result.code, /function make\(\)/)
      assert.doesNotMatch(result.code, /new Promise/)
    })

    test("preserve comments above a combined declaration", () => {
      const result = transform(`
  // deferred handle
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  }); // paired resolvers
  promise.then(handle);
`)

      assert(result.modified, "transform with comments on a combined declaration")
      assert.match(result.code, /\/\/ deferred handle/)
      assert.match(result.code, /\/\/ paired resolvers/)
      assert.doesNotMatch(result.code, /new Promise/)
    })

    test("preserve comments from split declarations", () => {
      const result = transform(`
  // resolve first
  let resolve;
  // reject second
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(result.modified, "transform with comments on split declarations")
      assert.match(result.code, /\/\/ resolve first/)
      assert.match(result.code, /\/\/ reject second/)
      assert.doesNotMatch(result.code, /new Promise/)
    })

    test("transform two patterns in one statement list", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(first);
  let done, fail;
  const second = new Promise((res, rej) => {
    done = res;
    fail = rej;
  });
  second.then(next);
`)

      assert(result.modified, "transform two patterns in one statement list")
      assert.equal(result.code.match(/Promise\.withResolvers\(\)/g).length, 2)
      assert.doesNotMatch(result.code, /new Promise/)
    })

    test("preserve ambient declare let bindings", () => {
      const result = transform(`
  declare let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "preserve ambient declare let bindings")
      assert.match(result.code, /declare let resolve, reject;/)
      assert.doesNotMatch(result.code, /withResolvers/)
      assert.doesNotMatch(result.code, /const \{/)
    })

    test("skip write to binding from sibling scope", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  function sibling() {
    resolve = 1;
  }
  promise.then(handle);
`)

      assert(!result.modified, "skip write from sibling scope")
      assert.match(result.code, /new Promise/)
      assert.match(result.code, /let resolve, reject;/)
    })

    test("skip write from a scope that redeclares the binding", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  function sibling() {
    let resolve;
    resolve = 1;
  }
  promise.then(handle);
`)

      assert(!result.modified, "skip write from a scope that redeclares the binding")
      assert.match(result.code, /new Promise/)
    })

    test("skip write hidden by a non-null assertion", () => {
      const source = `
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  resolve! = 1;
  promise.then(handle);
`
      const result = transform(source)

      assert.equal(result.modified, false, "skip write hidden by a non-null assertion")
      assert.equal(result.code, source, "leave the source unchanged")
    })

    test("skip write hidden by a type assertion", () => {
      const source = `
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  ;(resolve as any) = 1;
  promise.then(handle);
`
      const result = transform(source)

      assert.equal(result.modified, false, "skip write hidden by a type assertion")
      assert.equal(result.code, source, "leave the source unchanged")
    })

    test("skip write hidden by a satisfies expression", () => {
      const source = `
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  ;(resolve satisfies any) = 1;
  promise.then(handle);
`
      const result = transform(source)

      assert.equal(
        result.modified,
        false,
        "skip write hidden by a satisfies expression",
      )
      assert.equal(result.code, source, "leave the source unchanged")
    })

    test("skip array destructured write hidden by a non-null assertion", () => {
      const source = `
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  ;[resolve!] = [1];
  promise.then(handle);
`
      const result = transform(source)

      assert.equal(
        result.modified,
        false,
        "skip array destructured write hidden by a non-null assertion",
      )
      assert.equal(result.code, source, "leave the source unchanged")
    })

    test("skip object destructured write hidden by a non-null assertion", () => {
      const source = `
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  ;({ x: resolve! } = obj);
  promise.then(handle);
`
      const result = transform(source)

      assert.equal(
        result.modified,
        false,
        "skip object destructured write hidden by a non-null assertion",
      )
      assert.equal(result.code, source, "leave the source unchanged")
    })

    test("skip update hidden by a non-null assertion", () => {
      const source = `
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  reject!++;
  promise.then(handle);
`
      const result = transform(source)

      assert.equal(result.modified, false, "skip update hidden by a non-null assertion")
      assert.equal(result.code, source, "leave the source unchanged")
    })

    test("skip compound write hidden by a non-null assertion", () => {
      const source = `
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  resolve! += 1;
  promise.then(handle);
`
      const result = transform(source)

      assert.equal(
        result.modified,
        false,
        "skip compound write hidden by a non-null assertion",
      )
      assert.equal(result.code, source, "leave the source unchanged")
    })

    test("skip for-of target hidden by a non-null assertion", () => {
      const source = `
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  for (resolve! of [1]) {}
  promise.then(handle);
`
      const result = transform(source)

      assert.equal(
        result.modified,
        false,
        "skip for-of target hidden by a non-null assertion",
      )
      assert.equal(result.code, source, "leave the source unchanged")
    })

    test("skip update expression write", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  resolve++;
  promise.then(handle);
`)

      assert(!result.modified, "skip update expression write")
      assert.match(result.code, /new Promise/)
      assert.match(result.code, /resolve\+\+/)
    })

    test("skip for-of loop target write", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  for (resolve of xs) {
    log(resolve);
  }
  promise.then(handle);
`)

      assert(!result.modified, "skip for-of loop target write")
      assert.match(result.code, /new Promise/)
      assert.match(result.code, /for \(resolve of xs\)/)
    })

    test("skip for-in loop target write", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  for (resolve in xs) {
    log(resolve);
  }
  promise.then(handle);
`)

      assert(!result.modified, "skip for-in loop target write")
      assert.match(result.code, /for \(resolve in xs\)/)
    })

    test("transform promise declaration without later writes", () => {
      const result = transform(`
  let resolve, reject;
  let promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(result.modified, "transform promise declaration without later writes")
      assert.match(
        result.code,
        /const \{[\s\S]*promise,[\s\S]*resolve,[\s\S]*reject[\s\S]*\} = Promise\.withResolvers\(\)/,
      )
      assert.doesNotMatch(result.code, /new Promise/)
      assert.doesNotMatch(result.code, /let promise/)
    })

    test("skip write to promise binding", () => {
      const result = transform(`
  let resolve, reject;
  let promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise = null;
`)

      assert(!result.modified, "skip write to promise binding")
      assert.match(result.code, /new Promise/)
      assert.match(result.code, /promise = null;/)
    })

    test("skip promise binding that is never read", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
`)

      assert(!result.modified, "skip promise binding that is never read")
      assert.match(result.code, /new Promise/)
    })

    test("skip generator executor", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise(function* (res, rej) {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip generator executor")
      assert.match(result.code, /new Promise/)
      assert.match(result.code, /function\* \(res, rej\)/)
    })

    test("skip function expression executor named like a binding", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise(function resolve(res, rej) {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip executor named like a binding")
      assert.match(result.code, /new Promise/)
      assert.match(result.code, /function resolve\(res, rej\)/)
    })

    test("transform named function expression executor", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise(function executor(res, rej) {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(result.modified, "transform named function expression executor")
      assert.match(result.code, /Promise\.withResolvers\(\)/)
      assert.doesNotMatch(result.code, /new Promise/)
      assert.doesNotMatch(result.code, /function executor/)
    })

    test("skip bindings followed by a non-declaration statement", () => {
      const result = transform(`
  let resolve, reject;
  setup();
  consume(new Promise((res) => res));
`)

      assert(!result.modified, "skip bindings without a promise declaration")
      assert.match(result.code, /let resolve, reject;/)
      assert.match(result.code, /setup\(\)/)
    })

    test("skip a lone binding declaration", () => {
      const result = transform(`
  let resolve;
`)

      assert(!result.modified, "skip a lone binding declaration")
      assert.match(result.code, /let resolve;/)
    })

    test("skip binding followed by a non-declaration statement", () => {
      const result = transform(`
  let resolve;
  setup();
`)

      assert(!result.modified, "skip binding followed by a non-declaration statement")
      assert.match(result.code, /setup\(\)/)
    })

    test("skip declaration with more than two bindings", () => {
      const result = transform(`
  let a, b, c;
  const promise = new Promise((res, rej) => {
    a = res;
    b = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip declaration with more than two bindings")
      assert.match(result.code, /new Promise/)
    })

    test("skip declaration between the bindings and the promise", () => {
      const result = transform(`
  let resolve, reject;
  let extra;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip declaration between the bindings and the promise")
      assert.match(result.code, /new Promise/)
    })

    test("skip when Promise is shadowed", () => {
      const result = transform(`
  function run(Promise) {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    promise.then(handle);
  }
`)

      assert(!result.modified, "skip when Promise is shadowed")
      assert.match(result.code, /new Promise/)
    })

    test("skip promise declaration with var kind", () => {
      const j = jscodeshift.withParser("tsx")
      const root = j(`
  let resolve, reject;
  var promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!promiseWithResolvers(root), "skip var promise declaration")
    })

    test("skip promise declaration with multiple declarators", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  }), extra = 1;
  promise.then(handle);
`)

      assert(!result.modified, "skip promise declaration with extra declarators")
      assert.match(result.code, /extra = 1/)
    })

    test("skip destructured promise declaration", () => {
      const result = transform(`
  let resolve, reject;
  const { promise } = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip destructured promise declaration")
      assert.match(result.code, /new Promise/)
    })

    test("skip typed promise declaration", () => {
      const result = transform(`
  let resolve, reject;
  const promise: Promise<void> = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip typed promise declaration")
      assert.match(result.code, /new Promise/)
    })

    test("skip destructured binding declaration", () => {
      const result = transform(`
  let { resolve, reject } = source;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip destructured binding declaration")
      assert.match(result.code, /new Promise/)
    })

    test("skip typed binding declaration", () => {
      const result = transform(`
  let resolve: any, reject: any;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip typed binding declaration")
      assert.match(result.code, /new Promise/)
    })

    test("skip split binding declaration with extra declarator", () => {
      const result = transform(`
  let resolve;
  let reject, extra;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip split declaration with extra declarator")
      assert.match(result.code, /new Promise/)
    })

    test("skip initializer that is not a constructor call", () => {
      const result = transform(`
  let resolve, reject;
  const promise = makePromise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip initializer that is not a constructor call")
      assert.match(result.code, /makePromise/)
    })

    test("skip constructor accessed as a member expression", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new globalThis.Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip constructor accessed as a member expression")
      assert.match(result.code, /globalThis\.Promise/)
    })

    test("skip constructor that is not Promise", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Other((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip constructor that is not Promise")
      assert.match(result.code, /new Other/)
    })

    test("skip typed Promise constructor", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip typed Promise constructor")
      assert.match(result.code, /new Promise<void>/)
    })

    test("skip Promise constructor without executor argument", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise();
  promise.then(handle);
`)

      assert(!result.modified, "skip Promise constructor without executor")
      assert.match(result.code, /new Promise\(\)/)
    })

    test("skip Promise constructor with two arguments", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  }, options);
  promise.then(handle);
`)

      assert(!result.modified, "skip Promise constructor with two arguments")
      assert.match(result.code, /new Promise/)
      assert.match(result.code, /options/)
    })

    test("skip spread executor argument", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise(...executors);
  promise.then(handle);
`)

      assert(!result.modified, "skip spread executor argument")
      assert.match(result.code, /\.\.\.executors/)
    })

    test("skip executor that is not a function", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise(executor);
  promise.then(handle);
`)

      assert(!result.modified, "skip executor that is not a function")
      assert.match(result.code, /new Promise\(executor\)/)
    })

    test("skip executor with expression body", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => (resolve = res));
  promise.then(handle);
`)

      assert(!result.modified, "skip executor with expression body")
      assert.match(result.code, /new Promise/)
    })

    test("skip executor with a single parameter", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res) => {
    resolve = res;
    reject = res;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip executor with a single parameter")
      assert.match(result.code, /new Promise/)
    })

    test("skip executor with a destructured parameter", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise(({ res }, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip executor with a destructured parameter")
      assert.match(result.code, /new Promise/)
    })

    test("skip executor with a default parameter", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej = fallback) => {
    resolve = res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip executor with a default parameter")
      assert.match(result.code, /rej = fallback/)
    })

    test("skip executor parameter shadowing a binding", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, reject) => {
    resolve = res;
    reject = reject;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip executor parameter shadowing a binding")
      assert.match(result.code, /new Promise/)
    })

    test("skip executor with extra statements", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
    notify();
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip executor with extra statements")
      assert.match(result.code, /notify\(\)/)
    })

    test("skip executor with non-expression statement", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    if (ready) {
      reject = rej;
    }
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip executor with non-expression statement")
      assert.match(result.code, /if \(ready\)/)
    })

    test("skip executor with non-assignment expression", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip executor with non-assignment expression")
      assert.match(result.code, /rej;/)
    })

    test("skip executor with compound assignment", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject += rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip executor with compound assignment")
      assert.match(result.code, /reject \+= rej/)
    })

    test("skip logical assignment to a binding", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve ||= res;
    reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip logical assignment to a binding")
      assert.match(result.code, /resolve \|\|= res/)
    })

    test("skip assignment from a call expression", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = makeReject();
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip assignment from a call expression")
      assert.match(result.code, /reject = makeReject\(\)/)
    })

    test("skip assignment to a member expression", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    obj.reject = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip assignment to a member expression")
      assert.match(result.code, /obj\.reject = rej/)
    })

    test("skip assignment from a member expression", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej.value;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip assignment from a member expression")
      assert.match(result.code, /reject = rej\.value/)
    })

    test("skip assignment to an unknown binding", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    other = rej;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip assignment to an unknown binding")
      assert.match(result.code, /other = rej/)
    })

    test("skip assignment from the wrong parameter", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = other;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip assignment from the wrong parameter")
      assert.match(result.code, /reject = other/)
    })

    test("skip executor assigning the same binding twice", () => {
      const result = transform(`
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    resolve = res;
  });
  promise.then(handle);
`)

      assert(!result.modified, "skip executor assigning the same binding twice")
      assert.match(result.code, /new Promise/)
    })
  })
})
