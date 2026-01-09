<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./images/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="./images/logo-light.svg">
    <img alt="esupgrade: Auto-upgrade your JavaScript syntax" src="./images/logo-light.svg">
  </picture>
</p>

# esupgrade [![npm version](https://img.shields.io/npm/v/esupgrade.svg?style=flat-square)](https://www.npmjs.com/package/esupgrade) [![coverage status](https://img.shields.io/codecov/c/github/codingjoe/esupgrade/main.svg?style=flat-square)](https://codecov.io/gh/codingjoe/esupgrade) [![license](https://img.shields.io/npm/l/esupgrade.svg?style=flat-square)](https://github.com/codingjoe/esupgrade/blob/main/LICENSE)

Keeping your JavaScript and TypeScript code up to date with full browser compatibility.

## Usage

esupgrade is safe and meant to be used automatically on your codebase.
We recommend integrating it into your development workflow using [pre-commit].

### pre-commit

```bash
uvx pre-commit install
```

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/codingjoe/esupgrade
    rev: 2025.0.2 # Use the latest version
    hooks:
      - id: esupgrade
```

```bash
pre-commit run esupgrade --all-files
```

### CLI

```bash
npx esupgrade --help
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-wordmark-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-wordmark.svg">
  <img alt="Baseline: widely available" src="https://web-platform-dx.github.io/web-features/assets/img/baseline-wordmark.svg" height="32" align="right">
</picture>

## Browser Support & Baseline

All transformations are based on [Web Platform Baseline][baseline] features. Baseline tracks which web platform features are safe to use across browsers.

By default, `esupgrade` uses **widely available** features, meaning they work in all major browsers (Chrome, Edge, Safari, Firefox) for at least 30 months. This ensures full compatibility while keeping your code modern.

You can opt into **newly available** features (available in all browsers for 0-30 months) with:

```bash
npx esupgrade --baseline newly-available <files>
```

For more information about Baseline browser support, visit [web.dev/baseline][baseline].

## Supported File Types & Languages

- `.js` - JavaScript
- `.jsx` - React/JSX
- `.ts` - TypeScript
- `.tsx` - TypeScript with JSX
- `.mjs` - ES Modules
- `.cjs` - CommonJS

## Transformations

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-widely-word-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-widely-word.svg">
  <img alt="Baseline: widely available" src="https://web-platform-dx.github.io/web-features/assets/img/baseline-widely-word.svg" height="32" align="right">
</picture>

### Widely available

#### `var` → [const][mdn-const] & [let][mdn-let]

```diff
-var x = 1;
-var y = 2;
-y = 3;
+const x = 1;
+let y = 2;
+y = 3;
```

#### String concatenation → [Template literals][mdn-template-literals]

```diff
-const greeting = 'Hello ' + name + '!';
-const message = 'You have ' + count + ' items';
+const greeting = `Hello ${name}!`;
+const message = `You have ${count} items`;
```

Special handling for escape sequences and formatting:

- **Escape sequences**: `\r` (carriage return) is preserved, while `\n` (newline) is converted to actual newlines

  ```diff
  -const text = "Line 1\n" + "Line 2";
  +const text = `Line 1
  +Line 2`;
  ```

- **Multiline concatenation**: Visual structure is preserved with line continuation backslashes

  ```diff
  -const longText = "First part " +
  -                 "second part";
  +const longText = `First part \
  +second part`;
  ```

#### Traditional `for` loops → [`for...of` loops][mdn-for-of]

```diff
-for (let i = 0; i < items.length; i++) {
-  const item = items[i];
-  console.log(item);
-}
+for (const item of items) {
+  console.log(item);
+}
```

Transformations are limited to loops that start at 0, increment by 1, and where the index variable is not used in the loop body.

#### `Array.from().forEach()` → [`for...of` loops][mdn-for-of]

```diff
-Array.from(items).forEach(item => {
-  console.log(item);
-});
+for (const item of items) {
+  console.log(item);
+}
```

#### DOM `forEach()` → [`for...of` loops][mdn-for-of]

```diff
-document.querySelectorAll('.item').forEach(item => {
-  item.classList.add('active');
-});
+for (const item of document.querySelectorAll('.item')) {
+  item.classList.add('active');
+}
```

Supports:

- `document.querySelectorAll()`

- `document.getElementsByTagName()`

- `document.getElementsByClassName()`

- `document.getElementsByName()`

- `window.frames`

