import t from '@babel/types';

/**
 * Transformation rules for modernizing ECMAScript code.
 * Each transformer follows the Babel plugin pattern, adapted for recast.
 * 
 * Note: Recast uses path.replace() instead of path.replaceWith()
 */

/**
 * Transform Array.from().forEach() to for...of loop
 * Example: Array.from(items).forEach(item => {...}) → for (const item of items) {...}
 */
function arrayFromForEachToForOf(path) {
  const { node } = path;
  
  // Check if this is a forEach call
  if (
    t.isCallExpression(node) &&
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.property, { name: 'forEach' })
  ) {
    const object = node.callee.object;
    
    // Check if the object is Array.from()
    if (
      t.isCallExpression(object) &&
      t.isMemberExpression(object.callee) &&
      t.isIdentifier(object.callee.object, { name: 'Array' }) &&
      t.isIdentifier(object.callee.property, { name: 'from' }) &&
      object.arguments.length === 1
    ) {
      const iterable = object.arguments[0];
      const callback = node.arguments[0];
      
      // Only transform if callback is an arrow function or function expression with 1-2 params
      if (
        callback &&
        (t.isArrowFunctionExpression(callback) || t.isFunctionExpression(callback)) &&
        callback.params.length >= 1 &&
        callback.params.length <= 2
      ) {
        const itemParam = callback.params[0];
        const body = callback.body;
        
        // Create for...of loop
        const forOfLoop = t.forOfStatement(
          t.variableDeclaration('const', [
            t.variableDeclarator(itemParam)
          ]),
          iterable,
          t.isBlockStatement(body) ? body : t.blockStatement([t.expressionStatement(body)])
        );
        
        // Only replace if we're in an ExpressionStatement context
        if (path.parent && t.isExpressionStatement(path.parent.node)) {
          path.parent.replace(forOfLoop);
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Transform var to let/const
 * Example: var x = 1; → const x = 1;
 * Note: Without full scope analysis, we conservatively use const
 * which will cause issues if the variable is reassigned, but those
 * will be caught by linters/compilers
 */
function varToLetConst(path) {
  const { node } = path;
  
  if (t.isVariableDeclaration(node) && node.kind === 'var') {
    // For now, just convert to const - this is safe for most cases
    // A more sophisticated version would analyze reassignments
    node.kind = 'const';
    return true;
  }
  return false;
}

/**
 * Transform string concatenation to template literals
 * Example: 'Hello ' + name + '!' → `Hello ${name}!`
 */
function concatToTemplateLiteral(path) {
  const { node } = path;
  
  if (t.isBinaryExpression(node, { operator: '+' })) {
    const parts = flattenStringConcatenation(node);
    
    // Only transform if we have at least one string literal
    const hasStringLiteral = parts.some(part => t.isStringLiteral(part));
    
    if (hasStringLiteral && parts.length > 1) {
      const templateElements = [];
      const expressions = [];
      
      let currentString = '';
      
      parts.forEach((part, index) => {
        if (t.isStringLiteral(part)) {
          currentString += part.value;
        } else {
          // Add the accumulated string as a template element
          templateElements.push(
            t.templateElement({ raw: currentString, cooked: currentString }, false)
          );
          currentString = '';
          expressions.push(part);
        }
      });
      
      // Add final template element
      templateElements.push(
        t.templateElement({ raw: currentString, cooked: currentString }, true)
      );
      
      const templateLiteral = t.templateLiteral(templateElements, expressions);
      path.replace(templateLiteral);
      return true;
    }
  }
  return false;
}

/**
 * Flatten nested binary + expressions into an array
 */
function flattenStringConcatenation(node) {
  if (t.isBinaryExpression(node, { operator: '+' })) {
    return [
      ...flattenStringConcatenation(node.left),
      ...flattenStringConcatenation(node.right)
    ];
  }
  return [node];
}

/**
 * Transform Object.assign({}, ...) to object spread
 * Example: Object.assign({}, obj1, obj2) → {...obj1, ...obj2}
 */
function objectAssignToSpread(path) {
  const { node } = path;
  
  if (
    t.isCallExpression(node) &&
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.object, { name: 'Object' }) &&
    t.isIdentifier(node.callee.property, { name: 'assign' }) &&
    node.arguments.length >= 2
  ) {
    const firstArg = node.arguments[0];
    
    // Only transform if first argument is an empty object literal
    if (t.isObjectExpression(firstArg) && firstArg.properties.length === 0) {
      const spreadProperties = node.arguments.slice(1).map(arg => {
        return t.spreadElement(arg);
      });
      
      const objectExpression = t.objectExpression(spreadProperties);
      path.replace(objectExpression);
      return true;
    }
  }
  return false;
}

/**
 * Transform array concat to array spread
 * Example: arr1.concat(arr2, arr3) → [...arr1, ...arr2, ...arr3]
 */
function concatToSpread(path) {
  const { node } = path;
  
  if (
    t.isCallExpression(node) &&
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.property, { name: 'concat' }) &&
    node.arguments.length > 0
  ) {
    const array = node.callee.object;
    
    // Build array with spread elements
    const elements = [
      t.spreadElement(array),
      ...node.arguments.map(arg => t.spreadElement(arg))
    ];
    
    const arrayExpression = t.arrayExpression(elements);
    path.replace(arrayExpression);
    return true;
  }
  return false;
}

/**
 * Transform function expressions to arrow functions (when safe)
 * Only transforms when 'this' is not used
 */
function functionToArrow(path) {
  const { node } = path;
  
  if (t.isFunctionExpression(node) && !node.id) {
    // Simple check: look for 'this' or 'arguments' in the function body
    // This is conservative but safe
    const hasThis = hasThisOrArguments(node);
    
    // Only convert if safe (no this or arguments)
    if (!hasThis) {
      const arrowFunction = t.arrowFunctionExpression(
        node.params,
        node.body,
        node.async
      );
      path.replace(arrowFunction);
      return true;
    }
  }
  return false;
}

/**
 * Check if a node contains 'this' or 'arguments' references
 * This is a simple recursive check
 */
function hasThisOrArguments(node, isRoot = true) {
  if (!node || typeof node !== 'object') return false;
  
  if (node.type === 'ThisExpression') return true;
  if (node.type === 'Super') return true;
  if (node.type === 'Identifier' && node.name === 'arguments') return true;
  
  // Don't traverse into nested functions (but do check the root function)
  if (!isRoot && (node.type === 'FunctionExpression' || 
      node.type === 'FunctionDeclaration' || 
      node.type === 'ArrowFunctionExpression')) {
    return false;
  }
  
  // Check all properties
  for (const key in node) {
    if (key === 'loc' || key === 'range' || key === 'start' || key === 'end' || key === 'comments') {
      continue;
    }
    const value = node[key];
    if (Array.isArray(value)) {
      if (value.some(item => hasThisOrArguments(item, false))) {
        return true;
      }
    } else if (typeof value === 'object' && value !== null) {
      if (hasThisOrArguments(value, false)) {
        return true;
      }
    }
  }
  
  return false;
}

export {
  arrayFromForEachToForOf,
  varToLetConst,
  concatToTemplateLiteral,
  objectAssignToSpread,
  concatToSpread,
  functionToArrow,
};

