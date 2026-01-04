# GitHub Issues to Create for New Transformer Suggestions

This document contains the content for GitHub issues to be created for each potential transformer identified in BASELINE_TRANSFORMERS.md.

---

## Widely Available Transformers (17 issues)

### Issue 1: Add Optional Chaining (?.) Transformer

**Title:** Add optional chaining (?.) transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert conditional property access patterns to optional chaining syntax.

### Baseline Status
- **Status:** Widely Available (2020)
- **Feature:** Optional chaining operator (`?.`)

### Transformations

1. Nested property access:
```js
// Before
obj && obj.prop && obj.prop.nested

// After
obj?.prop?.nested
```

2. Array element access:
```js
// Before
arr && arr[0]

// After
arr?.[0]
```

3. Function calls:
```js
// Before
fn && fn()

// After
fn?.()
```

### Priority
High - This is a widely used pattern and the feature has been available in all browsers since 2020.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining
- Baseline: https://web.dev/baseline/
- Catalog: See BASELINE_TRANSFORMERS.md #14
```

---

### Issue 2: Add Nullish Coalescing (??) Transformer

**Title:** Add nullish coalescing (??) transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert null/undefined checks to nullish coalescing operator.

### Baseline Status
- **Status:** Widely Available (2020)
- **Feature:** Nullish coalescing operator (`??`)

### Transformations

```js
// Before
value !== null && value !== undefined ? value : default

// After
value ?? default
```

### Important Notes
- Different semantics from `||` operator
- `??` only treats `null` and `undefined` as nullish
- Does NOT treat `0`, `''`, or `false` as nullish (unlike `||`)

### Priority
High - Widely used pattern and safer than `||` for default values.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing
- Baseline: https://web.dev/baseline/
- Catalog: See BASELINE_TRANSFORMERS.md #15
```

---

### Issue 3: Add indexOf() → includes() Transformer

**Title:** Add indexOf() → includes() transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert indexOf() existence checks to includes() method.

### Baseline Status
- **Status:** Widely Available
  - Array.prototype.includes: 2016
  - String.prototype.includes: 2015

### Transformations

```js
// Before
arr.indexOf(item) !== -1
arr.indexOf(item) > -1
arr.indexOf(item) >= 0

// After
arr.includes(item)
```

```js
// Before
str.indexOf(substr) !== -1
str.indexOf(substr) > -1
str.indexOf(substr) >= 0

// After
str.includes(substr)
```

### Priority
High - Very common pattern with clear intent improvement.

### References
- MDN (Array): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes
- MDN (String): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes
- Catalog: See BASELINE_TRANSFORMERS.md #16
```

---

### Issue 4: Add Object.keys().forEach() → Object.entries() Transformer

**Title:** Add Object.keys().forEach() → Object.entries() transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert Object.keys() iteration with property access to Object.entries().

### Baseline Status
- **Status:** Widely Available (2017)
- **Feature:** Object.entries()

### Transformations

```js
// Before
Object.keys(obj).forEach(key => {
  const value = obj[key];
  // use key and value
});

// After
Object.entries(obj).forEach(([key, value]) => {
  // use key and value
});
```

### Priority
High - Cleaner iteration pattern, avoids duplicate property lookups.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
- Catalog: See BASELINE_TRANSFORMERS.md #17
```

---

### Issue 5: Add for...in with hasOwnProperty → Object.keys/entries Transformer

**Title:** Add for...in with hasOwnProperty → Object.keys/entries transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert for...in loops with hasOwnProperty checks to Object.keys() or Object.entries().

### Baseline Status
- **Status:** Widely Available (2017)
- **Feature:** Object.keys(), Object.entries()

### Transformations

```js
// Before
for (const key in obj) {
  if (obj.hasOwnProperty(key)) {
    // use key
  }
}

// After
for (const key of Object.keys(obj)) {
  // use key
}
```

