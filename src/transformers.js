const t = require('@babel/types');

/**
 * Transformation rules for modernizing ECMAScript code.
 * Each transformer follows the Babel plugin pattern.
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
        if (path.parentPath && t.isExpressionStatement(path.parent)) {
          path.parentPath.replaceWith(forOfLoop);
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Transform var to let/const based on reassignment analysis
 * Example: var x = 1; → const x = 1; (if not reassigned)
 */
function varToLetConst(path) {
  const { node, scope } = path;
  
  if (t.isVariableDeclaration(node) && node.kind === 'var') {
    // Check each declarator
    const allCanBeConst = node.declarations.every(declarator => {
      if (!t.isIdentifier(declarator.id)) return false;
      
      const binding = scope.getBinding(declarator.id.name);
      if (!binding) return false;
      
      // Check if the variable is never reassigned
      return binding.constant;
    });
    
    // Use const if never reassigned, otherwise let
    node.kind = allCanBeConst ? 'const' : 'let';
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
      path.replaceWith(templateLiteral);
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
      path.replaceWith(objectExpression);
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
    path.replaceWith(arrayExpression);
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
    // Check if function uses 'this', 'arguments', or 'super'
    let usesThis = false;
    let usesArguments = false;
    
    path.traverse({
      ThisExpression() {
        usesThis = true;
      },
      Identifier(innerPath) {
        // Check if 'arguments' refers to the function's arguments object
        // Skip if it's a local binding (parameter or variable)
        if (innerPath.node.name === 'arguments' && innerPath.isReferencedIdentifier()) {
          const binding = innerPath.scope.getBinding('arguments');
          // If there's no binding, it refers to the function's arguments object
          if (!binding) {
            usesArguments = true;
          }
        }
      },
      Super() {
        usesThis = true; // super also prevents arrow function conversion
      },
      // Stop traversing into nested functions
      FunctionExpression(innerPath) {
        if (innerPath.node !== node) {
          innerPath.skip();
        }
      },
      FunctionDeclaration(innerPath) {
        innerPath.skip();
      },
      ArrowFunctionExpression(innerPath) {
        innerPath.skip();
      }
    });
    
    // Only convert if safe (no this, arguments, or super)
    if (!usesThis && !usesArguments) {
      const arrowFunction = t.arrowFunctionExpression(
        node.params,
        node.body,
        node.async
      );
      path.replaceWith(arrowFunction);
      return true;
    }
  }
  return false;
}

module.exports = {
  arrayFromForEachToForOf,
  varToLetConst,
  concatToTemplateLiteral,
  objectAssignToSpread,
  concatToSpread,
  functionToArrow,
};
