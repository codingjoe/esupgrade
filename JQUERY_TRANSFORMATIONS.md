# jQuery to Vanilla JavaScript Transformations

This document outlines potential transformations for removing jQuery in favor of modern vanilla JavaScript. Each transformation includes the pattern to transform, the modern equivalent, and justification for why the transformation is safe.

## Selector Transformations

### 1. `$('.selector')` → `document.querySelectorAll('.selector')`

**Pattern:**
```javascript
$('.foo.bar')
```

**Transform to:**
```javascript
document.querySelectorAll('.foo.bar')
```

**Safety justification:**
- `querySelectorAll()` has been widely available since 2015 (Baseline: widely available)
- Both return a collection of matching elements
- jQuery's `$()` returns a jQuery object, while `querySelectorAll()` returns a NodeList
- NodeList is iterable with `for...of` since ES2015
- Safe when the result is used for iteration or length checks
- **Caveat**: Not safe if jQuery-specific methods are chained (e.g., `.addClass()`, `.css()`)

### 2. `$('#id')` → `document.getElementById('id')`

**Pattern:**
```javascript
$('#myElement')
```

**Transform to:**
```javascript
document.getElementById('myElement')
```

**Safety justification:**
- `getElementById()` has universal browser support
- Returns a single element or null (matches jQuery's behavior for single ID)
- More performant than `querySelectorAll()`
- Safe when no jQuery methods are chained

### 3. `$(selector).each()` → `for...of` loop

**Pattern:**
```javascript
$('.item').each(function() {
  console.log($(this).text());
});
```

**Transform to:**
```javascript
for (const element of document.querySelectorAll('.item')) {
  console.log(element.textContent);
}
```

**Safety justification:**
- `for...of` is widely available (ES2015)
- NodeList is iterable, making this transformation straightforward
- Clearer, more idiomatic JavaScript
- No context (`this`) confusion
- Only transform when callback doesn't use index parameter
- **Caveat**: jQuery's `$(this)` must be replaced with direct element reference

## DOM Manipulation Transformations

### 4. `$(element).addClass()` → `element.classList.add()`

**Pattern:**
```javascript
$(element).addClass('active');
$(element).addClass('foo bar');
```

**Transform to:**
```javascript
element.classList.add('active');
element.classList.add('foo', 'bar');
```

**Safety justification:**
- `classList` API is widely available (2015+)
- Native browser API with same semantics
- Handles multiple classes naturally with spread/split
- More performant than jQuery

### 5. `$(element).removeClass()` → `element.classList.remove()`

**Pattern:**
```javascript
$(element).removeClass('active');
```

**Transform to:**
```javascript
element.classList.remove('active');
```

**Safety justification:**
- `classList.remove()` is widely available
- Direct API equivalent with same semantics

### 6. `$(element).toggleClass()` → `element.classList.toggle()`

**Pattern:**
```javascript
$(element).toggleClass('active');
```

**Transform to:**
```javascript
element.classList.toggle('active');
```

**Safety justification:**
- `classList.toggle()` is widely available
- Exact semantic match
- Returns boolean indicating final state (jQuery doesn't)

### 7. `$(element).hasClass()` → `element.classList.contains()`

**Pattern:**
```javascript
if ($(element).hasClass('active')) { }
```

**Transform to:**
```javascript
if (element.classList.contains('active')) { }
```

**Safety justification:**
- `classList.contains()` is widely available
- Direct equivalent with same return type (boolean)

### 8. `$(element).attr()` getter → `element.getAttribute()`

**Pattern:**
```javascript
const value = $(element).attr('data-id');
```

**Transform to:**
```javascript
const value = element.getAttribute('data-id');
```

**Safety justification:**
- `getAttribute()` has universal browser support
- Returns string or null (jQuery returns undefined for missing attrs)
- Safe when checking for existence with nullish checks

### 9. `$(element).attr()` setter → `element.setAttribute()`

**Pattern:**
```javascript
$(element).attr('data-id', '123');
```

**Transform to:**
```javascript
element.setAttribute('data-id', '123');
```

**Safety justification:**
- `setAttribute()` has universal browser support
- Exact semantic match for setting attributes

### 10. `$(element).removeAttr()` → `element.removeAttribute()`

**Pattern:**
```javascript
$(element).removeAttr('disabled');
```

**Transform to:**
```javascript
element.removeAttribute('disabled');
```

**Safety justification:**
- `removeAttribute()` has universal browser support
- Direct equivalent

### 11. `$(element).prop()` → Direct property access

**Pattern:**
```javascript
$(checkbox).prop('checked');
$(checkbox).prop('checked', true);
```

**Transform to:**
```javascript
checkbox.checked;
checkbox.checked = true;
```

**Safety justification:**
- Direct property access is native JavaScript
- Properties like `checked`, `disabled`, `selected` are standard DOM properties
- More explicit and performant
- Safe for boolean properties

### 12. `$(element).text()` getter → `element.textContent`

**Pattern:**
```javascript
const text = $(element).text();
```

**Transform to:**
```javascript
const text = element.textContent;
```

**Safety justification:**
- `textContent` is widely available
- Returns text content without HTML
- Slightly different from jQuery (jQuery concatenates all descendants)
- Safe for single elements

### 13. `$(element).text()` setter → `element.textContent = value`

**Pattern:**
```javascript
$(element).text('Hello');
```

**Transform to:**
```javascript
element.textContent = 'Hello';
```

**Safety justification:**
- `textContent` setter is widely available
- Replaces element content with text (escaping HTML)
- Matches jQuery's text-setting behavior

### 14. `$(element).html()` getter → `element.innerHTML`

**Pattern:**
```javascript
const html = $(element).html();
```

**Transform to:**
```javascript
const html = element.innerHTML;
```

**Safety justification:**
- `innerHTML` has universal support
- Direct equivalent
- **Security note**: Both have XSS risks if used with untrusted content

### 15. `$(element).html()` setter → `element.innerHTML = value`

**Pattern:**
```javascript
$(element).html('<span>Hello</span>');
```

**Transform to:**
```javascript
element.innerHTML = '<span>Hello</span>';
```

**Safety justification:**
- `innerHTML` setter has universal support
- Direct equivalent
- **Security note**: Transformation should add comment about XSS risks

### 16. `$(element).val()` → `element.value`

**Pattern:**
```javascript
const value = $(input).val();
$(input).val('new value');
```

**Transform to:**
```javascript
const value = input.value;
input.value = 'new value';
```

**Safety justification:**
- `value` property has universal support
- Direct equivalent for form elements
- Safe for input, textarea, select elements

### 17. `$(element).append()` → `element.append()`

**Pattern:**
```javascript
$(parent).append(child);
$(parent).append('<div>Hello</div>');
```

**Transform to:**
```javascript
parent.append(child);
parent.innerHTML += '<div>Hello</div>'; // For string content
```

**Safety justification:**
- `append()` method is widely available (2017+)
- Accepts nodes and strings
- Direct equivalent for modern browsers
- **Note**: String appending might need special handling

### 18. `$(element).prepend()` → `element.prepend()`

**Pattern:**
```javascript
$(parent).prepend(child);
```

**Transform to:**
```javascript
parent.prepend(child);
```

**Safety justification:**
- `prepend()` is widely available (2017+)
- Direct equivalent

### 19. `$(element).before()` → `element.before()`

**Pattern:**
```javascript
$(element).before(newElement);
```

**Transform to:**
```javascript
element.before(newElement);
```

**Safety justification:**
- `before()` is widely available (2017+)
- Direct equivalent

### 20. `$(element).after()` → `element.after()`

**Pattern:**
```javascript
$(element).after(newElement);
```

**Transform to:**
```javascript
element.after(newElement);
```

**Safety justification:**
- `after()` is widely available (2017+)
- Direct equivalent

### 21. `$(element).remove()` → `element.remove()`

**Pattern:**
```javascript
$(element).remove();
```

**Transform to:**
```javascript
element.remove();
```

**Safety justification:**
- `remove()` is widely available (2015+)
- Direct equivalent
- Removes element from DOM

### 22. `$(element).empty()` → `element.replaceChildren()`

**Pattern:**
```javascript
$(element).empty();
```

**Transform to:**
```javascript
element.replaceChildren();
```

**Safety justification:**
- `replaceChildren()` is widely available (2020+)
- Direct equivalent for clearing all children
- Alternative: `element.innerHTML = ''` (universal support but less semantic)

## Event Handling Transformations

### 23. `$(element).on()` → `element.addEventListener()`

**Pattern:**
```javascript
$(element).on('click', handler);
$(element).on('click', '.selector', handler); // Delegated
```

**Transform to:**
```javascript
element.addEventListener('click', handler);
// Delegated events need manual implementation or leave as-is
```

**Safety justification:**
- `addEventListener()` has universal support
- Direct equivalent for non-delegated events
- **Caveat**: Event delegation requires different approach (manual target checking)
- Safe when no delegation or special jQuery event features used

### 24. `$(element).off()` → `element.removeEventListener()`

**Pattern:**
```javascript
$(element).off('click', handler);
```

**Transform to:**
```javascript
element.removeEventListener('click', handler);
```

**Safety justification:**
- `removeEventListener()` has universal support
- Requires same function reference (matches jQuery behavior)

### 25. `$(element).click()` → `element.addEventListener('click')`

**Pattern:**
```javascript
$(element).click(function() { });
```

**Transform to:**
```javascript
element.addEventListener('click', function() { });
```

**Safety justification:**
- More explicit event handling
- `addEventListener()` is the standard approach
- Safe for all click handlers

### 26. `$(element).trigger()` → `element.dispatchEvent()`

**Pattern:**
```javascript
$(element).trigger('click');
$(element).trigger('custom-event');
```

**Transform to:**
```javascript
element.dispatchEvent(new Event('click'));
element.dispatchEvent(new CustomEvent('custom-event'));
```

**Safety justification:**
- `dispatchEvent()` and `Event`/`CustomEvent` constructors widely available
- Standard DOM event dispatch mechanism
- May need custom event data handling for `CustomEvent`

### 27. `$(document).ready()` → `DOMContentLoaded` event

**Pattern:**
```javascript
$(document).ready(function() {
  // code
});
```

**Transform to:**
```javascript
document.addEventListener('DOMContentLoaded', function() {
  // code
});
```

**Safety justification:**
- `DOMContentLoaded` has universal support
- Direct equivalent behavior
- Standard modern pattern
- **Caveat**: If document is already loaded, jQuery executes immediately - need to check `document.readyState`

## Traversal Transformations

### 28. `$(element).find()` → `element.querySelectorAll()`

**Pattern:**
```javascript
$(element).find('.child');
```

**Transform to:**
```javascript
element.querySelectorAll('.child');
```

**Safety justification:**
- `querySelectorAll()` is widely available
- Scoped selector search
- Returns NodeList (iterable)

### 29. `$(element).parent()` → `element.parentElement`

**Pattern:**
```javascript
$(element).parent();
```

**Transform to:**
```javascript
element.parentElement;
```

**Safety justification:**
- `parentElement` has universal support
- Returns single parent element or null
- Direct equivalent

### 30. `$(element).children()` → `element.children`

**Pattern:**
```javascript
$(element).children();
```

**Transform to:**
```javascript
Array.from(element.children);
```

**Safety justification:**
- `children` property is universal
- Returns HTMLCollection (need `Array.from()` for array methods)
- Direct equivalent for getting child elements

### 31. `$(element).closest()` → `element.closest()`

**Pattern:**
```javascript
$(element).closest('.container');
```

**Transform to:**
```javascript
element.closest('.container');
```

**Safety justification:**
- `closest()` is widely available (2017+)
- Direct equivalent
- Traverses up the DOM tree including self

### 32. `$(element).next()` → `element.nextElementSibling`

**Pattern:**
```javascript
$(element).next();
```

**Transform to:**
```javascript
element.nextElementSibling;
```

**Safety justification:**
- `nextElementSibling` is widely available
- Returns next sibling element or null
- Direct equivalent

### 33. `$(element).prev()` → `element.previousElementSibling`

**Pattern:**
```javascript
$(element).prev();
```

**Transform to:**
```javascript
element.previousElementSibling;
```

**Safety justification:**
- `previousElementSibling` is widely available
- Returns previous sibling element or null
- Direct equivalent

### 34. `$(element).siblings()` → Manual sibling collection

**Pattern:**
```javascript
$(element).siblings();
```

**Transform to:**
```javascript
Array.from(element.parentElement.children).filter(child => child !== element);
```

**Safety justification:**
- No direct native equivalent
- Requires manual filtering
- Safe but more verbose
- Consider leaving complex cases untransformed

## CSS and Style Transformations

### 35. `$(element).css()` getter → `getComputedStyle()`

**Pattern:**
```javascript
$(element).css('color');
```

**Transform to:**
```javascript
getComputedStyle(element).color;
```

**Safety justification:**
- `getComputedStyle()` has universal support
- Returns computed styles (matches jQuery behavior)
- Read-only access

### 36. `$(element).css()` setter → `element.style` property

**Pattern:**
```javascript
$(element).css('color', 'red');
$(element).css({ color: 'red', display: 'block' });
```

**Transform to:**
```javascript
element.style.color = 'red';
element.style.color = 'red';
element.style.display = 'block';
```

**Safety justification:**
- `style` property has universal support
- Direct inline style manipulation
- Object syntax needs to be expanded to multiple assignments

### 37. `$(element).show()` → `element.style.display`

**Pattern:**
```javascript
$(element).show();
```

**Transform to:**
```javascript
element.style.display = '';
```

**Safety justification:**
- Setting `display` to empty string restores default
- Matches jQuery behavior (removes inline display:none)
- Safe for showing hidden elements

### 38. `$(element).hide()` → `element.style.display`

**Pattern:**
```javascript
$(element).hide();
```

**Transform to:**
```javascript
element.style.display = 'none';
```

**Safety justification:**
- Direct equivalent
- Universal support
- Hides element from layout

### 39. `$(element).width()` → `element.offsetWidth` or `element.clientWidth`

**Pattern:**
```javascript
const width = $(element).width();
```

**Transform to:**
```javascript
const width = element.clientWidth; // Excludes border, includes padding
```

**Safety justification:**
- `clientWidth` is widely available
- Returns width in pixels as number
- Similar to jQuery's `.width()` (content + padding)
- **Note**: jQuery's width() can return fractional pixels; native returns integer

### 40. `$(element).height()` → `element.offsetHeight` or `element.clientHeight`

**Pattern:**
```javascript
const height = $(element).height();
```

**Transform to:**
```javascript
const height = element.clientHeight;
```

**Safety justification:**
- Same justification as width transformation

## Array/Collection Transformations

### 41. `$.each()` on arrays → `array.forEach()`

**Pattern:**
```javascript
$.each(array, function(index, value) {
  console.log(value);
});
```

**Transform to:**
```javascript
array.forEach(function(value, index) {
  console.log(value);
});
```

**Safety justification:**
- `forEach()` is widely available (ES5)
- **Note**: Parameter order is different! (value, index) vs jQuery's (index, value)
- Safe with parameter order correction

### 42. `$.map()` → `array.map()`

**Pattern:**
```javascript
$.map(array, function(value, index) {
  return value * 2;
});
```

**Transform to:**
```javascript
array.map(function(value, index) {
  return value * 2;
});
```

**Safety justification:**
- `map()` is widely available (ES5)
- Parameter order matches jQuery
- Direct equivalent

### 43. `$.grep()` → `array.filter()`

**Pattern:**
```javascript
$.grep(array, function(value) {
  return value > 5;
});
```

**Transform to:**
```javascript
array.filter(function(value) {
  return value > 5;
});
```

**Safety justification:**
- `filter()` is widely available (ES5)
- Direct equivalent
- Same semantics

### 44. `$.inArray()` → `array.indexOf()` or `array.includes()`

**Pattern:**
```javascript
$.inArray(value, array) !== -1
```

**Transform to:**
```javascript
array.includes(value)
```

**Safety justification:**
- `includes()` is widely available (2016+)
- More readable and explicit
- Direct equivalent for existence checks

### 45. `$.isArray()` → `Array.isArray()`

**Pattern:**
```javascript
$.isArray(value);
```

**Transform to:**
```javascript
Array.isArray(value);
```

**Safety justification:**
- `Array.isArray()` is widely available (ES5)
- Standard JavaScript method
- Direct equivalent

## AJAX Transformations

### 46. `$.ajax()` → `fetch()`

**Pattern:**
```javascript
$.ajax({
  url: '/api/data',
  method: 'GET',
  success: function(data) { },
  error: function(err) { }
});
```

**Transform to:**
```javascript
fetch('/api/data')
  .then(response => response.json())
  .then(data => { })
  .catch(err => { });
```

**Safety justification:**
- `fetch()` is widely available (2017+)
- Modern promise-based API
- **Caveat**: fetch doesn't reject on HTTP errors (4xx, 5xx) - need response.ok check
- Requires careful translation of jQuery options
- Consider as complex transformation with manual review

### 47. `$.get()` → `fetch()`

**Pattern:**
```javascript
$.get('/api/data', function(data) {
  console.log(data);
});
```

**Transform to:**
```javascript
fetch('/api/data')
  .then(response => response.json())
  .then(data => {
    console.log(data);
  });
```

**Safety justification:**
- `fetch()` is widely available
- **Caveat**: Assumes JSON response; may need content-type checking
- Safe for simple GET requests

### 48. `$.post()` → `fetch()` with POST

**Pattern:**
```javascript
$.post('/api/data', { key: 'value' }, function(data) { });
```

**Transform to:**
```javascript
fetch('/api/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' })
})
  .then(response => response.json())
  .then(data => { });
```

**Safety justification:**
- `fetch()` is widely available
- Requires explicit configuration
- Safe with proper headers and body serialization

## Utility Transformations

### 49. `$.trim()` → `string.trim()`

**Pattern:**
```javascript
$.trim(str);
```

**Transform to:**
```javascript
str.trim();
```

**Safety justification:**
- `trim()` is widely available (ES5)
- Direct equivalent
- Native string method

### 50. `$.extend()` → `Object.assign()` or object spread

**Pattern:**
```javascript
$.extend({}, obj1, obj2);
$.extend(true, {}, obj1, obj2); // Deep merge
```

**Transform to:**
```javascript
Object.assign({}, obj1, obj2);
{ ...obj1, ...obj2 }
// Deep merge requires different approach (structuredClone or manual recursion)
```

**Safety justification:**
- `Object.assign()` is widely available (2015+)
- Object spread is widely available (2018+)
- **Caveat**: Shallow copy only; deep merge needs different solution
- Safe for shallow object merging

### 51. `$.parseJSON()` → `JSON.parse()`

**Pattern:**
```javascript
$.parseJSON(jsonString);
```

**Transform to:**
```javascript
JSON.parse(jsonString);
```

**Safety justification:**
- `JSON.parse()` has universal support
- Direct equivalent
- Standard JavaScript method

### 52. `$.type()` → `typeof` or custom type checking

**Pattern:**
```javascript
$.type(value);
```

**Transform to:**
```javascript
// Complex - depends on type
typeof value; // For primitives
Array.isArray(value); // For arrays
value === null ? 'null' : typeof value; // For null
```

**Safety justification:**
- No direct equivalent
- jQuery's `$.type()` provides enhanced type detection
- May not be worth transforming due to complexity
- Consider case-by-case

### 53. `$.isFunction()` → `typeof === 'function'`

**Pattern:**
```javascript
$.isFunction(value);
```

**Transform to:**
```javascript
typeof value === 'function';
```

**Safety justification:**
- `typeof` operator has universal support
- Direct equivalent for function checking
- More explicit

### 54. `$.isPlainObject()` → Custom check or library

**Pattern:**
```javascript
$.isPlainObject(value);
```

**Transform to:**
```javascript
// No direct equivalent - complex check needed
value?.constructor === Object;
// Or: Object.prototype.toString.call(value) === '[object Object]'
```

**Safety justification:**
- No direct native equivalent
- Requires custom implementation
- Consider leaving untransformed or adding utility function

### 55. `$.isEmptyObject()` → `Object.keys()` check

**Pattern:**
```javascript
$.isEmptyObject(obj);
```

**Transform to:**
```javascript
Object.keys(obj).length === 0;
```

**Safety justification:**
- `Object.keys()` is widely available (ES5)
- Reliable empty object check
- Safe transformation

### 56. `$.now()` → `Date.now()`

**Pattern:**
```javascript
$.now();
```

**Transform to:**
```javascript
Date.now();
```

**Safety justification:**
- `Date.now()` is widely available (ES5)
- Returns timestamp in milliseconds
- Direct equivalent

### 57. `$.makeArray()` → `Array.from()`

**Pattern:**
```javascript
$.makeArray(arrayLike);
```

**Transform to:**
```javascript
Array.from(arrayLike);
```

**Safety justification:**
- `Array.from()` is widely available (2015+)
- Direct equivalent
- Converts array-like and iterables to arrays

## Animation Transformations

### 58. `$(element).fadeIn()` → CSS transition + class

**Pattern:**
```javascript
$(element).fadeIn();
```

**Transform to:**
```javascript
// Recommend CSS transitions instead
element.style.opacity = '1';
// Or use Web Animations API
element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
```

**Safety justification:**
- CSS transitions are widely available and more performant
- Web Animations API is widely available (2020+)
- No direct JavaScript equivalent - animations belong in CSS
- Complex transformation; might skip

### 59. `$(element).fadeOut()` → CSS transition + class

**Pattern:**
```javascript
$(element).fadeOut();
```

**Transform to:**
```javascript
element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400 })
  .finished.then(() => element.style.display = 'none');
```

**Safety justification:**
- Web Animations API is widely available
- Requires promise handling for completion callback
- Complex transformation

### 60. `$(element).slideDown()` / `slideUp()` → CSS transition

**Pattern:**
```javascript
$(element).slideDown();
```

**Transform to:**
```javascript
// CSS transition recommended
// Or Web Animations API
element.animate([
  { height: '0px' },
  { height: element.scrollHeight + 'px' }
], { duration: 400 });
```

**Safety justification:**
- CSS transitions preferred for performance
- Web Animations API available
- Complex transformation; animations should use CSS

## Form Transformations

### 61. `$(form).serialize()` → `FormData` + `URLSearchParams`

**Pattern:**
```javascript
$(form).serialize();
```

**Transform to:**
```javascript
new URLSearchParams(new FormData(form)).toString();
```

**Safety justification:**
- `FormData` is widely available (2015+)
- `URLSearchParams` is widely available (2016+)
- Direct equivalent for URL-encoded form data

### 62. `$(form).serializeArray()` → `FormData` + manual conversion

**Pattern:**
```javascript
$(form).serializeArray();
```

**Transform to:**
```javascript
Array.from(new FormData(form).entries()).map(([name, value]) => ({ name, value }));
```

**Safety justification:**
- `FormData` is widely available
- Returns array in same format as jQuery
- Safe transformation

## Implementation Priority Recommendations

### High Priority (Common patterns, safe transformations)
1. Selector transformations (#1, #2, #3)
2. Class manipulation (#4, #5, #6, #7)
3. Event handling (#23, #24, #25, #27)
4. DOM traversal (#28, #29, #31)
5. Attribute manipulation (#8, #9, #11)
6. Array utilities (#41, #42, #43, #44, #45)
7. String utilities (#49, #51)

### Medium Priority (Common but need careful handling)
8. Text/HTML content (#12, #13, #14, #15, #16)
9. DOM manipulation (#17, #18, #19, #20, #21)
10. CSS manipulation (#35, #36, #37, #38)
11. Object utilities (#50, #55, #56, #57)
12. Form handling (#61, #62)

### Low Priority (Complex, may need manual review)
13. AJAX transformations (#46, #47, #48) - complex option mapping
14. Animation transformations (#58, #59, #60) - recommend CSS instead
15. Type checking (#52, #54) - no direct equivalents
16. Event delegation (#23 with selectors) - complex pattern

## General Transformation Guidelines

1. **Always preserve comments** - jQuery code often has important context
2. **Check for chaining** - jQuery's fluent API doesn't translate directly
3. **Handle collections** - jQuery wraps everything; vanilla JS often returns single elements
4. **Verify browser support** - All transformations should be Baseline "widely available"
5. **Security considerations** - Flag HTML manipulation for XSS review
6. **Testing recommendations** - Each transformation should maintain test coverage
7. **Progressive enhancement** - Suggest CSS-first solutions where applicable

## Notes on Implementation

- Each transformation should be a separate transformer in `src/widelyAvailable/`
- Follow existing patterns: use jscodeshift, include tests, document in README
- Transformations should be conservative - only transform when confident
- Add safety checks to avoid breaking code
- Include MDN links in documentation
- Consider parameter order differences (e.g., jQuery's `$.each` vs native `forEach`)
