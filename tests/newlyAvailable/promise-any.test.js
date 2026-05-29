import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("newly-available", () => {
  describe("Promise.any", () => {
    test("transform direct then rejection counter", () => {
      assert.match(
        transform(
          `const first = new Promise((resolve, reject) => {
  let rejectedCount = 0;
  promises.forEach((promise) => promise.then(resolve, () => {
    rejectedCount += 1;
    if (rejectedCount === promises.length) {
      reject(new AggregateError());
    }
  }));
});`,
          "newly-available",
        ).code,
        /Promise\.any\(promises\)/,
      )
    })

    test("transform block callback and Promise.resolve", () => {
      assert.match(
        transform(
          `const first = new Promise(function(resolve, reject) {
  let rejectedCount = 0;
  promises.forEach(function(promise) {
    Promise.resolve(promise).then(resolve, function() {
      ++rejectedCount;
      if (rejectedCount === promises.length) {
        reject();
      }
    });
  });
});`,
          "newly-available",
        ).code,
        /Promise\.any\(promises\)/,
      )
    })

    test("not available in widely-available baseline", () => {
      assert.doesNotMatch(
        transform(
          `const first = new Promise((resolve, reject) => {
  let rejectedCount = 0;
  promises.forEach((promise) => promise.then(resolve, () => {
    rejectedCount += 1;
    if (rejectedCount === promises.length) {
      reject(new AggregateError());
    }
  }));
});`,
          "widely-available",
        ).code,
        /Promise\.any\(promises\)/,
      )
    })

    test("skip extra executor statements", () => {
      assert.equal(
        transform(
          `const first = new Promise((resolve, reject) => {
  let rejectedCount = 0;
  log(promises);
  promises.forEach((promise) => promise.then(resolve, () => {
    rejectedCount += 1;
    if (rejectedCount === promises.length) {
      reject(new AggregateError());
    }
  }));
});`,
          "newly-available",
        ).modified,
        false,
      )
    })

    test("skip non-identifier promises expression", () => {
      assert.equal(
        transform(
          `const first = new Promise((resolve, reject) => {
  let rejectedCount = 0;
  getPromises().forEach((promise) => promise.then(resolve, () => {
    rejectedCount += 1;
    if (rejectedCount === getPromises().length) {
      reject(new AggregateError());
    }
  }));
});`,
          "newly-available",
        ).modified,
        false,
      )
    })

    test("skip mismatched length comparison", () => {
      assert.equal(
        transform(
          `const first = new Promise((resolve, reject) => {
  let rejectedCount = 0;
  promises.forEach((promise) => promise.then(resolve, () => {
    rejectedCount += 1;
    if (rejectedCount === otherPromises.length) {
      reject(new AggregateError());
    }
  }));
});`,
          "newly-available",
        ).modified,
        false,
      )
    })

    test("skip alternate rejection branch", () => {
      assert.equal(
        transform(
          `const first = new Promise((resolve, reject) => {
  let rejectedCount = 0;
  promises.forEach((promise) => promise.then(resolve, () => {
    rejectedCount += 1;
    if (rejectedCount === promises.length) {
      reject(new AggregateError());
    } else {
      rejectLater();
    }
  }));
});`,
          "newly-available",
        ).modified,
        false,
      )
    })

    test("skip missing reject handler", () => {
      assert.equal(
        transform(
          `const first = new Promise((resolve, reject) => {
  let rejectedCount = 0;
  promises.forEach((promise) => promise.then(resolve));
});`,
          "newly-available",
        ).modified,
        false,
      )
    })
  })
})