### Priority
Medium - Improves safety and clarity, but less common than other patterns.

### References
- MDN (Object.keys): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
- Catalog: See BASELINE_TRANSFORMERS.md #18
```

---

### Issue 6: Add Array.slice(0) → Array Spread Transformer

**Title:** Add Array.slice(0) → spread syntax transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert array copying with slice() to spread syntax.

### Baseline Status
- **Status:** Widely Available (2015)
- **Feature:** Spread syntax for arrays

### Transformations

```js
// Before
arr.slice(0)
arr.slice()

// After
[...arr]
```

### Priority
Medium - Clearer intent for array copying.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
- Catalog: See BASELINE_TRANSFORMERS.md #19
```

---

### Issue 7: Add String.substr → substring/slice Transformer

**Title:** Add String.substr → substring/slice transformer

**Labels:** enhancement, transformer, widely-available, deprecation

**Body:**
```markdown
## Feature Request

Add a transformer to replace deprecated String.substr() with substring() or slice().

### Baseline Status
- **Status:** Deprecated
- **Feature:** String.prototype.substring / String.prototype.slice

### Transformations

```js
// Before
str.substr(start, length)

// After
str.substring(start, start + length)
// or
str.slice(start, start + length)
```

### Priority
Medium - Removes usage of deprecated method.

### References
- MDN (deprecated): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/substr
- MDN (substring): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/substring
- Catalog: See BASELINE_TRANSFORMERS.md #20
```

---

### Issue 8: Add arguments Object → Rest Parameters Transformer

**Title:** Add arguments object → rest parameters transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert arguments object usage to rest parameters.

### Baseline Status
- **Status:** Widely Available (2015)
- **Feature:** Rest parameters

### Transformations

```js
// Before
function fn() {
  const args = Array.from(arguments);
  // use args
}

// Before
function fn() {
  const args = [].slice.call(arguments);
  // use args
}

// After
function fn(...args) {
  // use args
}
```

### Priority
High - Modern replacement for arguments object, better performance.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters
- Catalog: See BASELINE_TRANSFORMERS.md #21
```

---

### Issue 9: Add Default Parameter Values Transformer

**Title:** Add default parameter values transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert manual default value assignment to default parameters.

### Baseline Status
- **Status:** Widely Available (2015)
- **Feature:** Default function parameters

### Transformations

```js
// Before
function fn(x) {
  x = x || defaultValue;
  // use x
}

// Before
function fn(x) {
  if (x === undefined) x = defaultValue;
  // use x
}

// After
function fn(x = defaultValue) {
  // use x
}
```

### Priority
High - Very common pattern, clearer intent.

### Note
Be careful with falsy values when replacing `||` patterns.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters
- Catalog: See BASELINE_TRANSFORMERS.md #22
```

---

### Issue 10: Add Destructuring in Function Parameters Transformer

**Title:** Add destructuring in function parameters transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert manual property extraction to parameter destructuring.

### Baseline Status
- **Status:** Widely Available (2015)
- **Feature:** Destructuring assignment

### Transformations

```js
// Before
function fn(obj) {
  const x = obj.x;
  const y = obj.y;
  // use x and y
}

// After
function fn({x, y}) {
  // use x and y
}
```

### Priority
Medium - Improves readability but may not always be appropriate.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
- Catalog: See BASELINE_TRANSFORMERS.md #23
```

---

### Issue 11: Add Array.filter()[0] → Array.find() Transformer

**Title:** Add Array.filter()[0] → Array.find() transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert filter()[0] pattern to find() method.

### Baseline Status
- **Status:** Widely Available (2015)
- **Feature:** Array.prototype.find()

### Transformations

```js
// Before
arr.filter(predicate)[0]

// After
arr.find(predicate)
```

### Priority
Medium - Better performance (stops at first match) and clearer intent.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
- Catalog: See BASELINE_TRANSFORMERS.md #24
```

