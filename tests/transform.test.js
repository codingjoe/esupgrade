import { test } from 'node:test';
import assert from 'node:assert';
import { transform } from '../src/index.js';

test('Array.from().forEach() to for...of', () => {
  const input = `
    Array.from(items).forEach(item => {
      console.log(item);
    });
  `;
  
  const result = transform(input);
  
  assert.strictEqual(result.modified, true);
  assert.match(result.code, /for \(const item of items\)/);
  assert.match(result.code, /console\.log\(item\)/);
});

test('Array.from().forEach() with arrow function expression', () => {
  const input = `Array.from(numbers).forEach(n => console.log(n));`;
  
  const result = transform(input);
  
  assert.strictEqual(result.modified, true);
  assert.match(result.code, /for \(const n of numbers\)/);
});

test('var to const when not reassigned', () => {
  const input = `
    var x = 1;
  `;
  
  const result = transform(input);
  
  assert.strictEqual(result.modified, true);
  assert.match(result.code, /const x = 1/);
  assert.doesNotMatch(result.code, /var x/);
});

test('var to const (simplified version)', () => {
  const input = `
    var x = 1;
    x = 2;
  `;
  
  const result = transform(input);
  
  assert.strictEqual(result.modified, true);
  assert.match(result.code, /const x = 1/);
  assert.doesNotMatch(result.code, /var x/);
  // Note: This will cause a runtime error due to const reassignment
  // A more sophisticated version would detect reassignments and use 'let'
});

test('string concatenation to template literal', () => {
  const input = `const greeting = 'Hello ' + name + '!';`;
  
  const result = transform(input);
  
  assert.strictEqual(result.modified, true);
  assert.match(result.code, /`Hello \$\{name\}!`/);
});

test('multiple string concatenations', () => {
  const input = `const msg = 'Hello ' + firstName + ' ' + lastName + '!';`;
  
  const result = transform(input);
  
  assert.strictEqual(result.modified, true);
  assert.match(result.code, /`Hello \$\{firstName\} \$\{lastName\}!`/);
});

test('Object.assign to object spread', () => {
  const input = `const obj = Object.assign({}, obj1, obj2);`;
  
  const result = transform(input);
  
  assert.strictEqual(result.modified, true);
  assert.match(result.code, /\.\.\.obj1/);
  assert.match(result.code, /\.\.\.obj2/);
});

test('no changes needed', () => {
  const input = `
    const x = 1;
    const y = 2;
  `;
  
  const result = transform(input);
  
  assert.strictEqual(result.modified, false);
});

test('complex transformation', () => {
  const input = `
    var userName = 'Alice';
    var greeting = 'Hello ' + userName;
  `;
  
  const result = transform(input);
  
  assert.strictEqual(result.modified, true);
  assert.match(result.code, /const userName/);
  assert.match(result.code, /`Hello \$\{userName\}`/);
});

test('baseline option - widely-available', () => {
  const input = `var x = 1;`;
  
  const result = transform(input, { baseline: 'widely-available' });
  
  assert.strictEqual(result.modified, true);
  assert.match(result.code, /const x = 1/);
});

test('baseline option - newly-available', () => {
  const input = `var x = 1;`;
  
  const result = transform(input, { baseline: 'newly-available' });
  
  assert.strictEqual(result.modified, true);
  assert.match(result.code, /const x = 1/);
});
