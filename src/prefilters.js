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
 * Match an identifier name, or any escaped identifier.
 *
 * JavaScript allows escapes in identifiers, such as `\u0069ndexOf`, and the
 * parser resolves them to their plain name. Accepting every escape keeps the
 * pattern a necessary condition.
 *
 * @param {string} names - Identifier name, or alternatives separated by `|`
 * @returns {RegExp} Pattern that matches the plain or escaped name
 */
function identifierPattern(names) {
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
  ["argumentsToRestParameters", [identifierPattern("arguments")]],
  ["arrayConcatToSpread", [identifierPattern("concat")]],
  ["arrayFilterToFind", [identifierPattern("filter")]],
  // Both `Array.from(...).forEach(...)` and `window.frames.forEach(...)` need it.
  ["arrayFromForEachToForOf", [identifierPattern("forEach")]],
  ["arrayFromToSpread", [identifierPattern("Array"), identifierPattern("from")]],
  ["arraySliceToSpread", [identifierPattern("slice")]],
  // `x = x + y` needs an assignment and one of the binary operators.
  ["compoundAssignment", [/-|\+|\*|\/|%/, /=/]],
  // Concatenation needs a `+` next to a string literal.
  ["concatToTemplateLiteral", [/\+/, /"|'/]],
  ["consoleLogToInfo", [identifierPattern("console"), identifierPattern("log")]],
  // `Name.prototype.method = ...` needs the prototype property.
  ["constructorToClass", [identifierPattern("prototype")]],
  // `if (x === undefined) x = value` needs a check for `undefined`.
  ["defaultParameterValues", [identifierPattern("undefined"), /\bif\b/]],
  // `for (let i = 0; i < arr.length; i++)` needs all three tokens.
  ["forLoopToForOf", [/\bfor\b/, identifierPattern("length"), /\+\+/]],
  // Global objects are read through `window`, `self`, or `Function`.
  ["globalContextToGlobalThis", [identifierPattern("window|self|Function")]],
  ["indexOfToIncludes", [identifierPattern("indexOf")]],
  ["indexOfToStartsWith", [identifierPattern("indexOf")]],
  ["iterableForEachToForOf", [identifierPattern("forEach")]],
  ["lastIndexOfToEndsWith", [identifierPattern("lastIndexOf")]],
  // Reassignments are guarded by a logical operator.
  ["logicalAssignment", [/\|\||&&|\?\?/]],
  ["mathPowToExponentiation", [identifierPattern("pow")]],
  // A variable holding a function needs a declaration and a function.
  ["namedArrowFunctionToNamedFunction", [/=>|function/, /\b(var|let|const|using)\b/]],
  // `arr[arr.length - 1]` needs the length property and a subtraction.
  ["negativeIndexToAt", [identifierPattern("length"), /-/]],
  // `x !== null && x !== undefined` needs both keywords.
  ["nullishCoalescingOperator", [/\bnull\b/, identifierPattern("undefined"), /&&/]],
  // Numeric separators need a group of digits in a decimal, hex, octal, or
  // binary literal.
  ["numericSeparators", [/\d{4,}|0[xX][0-9a-fA-F]{3,}|0[oO][0-7]{4,}|0[bB][01]{9,}/]],
  ["objectAssignToSpread", [identifierPattern("assign")]],
  ["objectHasOwn", [identifierPattern("hasOwnProperty")]],
  ["objectKeysForEachToEntries", [identifierPattern("keys")]],
  ["objectKeysMapToValues", [identifierPattern("keys")]],
  // Extractions are leading declarations inside a function body.
  [
    "objectPropertyExtractionToDestructuring",
    [/\b(var|let|const|using)\b/, /=>|function/],
  ],
  ["optionalChaining", [/&&/]],
  ["promiseToAsyncAwait", [identifierPattern("Promise|fetch")]],
  // Removing a directive needs the directive text and module syntax.
  ["removeUseStrictFromModules", [/["']use strict["']/, /\bimport\b|\bexport\b/]],
  // `x.replaceAll(...)` replaces, `x.split(...).join(...)` splits first.
  ["replaceAll", [identifierPattern("replace|split")]],
  ["substrToSlice", [identifierPattern("substr")]],
  ["substringToStartsWith", [identifierPattern("substring")]],
  ["varToLetOrConst", [/\bvar\b/]],
  ["promiseTry", [identifierPattern("Promise")]],
])

/**
 * Check whether a transformer can match the given source text.
 *
 * @param {string} name - Transformer name
 * @param {string} code - Source text of the current transformation pass
 * @returns {boolean} True when the transformer needs to run
 */
export function matchesPrefilter(name, code) {
  const conditions = prefilters.get(name) ?? []

  return conditions.every((condition) => condition.test(code))
}