---

### Issue 12: Add Array.join() → String.repeat() Transformer

**Title:** Add Array.join() → String.repeat() transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert Array.join() string repetition pattern to String.repeat().

### Baseline Status
- **Status:** Widely Available (2015)
- **Feature:** String.prototype.repeat()

### Transformations

```js
// Before
Array(n + 1).join(str)
new Array(n + 1).join(str)

// After
str.repeat(n)
```

### Priority
Low - Less common pattern but clearer when used.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat
- Catalog: See BASELINE_TRANSFORMERS.md #25
```

---

### Issue 13: Add Number.isNaN/isFinite Transformer

**Title:** Add Number.isNaN/isFinite transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert global isNaN/isFinite to Number.isNaN/Number.isFinite.

### Baseline Status
- **Status:** Widely Available (2015)
- **Feature:** Number.isNaN(), Number.isFinite(), Number.isInteger()

### Transformations

```js
// Before
isNaN(value)

// After
Number.isNaN(value)
```

```js
// Before
isFinite(value)

// After
Number.isFinite(value)
```

### Important Notes
- `Number.isNaN()` does NOT coerce the value (more precise)
- `Number.isFinite()` does NOT coerce the value
- This can be a breaking change if code relies on coercion

### Priority
Low - Requires careful consideration of breaking changes.

### References
- MDN (isNaN): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN
- MDN (isFinite): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite
- Catalog: See BASELINE_TRANSFORMERS.md #26
```

---

### Issue 14: Add String.startsWith/endsWith Transformer

**Title:** Add String.startsWith/endsWith transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert indexOf() prefix/suffix checks to startsWith()/endsWith().

### Baseline Status
- **Status:** Widely Available (2015)
- **Feature:** String.prototype.startsWith(), String.prototype.endsWith()

### Transformations

```js
// Before
str.indexOf(prefix) === 0
str.substring(0, prefix.length) === prefix

// After
str.startsWith(prefix)
```

```js
// Before
str.lastIndexOf(suffix) === str.length - suffix.length

// After
str.endsWith(suffix)
```

### Priority
High - Very clear intent improvement.

### References
- MDN (startsWith): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
- MDN (endsWith): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
- Catalog: See BASELINE_TRANSFORMERS.md #27
```

---

### Issue 15: Add Async/Await Transformer

**Title:** Add async/await transformer

**Labels:** enhancement, transformer, widely-available, complex

**Body:**
```markdown
## Feature Request

Add a transformer to convert Promise chains to async/await.

### Baseline Status
- **Status:** Widely Available (2017)
- **Feature:** async/await

### Transformations

```js
// Before
promise
  .then(result => {
    // handle result
  })
  .catch(err => {
    // handle error
  });

// After
try {
  const result = await promise;
  // handle result
} catch (err) {
  // handle error
}
```

### Important Notes
- Complex transformation
- Requires function to be marked `async`
- May require significant refactoring

### Priority
Low - Very complex transformation with many edge cases.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
- Catalog: See BASELINE_TRANSFORMERS.md #28
```

---

### Issue 16: Add Object.values() Transformer

**Title:** Add Object.values() transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert Object.keys().map() pattern to Object.values().

### Baseline Status
- **Status:** Widely Available (2017)
- **Feature:** Object.values()

### Transformations

```js
// Before
Object.keys(obj).map(key => obj[key])

// After
Object.values(obj)
```

### Priority
Medium - Cleaner code and better performance.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/values
- Catalog: See BASELINE_TRANSFORMERS.md #29
```

---

### Issue 17: Add String.padStart/padEnd Transformer

**Title:** Add String.padStart/padEnd transformer

**Labels:** enhancement, transformer, widely-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert manual string padding to padStart()/padEnd().

### Baseline Status
- **Status:** Widely Available (2017)
- **Feature:** String.prototype.padStart(), String.prototype.padEnd()

