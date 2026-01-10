import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("promiseToAsyncAwait", () => {
    test("promise.then().catch() pattern with return", () => {
      const result = transform(`
function doWork() {
  return fetch('/api/data')
    .then(result => {
      processResult(result);
    })
    .catch(err => {
      handleError(err);
    });
}
`)

      assert(result.modified, "transform promise.then().catch()")
      assert.match(result.code, /async function doWork/)
      assert.match(result.code, /try \{/)
      assert.match(result.code, /const result = await fetch/)
      assert.match(result.code, /processResult\(result\)/)
      assert.match(result.code, /catch \(err\)/)
      assert.match(result.code, /handleError\(err\)/)
    })

    test("promise chain in arrow function with return", () => {
      const result = transform(`
const handler = () => {
  return fetch('/data')
    .then(data => {
      processData(data);
    })
    .catch(error => {
      handleError(error);
    });
};
`)

      assert(result.modified, "transform promise chain in arrow function")
      assert.match(result.code, /async function handler/)
      assert.match(result.code, /const data = await fetch/)
    })

    test("promise chain with new Promise", () => {
      const result = transform(`
const fn = function() {
  return new Promise((resolve, reject) => {
    doSomething();
  })
    .then(user => {
      saveUser(user);
    })
    .catch(err => {
      logError(err);
    });
};
`)

      assert(result.modified, "transform promise chain with new Promise")
      assert.match(result.code, /async function fn/)
      assert.match(result.code, /const user = await new Promise/)
    })

    test("skip promise chain without return", () => {
      const result = transform(`
function doWork() {
  fetch('/api/data')
    .then(result => {
      processResult(result);
    })
    .catch(err => {
      handleError(err);
    });
}
`)

      assert(!result.modified, "skip promise chain without return")
    })

    test("transform promise chain inside already async function", () => {
      const result = transform(`
async function bar() {
  fetch('http://localhost')
    .then(result => {
      processResult(result);
    })
    .catch(err => {
      handleError(err);
    });
}
`)

      assert(result.modified, "transform promise chain inside async function")
      assert.match(result.code, /async function bar/)
      assert.match(result.code, /try \{/)
      assert.match(result.code, /const result = await fetch/)
      assert.match(result.code, /processResult\(result\)/)
      assert.match(result.code, /catch \(err\)/)
      assert.match(result.code, /handleError\(err\)/)
    })

    test("make function async when it returns fetch", () => {
      const result = transform(`
function getData() {
  return fetch('/api/data');
}
`)

      assert(result.modified, "make function async when returning fetch")
      assert.match(result.code, /async function getData/)
      assert.match(result.code, /return await fetch/)
    })

    test("make function async when it returns new Promise", () => {
      const result = transform(`
function loadUser() {
  return new Promise((resolve, reject) => {
    loadFromDB(resolve, reject);
  });
}
`)

      assert(result.modified, "make function async when returning new Promise")
      assert.match(result.code, /async function loadUser/)
      assert.match(result.code, /return await new Promise/)
    })

    test("make function async when it returns promise chain", () => {
      const result = transform(`
function getJson() {
  return fetch('/api').then(res => res.json());
}
`)

      assert(result.modified, "make function async when returning promise chain")
      assert.match(result.code, /async function getJson/)
      assert.match(result.code, /return await fetch/)
    })

    test("make function async when it returns Promise.all", () => {
      const result = transform(`
function getAll() {
  return Promise.all([fetch('/a'), fetch('/b')]);
}
`)

      assert(result.modified, "make function async when returning Promise.all")
      assert.match(result.code, /async function getAll/)
      assert.match(result.code, /return await Promise\.all/)
    })

    test("skip function that doesn't return promise", () => {
      const result = transform(`
function getData() {
  return { data: 'value' };
}
`)

      assert(!result.modified, "skip function that doesn't return promise")
    })

    test("skip already async function without changes", () => {
      const result = transform(`
async function getData() {
  return fetch('/api');
}
`)

      assert(!result.modified, "skip already async function")
    })

    test("make function expression async when it returns promise", () => {
      const result = transform(`
const fn = function() {
  return fetch('/data');
};
`)

      assert(result.modified, "make function expression async")
      assert.match(result.code, /async function fn/)
      assert.match(result.code, /return await fetch/)
    })

    test("make arrow function async when it returns promise", () => {
      const result = transform(`
const fn = () => {
  return new Promise(resolve => resolve());
};
`)

      assert(result.modified, "make arrow function async")
      assert.match(result.code, /async function fn/)
      assert.match(result.code, /return await new Promise/)
    })

    test("make arrow function with expression body async", () => {
      const result = transform(`
const fn = () => fetch('/api');
`)

      assert(result.modified, "convert arrow with expression body that returns promise")
      assert.match(result.code, /async function fn/)
    })

    test("handle nested functions - only transform inner function", () => {
      const result = transform(`
function outer() {
  function inner() {
    return fetch('/api');
  }
  return inner();
}
`)

      assert(result.modified, "transform nested function")
      assert.match(result.code, /async function inner/)
      assert.match(result.code, /return await fetch/)
      assert.doesNotMatch(result.code, /async function outer/)
    })

    test("skip then without catch", () => {
      const result = transform(`
function test() {
  promise.then(result => {
    processResult(result);
  });
}
`)

      assert(!result.modified, "skip then without catch")
    })

    test("skip catch without then", () => {
      const result = transform(`
function test() {
  promise.catch(err => {
    handleErrorWithLog(err);
  });
}
`)

      assert(!result.modified, "skip catch without then")
    })

    test("skip then with no parameters", () => {
      const result = transform(`
function test() {
  promise
    .then(() => {
      doSomething();
    })
    .catch(err => {
      handleErrorWithLog(err);
    });
}
`)

      assert(!result.modified, "skip then with no parameters")
    })

    test("skip catch with no parameters", () => {
      const result = transform(`
function test() {
  promise
    .then(result => {
      processResult(result);
    })
    .catch(() => {
      handleError();
    });
}
`)

      assert(!result.modified, "skip catch with no parameters")
    })

    test("skip then with expression body", () => {
      const result = transform(`
function test() {
  promise
    .then(result => result.value)
    .catch(err => {
      handleErrorWithLog(err);
    });
}
`)

      assert(!result.modified, "skip then with expression body")
    })

    test("skip catch with expression body", () => {
      const result = transform(`
function test() {
  promise
    .then(result => {
      processResult(result);
    })
    .catch(err => null);
}
`)

      assert(!result.modified, "skip catch with expression body")
    })

    test("skip then with multiple parameters", () => {
      const result = transform(`
function test() {
  promise
    .then((result, index) => {
      processResult(result, index);
    })
    .catch(err => {
      handleErrorWithLog(err);
    });
}
`)

      assert(!result.modified, "skip then with multiple parameters")
    })

    test("skip promise chain not in expression statement", () => {
      const result = transform(`
function test() {
  const p = promise
    .then(result => {
      processResult(result);
    })
    .catch(err => {
      handleErrorWithLog(err);
    });
}
`)

      assert(!result.modified, "skip promise chain not in expression statement")
    })

    test("transform .then().catch() with function expression", () => {
      const result = transform(`
const fn = function() {
  return fetch('/api')
    .then(data => {
      console.log(data);
    })
    .catch(err => {
      console.error(err);
    });
};
`)

      assert(result.modified, "transform .then().catch() in function expression")
      assert.match(result.code, /async function fn/)
      assert.match(result.code, /try \{/)
      assert.match(result.code, /const data = await fetch/)
    })

    test("transform .then().catch() with arrow function", () => {
      const result = transform(`
const fn = () => {
  return fetch('/api')
    .then(data => {
      console.log(data);
    })
    .catch(err => {
      console.error(err);
    });
};
`)

      assert(result.modified, "transform .then().catch() in arrow function")
      assert.match(result.code, /async function fn/)
      assert.match(result.code, /try \{/)
      assert.match(result.code, /const data = await fetch/)
    })

    test("skip .then().catch() with argument that is not a callback", () => {
      const result = transform(`
function test() {
  return promise
    .then(result => {
      processResult(result);
    })
    .catch(errorHandler);
}
`)

      assert(!result.modified, "skip when catch arg is not a function")
    })

    test("make function expression async with conditional return", () => {
      const result = transform(`
const fn = function() {
  if (condition) {
    return fetch('/api');
  }
  return null;
};
`)

      assert(result.modified, "make function expression async with conditional")
      assert.match(result.code, /async function fn/)
      assert.match(result.code, /return await fetch/)
    })

    test("make arrow function async with conditional return", () => {
      const result = transform(`
const fn = () => {
  if (condition) {
    return new Promise(r => r());
  }
  return null;
};
`)

      assert(result.modified, "make arrow function async with conditional")
      assert.match(result.code, /async function fn/)
      assert.match(result.code, /return await new Promise/)
    })

    test("skip function expression with nested function returning promise", () => {
      const result = transform(`
const outer = function() {
  function inner() {
    return fetch('/api');
  }
  return inner;
};
`)

      assert(result.modified, "only inner function becomes async")
      assert.match(result.code, /async function inner/)
      assert.match(result.code, /return await fetch/)
      assert.doesNotMatch(result.code, /async function outer/)
    })

    test("skip arrow function with nested function returning promise", () => {
      const result = transform(`
const outer = () => {
  function inner() {
    return new Promise(r => r());
  }
  return inner;
};
`)

      assert(result.modified, "only inner function becomes async")
      assert.match(result.code, /async function inner/)
      assert.match(result.code, /return await new Promise/)
      assert.doesNotMatch(result.code, /async function outer/)
    })

    test("make anonymous function expression async", () => {
      const result = transform(`
obj.handler = function() {
  console.log(arguments);
  return fetch('/data');
};
`)

      assert(result.modified, "make anonymous function expression async")
      assert.match(result.code, /async function/)
      assert.match(result.code, /return await fetch/)
    })

    test("make anonymous arrow function async", () => {
      const result = transform(`
callbacks.push(() => {
  return new Promise(r => r());
});
`)

      assert(result.modified, "make anonymous arrow function async")
      assert.match(result.code, /async/)
      assert.match(result.code, /return await new Promise/)
    })

    test("anonymous function expression with nested return", () => {
      const result = transform(`
obj.fn = function() {
  console.log(arguments);
  if (condition) {
    return Promise.all([a, b]);
  }
  return null;
};
`)

      assert(
        result.modified,
        "make anonymous function expression async with conditional",
      )
      assert.match(result.code, /async function/)
      assert.match(result.code, /return await Promise\.all/)
    })

    test("anonymous arrow with nested return", () => {
      const result = transform(`
callbacks.push(() => {
  if (x) {
    return fetch('/a');
  }
  return null;
});
`)

      assert(result.modified, "make anonymous arrow async with conditional")
      assert.match(result.code, /async/)
      assert.match(result.code, /return await fetch/)
    })

    test("transform .then().catch() in anonymous arrow already async", () => {
      const result = transform(`
callbacks.push(async () => {
  fetch('/api')
    .then(data => {
      console.log(data);
    })
    .catch(err => {
      console.error(err);
    });
});
`)

      assert(result.modified, "transform .then().catch() in async arrow")
      assert.match(result.code, /try \{/)
      assert.match(result.code, /const data = await fetch/)
    })

    test("skip .then() with multiple arguments", () => {
      const result = transform(`
function test() {
  return promise.then(onSuccess, onError).catch(err => { doSomething(err); });
}
`)

      assert(!result.modified, "skip .then() with two arguments")
      assert.doesNotMatch(result.code, /try \{/)
      assert.doesNotMatch(result.code, /await/)
    })

    test("skip .catch() with multiple arguments", () => {
      const result = transform(`
function test() {
  return promise.then(data => { doSomething(data); }).catch(onError, onFinally);
}
`)

      assert(!result.modified, "skip .catch() with multiple arguments")
    })

    test("skip promise chain at top level", () => {
      const result = transform(`
fetch('url')
  .then(result => {
    processResult(result);
  })
  .catch(err => {
    handleErrorWithLog(err);
  });
`)

      assert(!result.modified, "skip promise chain at top level")
    })

    test("unwrap Promise.resolve to simple return", () => {
      const result = transform(`
function foo() {
  return Promise.resolve('foo bar');
}
`)

      assert(result.modified, "unwrap Promise.resolve")
      assert.match(result.code, /async function foo/)
      assert.match(result.code, /return ['"]foo bar['"]/)
      assert.doesNotMatch(result.code, /await/)
      assert.doesNotMatch(result.code, /Promise\.resolve/)
    })

    test("unwrap Promise.reject to throw", () => {
      const result = transform(`
function bar() {
  return Promise.reject(new Error('fail'));
}
`)

      assert(result.modified, "unwrap Promise.reject")
      assert.match(result.code, /async function bar/)
      assert.match(result.code, /throw new Error/)
      assert.doesNotMatch(result.code, /return/)
      assert.doesNotMatch(result.code, /Promise\.reject/)
    })

    test("unwrap Promise.reject in function expression", () => {
      const result = transform(`
const fn = function() {
  return Promise.reject(new Error('error'));
};
`)

      assert(result.modified, "unwrap Promise.reject in function expression")
      assert.match(result.code, /async function fn/)
      assert.match(result.code, /throw new Error/)
      assert.doesNotMatch(result.code, /return/)
    })

    test("unwrap Promise.reject in arrow function", () => {
      const result = transform(`
const fn = () => {
  return Promise.reject('error');
};
`)

      assert(result.modified, "unwrap Promise.reject in arrow")
      assert.match(result.code, /async function fn/)
      assert.match(result.code, /throw ['"]error['"]/)
      assert.doesNotMatch(result.code, /return/)
    })

    test("unwrap Promise.resolve in arrow function", () => {
      const result = transform(`
const fn = () => {
  return Promise.resolve(42);
};
`)

      assert(result.modified, "unwrap Promise.resolve in arrow")
      assert.match(result.code, /async function fn/)
      assert.match(result.code, /return 42/)
      assert.doesNotMatch(result.code, /await/)
    })

    test("unwrap Promise.resolve with conditional", () => {
      const result = transform(`
function test() {
  if (condition) {
    return Promise.resolve('success');
  }
  return fetch('/api');
}
`)

      assert(result.modified, "unwrap Promise.resolve with conditional")
      assert.match(result.code, /async function test/)
      assert.match(result.code, /return ['"]success['"]/)
      assert.match(result.code, /return await fetch/)
    })

    test("unwrap Promise.resolve() with no arguments", () => {
      const result = transform(`
function foo() {
  return Promise.resolve();
}
`)

      assert(result.modified, "unwrap Promise.resolve() with no args")
      assert.match(result.code, /async function foo/)
      assert.match(result.code, /return undefined/)
      assert.doesNotMatch(result.code, /await/)
    })

    test("unwrap Promise.reject() with no arguments", () => {
      const result = transform(`
function bar() {
  return Promise.reject();
}
`)

      assert(result.modified, "unwrap Promise.reject() with no args")
      assert.match(result.code, /async function bar/)
      assert.match(result.code, /throw undefined/)
      assert.doesNotMatch(result.code, /return/)
    })

    test("still await Promise.all", () => {
      const result = transform(`
function all() {
  return Promise.all([a, b]);
}
`)

      assert(result.modified, "still await Promise.all")
      assert.match(result.code, /async function all/)
      assert.match(result.code, /return await Promise\.all/)
    })

    test("transform promise chain in already async function without return", () => {
      const result = transform(`
async function handler() {
  fetch('/api')
    .then(result => {
      processResult(result);
    })
    .catch(err => {
      handleError(err);
    });
}
`)

      assert(result.modified, "transform expression statement promise chain")
      assert.match(result.code, /async function handler/)
      assert.match(result.code, /try \{/)
      assert.match(result.code, /const result = await fetch/)
    })
  })
})
