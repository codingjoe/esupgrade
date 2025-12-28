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
    rev: 2025.0.2  # Use the latest version
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

#### `Array.from().forEach()` → [`for...of` loops][mdn-for-of]

```diff
-Array.from(items).forEach(item => {
-  console.log(item);
-});
+for (const item of items) {
+  console.log(item);
+}
```

#### `Array.from()` → [Array spread [...]][mdn-spread]

```diff
-const doubled = Array.from(numbers).map(n => n * 2);
-const filtered = Array.from(items).filter(x => x > 5);
-const arr = Array.from(iterable);
+const doubled = [...numbers].map(n => n * 2);
+const filtered = [...items].filter(x => x > 5);
+const arr = [...iterable];
```

> [!NOTE]
> `Array.from()` with a mapping function or thisArg is not converted.

#### `Object.assign({}, ...)` → [Object spread {...}][mdn-spread]

```diff
-const obj = Object.assign({}, obj1, obj2);
-const copy = Object.assign({}, original);
+const obj = { ...obj1, ...obj2 };
+const copy = { ...original };
```

#### `.concat()` → [Array spread [...]][mdn-spread]

```diff
-const combined = arr1.concat(arr2, arr3);
-const withItem = array.concat([item]);
+const combined = [...arr1, ...arr2, ...arr3];
+const withItem = [...array, item];
```

#### Function expressions → [Arrow functions][mdn-arrow-functions]

```diff
-const fn = function(x) { return x * 2; };
-items.map(function(item) { return item.name; });
+const fn = x => { return x * 2; };
+items.map(item => { return item.name; });
```

> [!NOTE]
> Functions using `this`, `arguments`, or `super` are not converted to preserve semantics.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-word-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-word.svg">
  <img alt="Baseline: Newly available" src="https://web-platform-dx.github.io/web-features/assets/img/baseline-newly-word.svg" height="32" align="right">
</picture>

### Newly available

> [!CAUTION]
> These transformations are mainly to harden code for future releases and should be used with caution.

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

[baseline]: https://web.dev/baseline/
[mdn-arrow-functions]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
[mdn-const]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const
[mdn-for-of]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
[mdn-let]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let
[mdn-promise-try]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/try
[mdn-spread]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
[mdn-template-literals]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
[pre-commit]: https://pre-commit.com/