### Transformations

Replace manual padding logic with:
```js
str.padStart(length, padStr)
str.padEnd(length, padStr)
```

### Priority
Low - Manual padding patterns vary widely, complex to detect.

### References
- MDN (padStart): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
- MDN (padEnd): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padEnd
- Catalog: See BASELINE_TRANSFORMERS.md #30
```

---

## Newly Available Transformers (9 issues)

### Issue 18: Add Array.at() Transformer

**Title:** Add Array.at() transformer

**Labels:** enhancement, transformer, newly-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert negative array indexing to Array.at() method.

### Baseline Status
- **Status:** Newly Available (2022)
- **Feature:** Array.prototype.at()

### Transformations

```js
// Before
arr[arr.length - 1]  // last element
arr[arr.length - n]  // nth from end

// After
arr.at(-1)
arr.at(-n)
```

### Priority
High - Very common pattern, significant readability improvement.

### Note
Only available with `--baseline newly-available` flag.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at
- Catalog: See BASELINE_TRANSFORMERS.md #2 (Newly Available)
```

---

### Issue 19: Add Object.hasOwn() Transformer

**Title:** Add Object.hasOwn() transformer

**Labels:** enhancement, transformer, newly-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert Object.prototype.hasOwnProperty.call() to Object.hasOwn().

### Baseline Status
- **Status:** Newly Available (2022)
- **Feature:** Object.hasOwn()

### Transformations

```js
// Before
Object.prototype.hasOwnProperty.call(obj, prop)
{}.hasOwnProperty.call(obj, prop)

// After
Object.hasOwn(obj, prop)
```

### Priority
High - Much cleaner and safer pattern.

### Note
Only available with `--baseline newly-available` flag.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn
- Catalog: See BASELINE_TRANSFORMERS.md #3 (Newly Available)
```

---

### Issue 20: Add Array.findLast/findLastIndex Transformer

**Title:** Add Array.findLast/findLastIndex transformer

**Labels:** enhancement, transformer, newly-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert reverse-then-find patterns to findLast()/findLastIndex().

### Baseline Status
- **Status:** Newly Available (2023)
- **Feature:** Array.prototype.findLast(), Array.prototype.findLastIndex()

### Transformations

```js
// Before
arr.slice().reverse().find(predicate)

// After
arr.findLast(predicate)
```

```js
// Before
// Manual reverse iteration

// After
arr.findLastIndex(predicate)
```

### Priority
Medium - More efficient than slice + reverse.

### Note
Only available with `--baseline newly-available` flag.

### References
- MDN (findLast): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findLast
- MDN (findLastIndex): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findLastIndex
- Catalog: See BASELINE_TRANSFORMERS.md #4 (Newly Available)
```

---

### Issue 21: Add String.replaceAll Transformer

**Title:** Add String.replaceAll transformer

**Labels:** enhancement, transformer, newly-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert split().join() pattern to replaceAll().

### Baseline Status
- **Status:** Newly Available (2021)
- **Feature:** String.prototype.replaceAll()

### Transformations

```js
// Before
str.split(search).join(replace)

// After
str.replaceAll(search, replace)
```

```js
// Before (for literal strings)
str.replace(/pattern/g, replace)

// After
str.replaceAll(pattern, replace)
```

### Priority
High - Much clearer intent than split/join pattern.

### Note
Only available with `--baseline newly-available` flag.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll
- Catalog: See BASELINE_TRANSFORMERS.md #5 (Newly Available)
```

---

### Issue 22: Add Logical Assignment Operators Transformer

**Title:** Add logical assignment operators transformer

**Labels:** enhancement, transformer, newly-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert logical assignment patterns to logical assignment operators.

### Baseline Status
- **Status:** Newly Available (2021)
- **Feature:** Logical assignment operators (`??=`, `&&=`, `||=`)

### Transformations

```js
// Before
x = x ?? y
x = x || y
x = x && y

