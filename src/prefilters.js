/**
 * Source text conditions that decide whether a transformer can match.
 *
 * Every transformer walks the whole syntax tree, which dominates the runtime of
 * this package. A transformer can only match when its pattern occurs in the
 * source text, so testing the text first skips the traversal for transformations
 * that cannot apply.
 */

const ESCAPED_IDENTIFIER = String.raw`\\u`

/**
 * JavaScript allows escapes in identifiers, such as `\u0069ndexOf`, and the
 * parser resolves them to their plain name. Accepting every escape keeps the
 * pattern a necessary condition.
 *
 * @param {string} names - Identifier name, or alternatives separated by `|`
 * @returns {RegExp} Pattern that matches the plain or escaped name
 */
function createIdentifierPattern(names) {
  return new RegExp(`${names}|${ESCAPED_IDENTIFIER}`)
}

/**
 * Conditions a transformer needs in the source text. A transformer runs when all
 * of its conditions match. Each condition must be necessary: when the source
 * text fails a condition, the transformer cannot change the tree.
 *
 * @type {Map<string, RegExp[]>}
 */
export const prefilters = new Map([
  // Function expressions always use the `function` keyword.
  ["anonymousFunctionToArrow", [/function/]],
  ["argumentsToRestParameters", [createIdentifierPattern("arguments")]],
  ["arrayConcatToSpread", [createIdentifierPattern("concat")]],
  // A copy is `[...array]` or `array.slice()`, then sort, reverse or splice.
  [
    "arrayCopyToImmutableMethod",
    [createIdentifierPattern("sort|reverse|splice"), /\.\.\.|slice/],
  ],
  ["arrayFilterToFind", [createIdentifierPattern("filter")]],
  // Both `Array.from(...).forEach(...)` and `window.frames.forEach(...)` need it.
  ["arrayFromForEachToForOf", [createIdentifierPattern("forEach")]],
  [
    "arrayFromToSpread",
    [createIdentifierPattern("Array"), createIdentifierPattern("from")],
  ],
  ["arraySliceToSpread", [createIdentifierPattern("slice")]],
  // `x = x + y` needs an assignment and one of the binary operators.
  ["compoundAssignment", [/-|\+|\*|\/|%/, /=/]],
  // Concatenation needs a `+` next to a string literal.
  ["concatToTemplateLiteral", [/\+/, /"|'/]],
  [
    "consoleLogToInfo",
    [createIdentifierPattern("console"), createIdentifierPattern("log")],
  ],
  // `Name.prototype.method = ...` needs the prototype property.
  ["constructorToClass", [createIdentifierPattern("prototype")]],
  // `if (x === undefined) x = value` needs a check for `undefined`.
  ["defaultParameterValues", [createIdentifierPattern("undefined"), /\bif\b/]],
  // `<binding>.cause = value` names a binding and an error constructor.
  [
    "errorCauseAssignment",
    [createIdentifierPattern("Error"), createIdentifierPattern("cause")],
  ],
  // `for (let i = 0; i < arr.length; i++)` needs all three tokens.
  ["forLoopToForOf", [/\bfor\b/, createIdentifierPattern("length"), /\+\+/]],
  // Global objects are read through `window`, `self`, or `Function`.
  ["globalContextToGlobalThis", [createIdentifierPattern("window|self|Function")]],
  ["indexOfToIncludes", [createIdentifierPattern("indexOf")]],
  ["indexOfToStartsWith", [createIdentifierPattern("indexOf")]],
  ["iterableForEachToForOf", [createIdentifierPattern("forEach")]],
  ["lastIndexOfToEndsWith", [createIdentifierPattern("lastIndexOf")]],
  // Reassignments are guarded by a logical operator.
  ["logicalAssignment", [/\|\||&&|\?\?/]],
  ["mathPowToExponentiation", [createIdentifierPattern("pow")]],
  // A variable holding a function needs a declaration and a function.
  ["namedArrowFunctionToNamedFunction", [/=>|function/, /\b(var|let|const|using)\b/]],
  // `arr[arr.length - 1]` needs the length property and a subtraction.
  ["negativeIndexToAt", [createIdentifierPattern("length"), /-/]],
  // `x !== null && x !== undefined` needs both keywords.
  [
    "nullishCoalescingOperator",
    [/\bnull\b/, createIdentifierPattern("undefined"), /&&/],
  ],
  // Numeric separators need a group of digits in a decimal or hex literal.
  ["numericSeparators", [/\d{4,}|0[xX][0-9a-fA-F]{3,}/]],
  ["objectAssignToSpread", [createIdentifierPattern("assign")]],
  ["objectHasOwn", [createIdentifierPattern("hasOwnProperty")]],
  ["objectKeysForEachToEntries", [createIdentifierPattern("keys")]],
  ["objectKeysMapToValues", [createIdentifierPattern("keys")]],
  // Extractions are leading declarations inside a function body.
  [
    "objectPropertyExtractionToDestructuring",
    [/\b(var|let|const|using)\b/, /=>|function/],
  ],
  ["optionalChaining", [/&&/]],
  ["promiseToAsyncAwait", [createIdentifierPattern("Promise|fetch")]],
  // The capture needs a `let` binding pair and a `new Promise(...)` executor.
  ["promiseWithResolvers", [/\blet\b/, /\bnew\b/, createIdentifierPattern("Promise")]],
  // Removing a directive needs the directive text and module syntax.
  ["removeUseStrictFromModules", [/["']use strict["']/, /\bimport\b|\bexport\b/]],
  // `x.replaceAll(...)` replaces, `x.split(...).join(...)` splits first.
  ["replaceAll", [createIdentifierPattern("replace|split")]],
  ["substrToSlice", [createIdentifierPattern("substr")]],
  ["substringToStartsWith", [createIdentifierPattern("substring")]],
  // `str.trimLeft()` and `str.trimRight()` name the renamed methods.
  ["trimLeftRightToTrimStartEnd", [createIdentifierPattern("trimLeft|trimRight")]],
  ["varToLetOrConst", [/\bvar\b/]],
  ["promiseTry", [createIdentifierPattern("Promise")]],
])

/**
 * @param {string} name - Transformer name
 * @param {string} code - Source text of the current transformation pass
 * @returns {boolean} True when the transformer needs to run
 */
export function matchesPrefilter(name, code) {
  return prefilters.get(name).every((condition) => condition.test(code))
}
