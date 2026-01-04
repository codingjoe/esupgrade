# Baseline JavaScript Transformers

This document catalogs all potential JavaScript transformers based on [Web Platform Baseline](https://web.dev/baseline/) features.

## Summary

- **Widely Available - Implemented**: 13 transformers
- **Widely Available - Potential**: 17 additional transformers
- **Newly Available - Implemented**: 1 transformer
- **Newly Available - Potential**: 9 additional transformers
- **Total Potential Transformers**: 40

## Widely Available Features

Features that work in all major browsers (Chrome, Edge, Safari, Firefox) for at least 30 months.

### Currently Implemented

1. **var → const/let** ✅
   - Status: Implemented
   - Baseline: 2015
   - Replaces `var` declarations with `const` (for non-reassigned variables) or `let` (for reassigned variables)

2. **String concatenation → Template literals** ✅
   - Status: Implemented
   - Baseline: 2015
   - Replaces string concatenation (`'Hello ' + name`) with template literals (`` `Hello ${name}` ``)

3. **Traditional for loops → for...of** ✅
   - Status: Implemented
   - Baseline: 2015
   - Replaces traditional `for(let i=0; i<arr.length; i++)` with `for(const item of arr)`

4. **Array.from().forEach() → for...of** ✅
   - Status: Implemented
   - Baseline: 2015
   - Replaces `Array.from(items).forEach(...)` with `for(const item of items)`

5. **DOM forEach() → for...of** ✅
   - Status: Implemented
   - Baseline: 2015
   - Replaces `document.querySelectorAll('.item').forEach(...)` with `for(const item of document.querySelectorAll('.item'))`

6. **Array.from() → Array spread** ✅
   - Status: Implemented
   - Baseline: 2015
   - Replaces `Array.from(items)` with `[...items]`

7. **Object.assign({}, ...) → Object spread** ✅
   - Status: Implemented
   - Baseline: 2018
   - Replaces `Object.assign({}, obj1, obj2)` with `{...obj1, ...obj2}`

8. **Array.concat() → Array spread** ✅
   - Status: Implemented
   - Baseline: 2015
   - Replaces `arr1.concat(arr2)` with `[...arr1, ...arr2]`

9. **Math.pow() → Exponentiation operator** ✅
   - Status: Implemented
   - Baseline: 2016
   - Replaces `Math.pow(base, exp)` with `base ** exp`

10. **Function expressions → Arrow functions** ✅
    - Status: Implemented
    - Baseline: 2015
    - Replaces anonymous function expressions with arrow functions (preserves semantics for `this`, `arguments`, etc.)

11. **Constructor functions → Classes** ✅
    - Status: Implemented
    - Baseline: 2015
    - Replaces constructor functions with prototype methods to ES6 class syntax

12. **console.log() → console.info()** ✅
    - Status: Implemented
    - Baseline: 2015
    - Replaces `console.log()` with `console.info()` for semantic clarity

13. **Remove redundant 'use strict'** ✅
    - Status: Implemented
    - Baseline: 2015
    - Removes redundant `'use strict'` directives from ES6 modules (which are strict by default)

### Potential Additions (Widely Available)

14. **Optional chaining (?.)** 🔄
    - Status: Not implemented
    - Baseline: 2020
    - Could replace: `obj && obj.prop && obj.prop.nested` → `obj?.prop?.nested`
    - Could replace: `arr && arr[0]` → `arr?.[0]`
    - Could replace: `fn && fn()` → `fn?.()`

15. **Nullish coalescing (??)** 🔄
    - Status: Not implemented
    - Baseline: 2020
    - Could replace: `value !== null && value !== undefined ? value : default` → `value ?? default`
    - Note: Different semantics from `||` operator (doesn't treat 0, '', false as nullish)

16. **indexOf() → includes()** 🔄
    - Status: Not implemented
    - Baseline: 2016 (Array), 2015 (String)
    - Could replace: `arr.indexOf(item) !== -1` → `arr.includes(item)`
    - Could replace: `str.indexOf(substr) !== -1` → `str.includes(substr)`
    - Could replace: `arr.indexOf(item) > -1` → `arr.includes(item)`
    - Could replace: `arr.indexOf(item) >= 0` → `arr.includes(item)`

17. **Object.keys().forEach() → Object.entries()** 🔄
    - Status: Not implemented
    - Baseline: 2017
    - Could replace: `Object.keys(obj).forEach(key => { const value = obj[key]; ... })` → `Object.entries(obj).forEach(([key, value]) => ...)`

18. **for...in with hasOwnProperty → Object.keys/entries** 🔄
    - Status: Not implemented
    - Baseline: 2017
    - Could replace: `for (const key in obj) { if (obj.hasOwnProperty(key)) { ... } }` → `for (const key of Object.keys(obj)) { ... }`

19. **Array.prototype.slice(0) → Array spread** 🔄
    - Status: Not implemented
    - Baseline: 2015
    - Could replace: `arr.slice(0)` → `[...arr]` (array copy)
    - Could replace: `arr.slice()` → `[...arr]` (array copy)

20. **String.prototype.substr → substring/slice** 🔄
    - Status: Not implemented
    - Baseline: Deprecated
    - Could replace deprecated `str.substr(start, length)` with `str.substring(start, start + length)` or `str.slice(start, start + length)`

21. **arguments object → Rest parameters** 🔄
    - Status: Not implemented
    - Baseline: 2015
    - Could replace: `function fn() { const args = Array.from(arguments); ... }` → `function fn(...args) { ... }`
    - Could replace: `function fn() { const args = [].slice.call(arguments); ... }` → `function fn(...args) { ... }`

22. **Default parameter values** 🔄
    - Status: Not implemented
    - Baseline: 2015
    - Could replace: `function fn(x) { x = x || defaultValue; ... }` → `function fn(x = defaultValue) { ... }`
    - Could replace: `function fn(x) { if (x === undefined) x = defaultValue; ... }` → `function fn(x = defaultValue) { ... }`

23. **Destructuring in function parameters** 🔄
    - Status: Not implemented
    - Baseline: 2015
    - Could replace: `function fn(obj) { const x = obj.x, y = obj.y; ... }` → `function fn({x, y}) { ... }`

24. **Array.prototype.find() instead of filter()[0]** 🔄
    - Status: Not implemented
    - Baseline: 2015
    - Could replace: `arr.filter(predicate)[0]` → `arr.find(predicate)`

25. **String.prototype.repeat() instead of loops** 🔄
    - Status: Not implemented
    - Baseline: 2015
    - Could replace: `Array(n + 1).join(str)` → `str.repeat(n)`
    - Could replace: `new Array(n + 1).join(str)` → `str.repeat(n)`

26. **Number methods (isNaN, isFinite, isInteger)** 🔄
    - Status: Not implemented
    - Baseline: 2015
    - Could replace: `isNaN(value)` → `Number.isNaN(value)` (more precise)
    - Could replace: `isFinite(value)` → `Number.isFinite(value)` (doesn't coerce)

27. **String.prototype.startsWith/endsWith** 🔄
    - Status: Not implemented
    - Baseline: 2015
    - Could replace: `str.indexOf(prefix) === 0` → `str.startsWith(prefix)`
    - Could replace: `str.lastIndexOf(suffix) === str.length - suffix.length` → `str.endsWith(suffix)`
    - Could replace: `str.substring(0, prefix.length) === prefix` → `str.startsWith(prefix)`

28. **Async/await instead of Promise chains** 🔄
    - Status: Not implemented
    - Baseline: 2017
    - Could replace: `promise.then(result => { ... }).catch(err => { ... })` → `try { const result = await promise; ... } catch (err) { ... }`
    - Note: Complex transformation, requires function to be marked async

29. **Object.values()** 🔄
    - Status: Not implemented
    - Baseline: 2017
    - Could replace: `Object.keys(obj).map(key => obj[key])` → `Object.values(obj)`

30. **String.prototype.padStart/padEnd** 🔄
    - Status: Not implemented
    - Baseline: 2017
    - Could replace manual padding logic with `str.padStart(length, padStr)` or `str.padEnd(length, padStr)`

## Newly Available Features

Features available in all browsers for 0-30 months.

### Currently Implemented

1. **Promise.try()** ✅
   - Status: Implemented
   - Baseline: 2025
   - Replaces `new Promise((resolve) => { resolve(fn()); })` with `Promise.try(fn)`

### Potential Additions (Newly Available)

2. **Array.prototype.at()** 🔄
   - Status: Not implemented
   - Baseline: 2022
   - Could replace: `arr[arr.length - 1]` → `arr.at(-1)` (last element)
   - Could replace: `arr[arr.length - n]` → `arr.at(-n)`

3. **Object.hasOwn()** 🔄
   - Status: Not implemented
   - Baseline: 2022
   - Could replace: `Object.prototype.hasOwnProperty.call(obj, prop)` → `Object.hasOwn(obj, prop)`
   - Could replace: `{}.hasOwnProperty.call(obj, prop)` → `Object.hasOwn(obj, prop)`

4. **Array.prototype.findLast/findLastIndex** 🔄
   - Status: Not implemented
   - Baseline: 2023
   - Could replace: `arr.slice().reverse().find(predicate)` → `arr.findLast(predicate)`
   - Could replace: Manual reverse iteration → `arr.findLastIndex(predicate)`

5. **String.prototype.replaceAll** 🔄
   - Status: Not implemented
   - Baseline: 2021
   - Could replace: `str.split(search).join(replace)` → `str.replaceAll(search, replace)`
   - Could replace: `str.replace(/pattern/g, replace)` → `str.replaceAll(pattern, replace)` (for literal strings)

6. **Logical assignment operators (??=, &&=, ||=)** 🔄
   - Status: Not implemented
   - Baseline: 2021
   - Could replace: `x = x ?? y` → `x ??= y`
   - Could replace: `x = x || y` → `x ||= y`
   - Could replace: `x = x && y` → `x &&= y`
   - Could replace: `if (x === null || x === undefined) x = y` → `x ??= y`

7. **Promise.allSettled** 🔄
   - Status: Not implemented
   - Baseline: 2020
   - Could replace manual Promise.all with error handling → `Promise.allSettled(promises)`

8. **Promise.any** 🔄
   - Status: Not implemented
   - Baseline: 2021
   - Could replace manual first-resolved promise logic → `Promise.any(promises)`

9. **Numeric separators** 🔄
   - Status: Not implemented
   - Baseline: 2021
   - Could replace: `1000000` → `1_000_000` (improves readability)
   - Note: This is primarily a readability improvement, not a functional transformation

10. **Array.prototype.toSorted/toReversed/toSpliced** 🔄
    - Status: Not implemented
    - Baseline: 2023
    - Could replace: `[...arr].sort()` → `arr.toSorted()`
    - Could replace: `[...arr].reverse()` → `arr.toReversed()`
    - Could replace: `[...arr].splice(...)` → `arr.toSpliced(...)`
    - Note: These are non-mutating versions of existing methods

## Implementation Priority

### High Priority (Widely Available, High Impact)
1. Optional chaining (?.)
2. Nullish coalescing (??)
3. indexOf() → includes()
4. Rest parameters
5. Default parameters
6. String.prototype.startsWith/endsWith

### Medium Priority (Widely Available, Moderate Impact)
1. Object.entries() for key-value iteration
2. Array.prototype.find() instead of filter()[0]
3. String.prototype.repeat()
4. Array.prototype.slice(0) → spread

### Low Priority (Complex or Lower Impact)
1. Async/await (complex transformation)
2. Destructuring (may reduce readability in some cases)
3. Number.isNaN/isFinite (breaking change in edge cases)

### Newly Available Features (Use with Caution)
1. Array.prototype.at() (high value for negative indexing)
2. Object.hasOwn() (cleaner than hasOwnProperty.call)
3. String.prototype.replaceAll() (clearer intent than split/join)
4. Logical assignment operators (concise updates)

## Notes on Transformations

- **Safety**: All transformations must preserve the original code's semantics
- **Readability**: Some transformations may reduce readability and should be optional
- **Breaking changes**: Transformations that could break in edge cases should be well-documented
- **Browser support**: Newly available features should only be used with explicit opt-in
- **Testing**: Each transformer should have comprehensive test coverage

## Contributing

When adding new transformers:
1. Verify the feature is in Baseline (widely or newly available)
2. Identify safe, common patterns that can be transformed
3. Write comprehensive tests covering edge cases
4. Document the transformation in README.md
5. Update this list