// After
x ??= y
x ||= y
x &&= y
```

```js
// Before
if (x === null || x === undefined) x = y

// After
x ??= y
```

### Priority
High - Concise and clear for conditional updates.

### Note
Only available with `--baseline newly-available` flag.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_OR_assignment
- Catalog: See BASELINE_TRANSFORMERS.md #6 (Newly Available)
```

---

### Issue 23: Add Promise.allSettled Transformer

**Title:** Add Promise.allSettled transformer

**Labels:** enhancement, transformer, newly-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert manual Promise.all with error handling to Promise.allSettled.

### Baseline Status
- **Status:** Newly Available (2020)
- **Feature:** Promise.allSettled()

### Transformations

Convert manual Promise.all with error handling to:
```js
Promise.allSettled(promises)
```

### Priority
Low - Complex to detect manual patterns.

### Note
Only available with `--baseline newly-available` flag.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
- Catalog: See BASELINE_TRANSFORMERS.md #7 (Newly Available)
```

---

### Issue 24: Add Promise.any Transformer

**Title:** Add Promise.any transformer

**Labels:** enhancement, transformer, newly-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert manual first-resolved promise logic to Promise.any.

### Baseline Status
- **Status:** Newly Available (2021)
- **Feature:** Promise.any()

### Transformations

Convert manual first-resolved promise logic to:
```js
Promise.any(promises)
```

### Priority
Low - Complex to detect manual patterns.

### Note
Only available with `--baseline newly-available` flag.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any
- Catalog: See BASELINE_TRANSFORMERS.md #8 (Newly Available)
```

---

### Issue 25: Add Numeric Separators Transformer

**Title:** Add numeric separators transformer

**Labels:** enhancement, transformer, newly-available, readability

**Body:**
```markdown
## Feature Request

Add a transformer to add numeric separators to large numbers for readability.

### Baseline Status
- **Status:** Newly Available (2021)
- **Feature:** Numeric separators

### Transformations

```js
// Before
1000000

// After
1_000_000
```

### Important Notes
- Primarily a readability improvement
- Not a functional transformation
- Should be optional/configurable

### Priority
Low - Readability-only, no functional change.

### Note
Only available with `--baseline newly-available` flag.

### References
- MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#numeric_separators
- Catalog: See BASELINE_TRANSFORMERS.md #9 (Newly Available)
```

---

### Issue 26: Add Array.toSorted/toReversed/toSpliced Transformer

**Title:** Add Array.toSorted/toReversed/toSpliced transformer

**Labels:** enhancement, transformer, newly-available

**Body:**
```markdown
## Feature Request

Add a transformer to convert spread-then-mutate patterns to non-mutating array methods.

### Baseline Status
- **Status:** Newly Available (2023)
- **Feature:** Array.prototype.toSorted(), toReversed(), toSpliced()

### Transformations

```js
// Before
[...arr].sort()
[...arr].reverse()
[...arr].splice(...)

// After
arr.toSorted()
arr.toReversed()
arr.toSpliced(...)
```

### Priority
Medium - These are non-mutating versions, safer and clearer.

### Note
Only available with `--baseline newly-available` flag.

### References
- MDN (toSorted): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted
- MDN (toReversed): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toReversed
- MDN (toSpliced): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSpliced
- Catalog: See BASELINE_TRANSFORMERS.md #10 (Newly Available)
```

---

## Summary

**Total Issues to Create:** 26

**By Category:**
- Widely Available: 17 issues
- Newly Available: 9 issues

**By Priority:**
- High: 12 issues
- Medium: 8 issues
- Low: 6 issues

**Instructions:**
1. Create each issue with the provided title, labels, and body content
2. Assign appropriate labels (enhancement, transformer, widely-available/newly-available)
3. Consider adding priority labels (high-priority, medium-priority, low-priority)
4. Link issues to the BASELINE_TRANSFORMERS.md catalog
