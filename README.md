<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./images/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="./images/logo-light.svg">
    <img alt="esupgrade: Auto-upgrade your JavaScript syntax" src="./images/logo-light.svg">
  </picture>
</p>

# esupgrade

Keeping your JavaScript and TypeScript code up to date with full browser compatibility.

## Usage

### CLI

```bash
npx esupgrade --help
```

### pre-commit

```bash
uvx pre-commit install
```

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/codingjoe/esupgrade
    rev: v0.1.0  # Use the latest version
    hooks:
      - id: esupgrade
```

```bash
pre-commit run esupgrade --all-files
```

## Browser Support & Baseline

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-widely-word-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://web-platform-dx.github.io/web-features/assets/img/baseline-widely-word.svg">
  <img alt="Baseline: widely available" src="https://web-platform-dx.github.io/web-features/assets/img/baseline-widely-word.svg" height="32" align="right">
</picture>

All transformations are based on [Web Platform Baseline](https://web.dev/baseline) features. Baseline tracks which web platform features are safe to use across browsers.

By default, `esupgrade` uses **widely available** features, meaning they work in all major browsers (Chrome, Edge, Safari, Firefox) for at least 30 months. This ensures full compatibility while keeping your code modern.

You can opt into **newly available** features (available in all browsers for 0-30 months) with:

```bash
npx esupgrade --baseline newly-available src/
```

For more information about Baseline browser support, visit [web.dev/baseline](https://web.dev/baseline).

## Transformations

All transformations are safe and behavior-preserving. Here's what `esupgrade` does:

### 1. `var` → `let`/`const`

```diff
-var x = 1;
-var y = 2;
-y = 3;
+const x = 1;
+let y = 2;
+y = 3;
```

### 2. String concatenation → Template literals

```diff
-const greeting = 'Hello ' + name + '!';
-const message = 'You have ' + count + ' items';
+const greeting = `Hello ${name}!`;
+const message = `You have ${count} items`;
```

### 3. `Array.from().forEach()` → `for...of` loops

```diff
-Array.from(items).forEach(item => {
-  console.log(item);
-});
+for (const item of items) {
+  console.log(item);
+}
```

### 4. `Object.assign({}, ...)` → Object spread

```diff
-const obj = Object.assign({}, obj1, obj2);
-const copy = Object.assign({}, original);
+const obj = { ...obj1, ...obj2 };
+const copy = { ...original };
```

### 5. `.concat()` → Array spread

```diff
-const combined = arr1.concat(arr2, arr3);
-const withItem = array.concat([item]);
+const combined = [...arr1, ...arr2, ...arr3];
+const withItem = [...array, item];
```

### 6. Function expressions → Arrow functions

```diff
-const fn = function(x) { return x * 2; };
-items.map(function(item) { return item.name; });
+const fn = x => { return x * 2; };
+items.map(item => { return item.name; });
```

**Note:** Functions using `this`, `arguments`, or `super` are not converted to preserve semantics.

### Complete Example

```diff
-var userName = 'John';
-var userAge = 30;
-var greeting = 'Hello, ' + userName + '!';
+const userName = 'John';
+const userAge = 30;
+const greeting = `Hello, ${userName}!`;

-Array.from(users).forEach(function(user) {
-  console.log('User: ' + user.name);
-});
+for (const user of users) {
+  console.log(`User: ${user.name}`);
+}

-var settings = Object.assign({}, defaultSettings, userSettings);
+const settings = { ...defaultSettings, ...userSettings };
```

## Supported File Types

- `.js` - JavaScript
- `.jsx` - React/JSX
- `.ts` - TypeScript
- `.tsx` - TypeScript with JSX
- `.mjs` - ES Modules
- `.cjs` - CommonJS