- Transformations limited to inline arrow or function expressions with block statement bodies.
  Callbacks with index parameters or expression bodies are not transformed.

#### `Array.from()` → [Array spread [...]][mdn-spread]

```diff
-const doubled = Array.from(numbers).map(n => n * 2);
-const filtered = Array.from(items).filter(x => x > 5);
-const arr = Array.from(iterable);
+const doubled = [...numbers].map(n => n * 2);
+const filtered = [...items].filter(x => x > 5);
+const arr = [...iterable];
```

`Array.from()` with a mapping function or thisArg is not converted.

#### `Object.assign({}, ...)` → [Object spread {...}][mdn-spread]

```diff
-const obj = Object.assign({}, obj1, obj2);
-const copy = Object.assign({}, original);
+const obj = { ...obj1, ...obj2 };
+const copy = { ...original };
```

> [!NOTE]
> TypeScript does not support generic object spread yet:
> https://github.com/Microsoft/TypeScript/issues/10727
> You might need to manually adjust the type after transformation:
>
> ```ts
> const object_with_generic_type: object = { ...(myGenericObject as object) }
> ```

#### `Array.concat()` → [Array spread [...]][mdn-spread]

```diff
-const combined = arr1.concat(arr2, arr3);
-const withItem = array.concat([item]);
+const combined = [...arr1, ...arr2, ...arr3];
+const withItem = [...array, item];
```

#### `Array.slice(0)` → [Array spread [...]][mdn-spread]

```diff
-const copy = [1, 2, 3].slice(0);
-const clone = Array.from(items).slice();
+const copy = [...[1, 2, 3]];
+const clone = [...Array.from(items)];
```

#### `Math.pow()` → [Exponentiation operator \*\*][mdn-exponentiation]

```diff
-const result = Math.pow(2, 3);
-const area = Math.PI * Math.pow(radius, 2);
+const result = 2 ** 3;
+const area = Math.PI * radius ** 2;
```

#### Named function assignments → [Function declarations][mdn-functions]

```diff
-const myFunc = () => { return 42; };
-const add = (a, b) => a + b;
-const greet = function(name) { return "Hello " + name; };
+function myFunc() { return 42; }
+function add(a, b) { return a + b; }
+function greet(name) { return "Hello " + name; }
```

Transforms arrow functions and anonymous function expressions assigned to variables into proper named function declarations. This provides better structure and semantics for top-level functions.

Functions using `this` or `arguments` are not converted to preserve semantics.

TypeScript parameter and return type annotations are preserved:

```diff
-let myAdd = function (x: number, y: number): number {
-  return x + y;
-};
+function myAdd(x: number, y: number): number {
+  return x + y;
+}
```

Generic type parameters are also preserved:

```diff
-export const useHook = <T extends object>(props: T): T => {
-  return props;
-};
+export function useHook<T extends object>(props: T): T {
+  return props;
+}
```

Variables with TypeScript type annotations but no function return type are skipped:

```typescript
// Not transformed - variable type annotation cannot be transferred
const Template: StoryFn<MyType> = () => { return <div>Hello</div>; };
```

#### Anonymous function expressions → [Arrow functions][mdn-arrow-functions]

```diff
-items.map(function(item) { return item.name; });
-button.addEventListener('click', function(event) { process(event); });
+items.map(item => { return item.name; });
+button.addEventListener('click', event => { process(event); });
```

Anonymous function expressions not in variable declarations (like callbacks and event handlers) are converted to arrow functions.

Functions using `this`, `arguments`, or `super` are not converted to preserve semantics.

#### Constructor functions → [Classes][mdn-classes]

```diff
-function Person(name, age) {
-  this.name = name;
-  this.age = age;
-}
-
-Person.prototype.greet = function() {
-  return 'Hello, I am ' + this.name;
-};
-
-Person.prototype.getAge = function() {
-  return this.age;
-};
+class Person {
+  constructor(name, age) {
+    this.name = name;
+    this.age = age;
+  }
+
+  greet() {
+    return 'Hello, I am ' + this.name;
+  }
+
+  getAge() {
+    return this.age;
+  }
+}
```

Transforms constructor functions (both function declarations and variable declarations) that meet these criteria:

- Function name starts with an uppercase letter
- At least one prototype method is defined
- Prototype methods using `this` in arrow functions are skipped
- Prototype object literals with getters, setters, or computed properties are skipped

#### `console.log()` → [console.info()][mdn-console]

