# esupgrade

Auto-upgrade your JavaScript syntax to modern ECMAScript standards.

`esupgrade` is a tool that automatically modernizes your JavaScript code by transforming outdated patterns into their modern equivalents. All transformations are based on [Baseline](https://web.dev/baseline) widely-available features, ensuring your code works across all modern browsers.

## Features

`esupgrade` performs the following safe transformations:

### 1. `Array.from().forEach()` → `for...of` loops
```javascript
// Before
Array.from(items).forEach(item => {
  console.log(item);
});

// After
for (const item of items) {
  console.log(item);
}
```

### 2. `var` → `let`/`const`
```javascript
// Before
var x = 1;

// After
const x = 1;  // or 'let' if reassigned
```

### 3. String concatenation → Template literals
```javascript
// Before
const greeting = 'Hello ' + name + '!';

// After
const greeting = `Hello ${name}!`;
```

### 4. `Object.assign({}, ...)` → Object spread
```javascript
// Before
const obj = Object.assign({}, obj1, obj2);

// After
const obj = { ...obj1, ...obj2 };
```

### 5. `.concat()` → Array spread
```javascript
// Before
const combined = arr1.concat(arr2, arr3);

// After
const combined = [...arr1, ...arr2, ...arr3];
```

### 6. Function expressions → Arrow functions
```javascript
// Before
const fn = function(x) { return x * 2; };

// After
const fn = x => { return x * 2; };
```

**Note:** Functions using `this`, `arguments`, or `super` are not converted to arrow functions.

## Installation

```bash
npm install --save-dev esupgrade
```

Or use it directly with `npx`:

```bash
npx esupgrade <files>
```

## Usage

### Basic Usage

Upgrade a single file:
```bash
npx esupgrade src/app.js
```

Upgrade multiple files:
```bash
npx esupgrade src/**/*.js
```

Upgrade a directory:
```bash
npx esupgrade src/
```

### Options

#### `--baseline <level>`
Set the baseline level for transformations. Options:
- `widely-available` (default): Use features available in all modern browsers
- `newly-available`: Include newer ECMAScript features

```bash
npx esupgrade --baseline newly-available src/
```

#### `--check`
Check if files need upgrading without modifying them. Exits with code 1 if changes are needed.

```bash
npx esupgrade --check src/app.js
```

This is useful for CI/CD pipelines to ensure code is already modernized.

#### `--write`
Write changes to files (default behavior).

```bash
npx esupgrade --write src/app.js
```

### Pre-commit Hook

To run `esupgrade` automatically before every commit, add it as a pre-commit hook:

#### Using pre-commit

1. Install [pre-commit](https://pre-commit.com/):
```bash
pip install pre-commit
```

2. Create a `.pre-commit-config.yaml` file in your project:
```yaml
repos:
  - repo: local
    hooks:
      - id: esupgrade
        name: esupgrade
        entry: npx esupgrade --check
        language: system
        types: [javascript, jsx, ts, tsx]
        pass_filenames: true
```

3. Install the hooks:
```bash
pre-commit install
```

#### Using Husky

1. Install Husky:
```bash
npm install --save-dev husky
npx husky init
```

2. Add esupgrade to your pre-commit hook:
```bash
echo "npx esupgrade --check \$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|jsx|ts|tsx)$')" > .husky/pre-commit
```

## Safety

All transformations performed by `esupgrade` are designed to be safe and behavior-preserving:

- **No semantics changes**: The code behavior remains identical after transformation
- **Conservative approach**: Only transforms patterns that are unambiguous
- **Preserves `this` binding**: Function expressions using `this` are not converted to arrow functions
- **Type-aware**: Understands JavaScript/TypeScript syntax

## Examples

### Example 1: Complete file transformation

**Before:**
```javascript
var userName = 'John';
var userAge = 30;
var greeting = 'Hello, ' + userName + '!';

Array.from(users).forEach(function(user) {
  console.log('User: ' + user.name);
});

var settings = Object.assign({}, defaultSettings, userSettings);
```

**After:**
```javascript
const userName = 'John';
const userAge = 30;
const greeting = `Hello, ${userName}!`;

for (const user of users) {
  console.log(`User: ${user.name}`);
}

const settings = { ...defaultSettings, ...userSettings };
```

## Supported File Types

- `.js` - JavaScript
- `.jsx` - React/JSX
- `.ts` - TypeScript
- `.tsx` - TypeScript with JSX
- `.mjs` - ES Modules
- `.cjs` - CommonJS

## Requirements

- Node.js >= 18.0.0

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

BSD-2-Clause License - see [LICENSE](LICENSE) file for details.

## Author

Johannes Maron

## Related Projects

- [jscodeshift](https://github.com/facebook/jscodeshift) - A toolkit for running codemods
- [lebab](https://github.com/lebab/lebab) - Modernize JavaScript using codemods
- [@babel/preset-env](https://babeljs.io/docs/en/babel-preset-env) - Babel preset for compiling modern JavaScript