```diff
-console.log('User logged in:', username);
-console.log({ userId, action: 'login' });
+console.info('User logged in:', username);
+console.info({ userId, action: 'login' });
```

While `console.log` and `console.info` are functionally identical in browsers.
This transformation provides semantic clarity by using an explicit log level, but review your logging infrastructure before applying.

#### Remove redundant `'use strict'` from [modules][mdn-strict-mode]

```diff
-'use strict';
 import { helper } from './utils';

 export function main() {
   return helper();
 }
```

ES6 modules are automatically in strict mode, making explicit `'use strict'` directives redundant. This transformation applies to files with `import` or `export` statements.

#### Global context → [globalThis][mdn-globalthis]

```diff
-const global = window;
-const loc = window.location.href;
+const global = globalThis;
+const loc = globalThis.location.href;
```

```diff
-const global = self;
-const nav = self.navigator;
+const global = globalThis;
+const nav = globalThis.navigator;
```

```diff
-const global = Function('return this')();
+const global = globalThis;
```

#### Null/undefined checks → [Nullish coalescing operator (??)][mdn-nullish-coalescing]

```diff
-const value = x !== null && x !== undefined ? x : defaultValue;
+const value = x ?? defaultValue;
```

```diff
-const result = obj.prop !== null && obj.prop !== undefined ? obj.prop : 0;
+const result = obj.prop ?? 0;
```

#### `indexOf()` → [includes()][mdn-includes]

```diff
-const found = [1, 2, 3].indexOf(item) !== -1;
-const exists = "hello".indexOf(substr) > -1;
-const hasValue = ["a", "b", "c"].indexOf(value) >= 0;
+const found = [1, 2, 3].includes(item);
+const exists = "hello".includes(substr);
+const hasValue = ["a", "b", "c"].includes(value);
```

```diff
-if ([1, 2, 3].indexOf(item) === -1) {
-  console.log('not found');
-}
+if (![1, 2, 3].includes(item)) {
+  console.log('not found');
+}
```

Transforms `indexOf()` calls with a single argument (search value) when it can statically verify that the receiver is an array or string (for example, array literals, string literals, or safe method chains).
Calls with a fromIndex parameter are not transformed as they have different semantics than `includes()`. As a result, patterns such as `[1, 2, 3].indexOf(item) !== -1` are upgraded, while `arr.indexOf(item) !== -1` may be left unchanged if the transformer cannot prove that `arr` is an array.

#### `String.substr()` → [String.slice()][mdn-slice]

```diff
-const result = "hello world".substr(0, 5);
-const end = "example".substr(3);
+const result = "hello world".slice(0, 0 + 5);
+const end = "example".slice(3);
```

Transforms the deprecated `substr()` method to `slice()`:

- `str.substr(start, length)` becomes `str.slice(start, start + length)`
- `str.substr(start)` becomes `str.slice(start)`
- `str.substr()` becomes `str.slice()`

Transformations are limited to when the receiver can be verified as a string (string literals, template literals, or string method chains).

#### `Object.keys().forEach()` → [Object.entries()][mdn-object-entries]

```diff
-Object.keys(obj).forEach(key => {
-  const value = obj[key];
-  console.log(key, value);
-});
+Object.entries(obj).forEach(([key, value]) => {
+  console.log(key, value);
+});
```

Transforms Object.keys() iteration patterns where the value is accessed from the same object into Object.entries() with array destructuring. This eliminates duplicate property lookups and makes the code more concise.

Transforms when:

- The callback has one parameter (the key)
- The first statement in the callback assigns `obj[key]` to a variable
- The object being accessed matches the object passed to Object.keys()

#### `indexOf()` prefix check → [String.startsWith()][mdn-startswith]

```diff
-const isPrefix = "hello world".indexOf("hello") === 0;
-const notPrefix = str.indexOf(prefix) !== 0;
+const isPrefix = "hello world".startsWith("hello");
+const notPrefix = !str.startsWith(prefix);
```

Transforms `indexOf()` prefix checks to the more explicit `startsWith()` method. Transforms when the receiver can be verified as a string and `indexOf()` is compared to `0`.

#### `substring()` prefix check → [String.startsWith()][mdn-startswith]

```diff
-const matches = "hello world".substring(0, prefix.length) === prefix;
-const noMatch = str.substring(0, prefix.length) !== prefix;
+const matches = "hello world".startsWith(prefix);
+const noMatch = !str.startsWith(prefix);
```

Transforms `substring()` prefix comparisons to `startsWith()`. Transforms patterns where `substring(0, prefix.length)` is compared to `prefix`.

#### `lastIndexOf()` suffix check → [String.endsWith()][mdn-endswith]

```diff
-const isSuffix = str.lastIndexOf(suffix) === str.length - suffix.length;
-const notSuffix = "hello world".lastIndexOf("world") !== "hello world".length - "world".length;
+const isSuffix = str.endsWith(suffix);
+const notSuffix = !"hello world".endsWith("world");
```

Transforms `lastIndexOf()` suffix checks to the more explicit `endsWith()` method. Transforms when the receiver can be verified as a string and the pattern matches `lastIndexOf(suffix) === str.length - suffix.length`.

#### `arguments` object → [Rest parameters ...][mdn-rest-parameters]

```diff
-function fn() {
-  const args = Array.from(arguments);
-  // use args
-}
+function fn(...args) {
+  // use args
+}
```

```diff
-function fn() {
-  const args = [].slice.call(arguments);
-  // use args
-}
+function fn(...args) {
+  // use args
+}
```

Transforms the `arguments` object to rest parameters when:

- Function is a regular function (not arrow function)
- Function doesn't already have rest parameters
- `arguments` is used in the conversion pattern (`Array.from(arguments)` or `[].slice.call(arguments)`)
- `arguments` is not used elsewhere in the function

The transformer handles cases where `Array.from(arguments)` has already been converted to `[...arguments]` by other transformers.

#### Promise chains → [async/await][mdn-async-await]

```diff
-return fetch('/api/data')
-  .then(result => {
-    // handle result
-  })
-  .catch(err => {
-    // handle error
-  });
+try {
+  const result = await fetch('/api/data');
+  // handle result
+} catch (err) {
+  // handle error
+}
```

Transforms Promise `.then()/.catch()` chains to async/await syntax when:

- The pattern is `.then(callback).catch(errorHandler)`
- Both callbacks have exactly one parameter
- Both callbacks have block statement bodies (not expression bodies)
- **The promise chain is returned from the function**
- **The expression is a known promise** (`fetch()`, `new Promise()`, or a promise method)
- The code is inside a function that can be marked `async`

The enclosing function is automatically marked `async`. This transformation is only applied when the function already returns a promise, ensuring no breaking changes to function signatures.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-word-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-word.svg">
  <img alt="Baseline: Newly available" src="https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-word.svg" height="32" align="right">
</picture>

### Newly available

These transformations are mainly to harden code for future releases and should be used with caution.

#### `new Promise((resolve) => { ... })` → [Promise.try][mdn-promise-try]

```diff
-new Promise((resolve) => {
-  const result = doSomething();
-  resolve(result);
-});
+Promise.try(() => {
+  return doSomething();
+});
```

## Versioning

esupgrade uses the [calver] `YYYY.MINOR.PATCH` versioning scheme.

The year indicates the baseline version. New transformations are added in minor releases, while patches are reserved for bug fixes.

## Related Projects

Thanks to these projects for inspiring esupgrade:

- @asottile's [pyupgrade] for Python
- @adamchainz' [django-upgrade] for Django

### Distinction

lebab is a similar project that focuses on ECMAScript 6+ transformations without considering browser support.
esupgrade is distinct in that it applies transformations that are safe based on Baseline browser support.
Furthermore, esupgrade supports JavaScript, TypeScript, and more, while lebab is limited to JavaScript.

[baseline]: https://web.dev/baseline/
[calver]: https://calver.org/
[django-upgrade]: https://github.com/adamchainz/django-upgrade
[mdn-arrow-functions]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
[mdn-async-await]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
[mdn-classes]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes
[mdn-console]: https://developer.mozilla.org/en-US/docs/Web/API/console
[mdn-const]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
[mdn-endswith]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
[mdn-exponentiation]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Exponentiation
[mdn-for-of]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
[mdn-functions]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions
[mdn-globalthis]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
[mdn-includes]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes
[mdn-let]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let
[mdn-nullish-coalescing]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing
[mdn-object-entries]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
[mdn-promise-try]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/try
[mdn-rest-parameters]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters
[mdn-slice]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/slice
[mdn-spread]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
[mdn-startswith]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
[mdn-strict-mode]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode#strict_mode_for_modules
[mdn-template-literals]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
[pre-commit]: https://pre-commit.com/
[pyupgrade]: https://github.com/asottile/pyupgrade
