import jscodeshift from 'jscodeshift';

/**
 * Baseline levels for ECMAScript features
 * 
 * - widely-available: Features available across all modern browsers
 * - newly-available: Newly standardized features (e.g., Promise.try)
 */
const BASELINE_LEVELS = {
  'widely-available': [
    'varToConst',
    'concatToTemplateLiteral',
    'objectAssignToSpread',
    'arrayFromForEachToForOf',
    'forEachToForOf',
    'forOfKeysToForIn',
  ],
  'newly-available': [
    'varToConst',
    'concatToTemplateLiteral',
    'objectAssignToSpread',
    'arrayFromForEachToForOf',
    'forEachToForOf',
    'forOfKeysToForIn',
    'promiseTry',
  ]
};

/**
 * Transform var to const
 */
function varToConst(j, root) {
  let modified = false;
  const changes = [];
  
  root.find(j.VariableDeclaration, { kind: 'var' })
    .forEach(path => {
      path.node.kind = 'const';
      modified = true;
      if (path.node.loc) {
        changes.push({
          type: 'varToConst',
          line: path.node.loc.start.line
        });
      }
    });
  
  return { modified, changes };
}

/**
 * Transform string concatenation to template literals
 */
function concatToTemplateLiteral(j, root) {
  let modified = false;
  const changes = [];
  
  root.find(j.BinaryExpression, { operator: '+' })
    .filter(path => {
      // Only transform if at least one operand is a string literal
      const hasStringLiteral = (node) => {
        if (j.StringLiteral.check(node) || (j.Literal.check(node) && typeof node.value === 'string')) {
          return true;
        }
        if (j.BinaryExpression.check(node) && node.operator === '+') {
          return hasStringLiteral(node.left) || hasStringLiteral(node.right);
        }
        return false;
      };
      return hasStringLiteral(path.node);
    })
    .forEach(path => {
      const parts = [];
      const expressions = [];
      
      const flatten = (node) => {
        if (j.BinaryExpression.check(node) && node.operator === '+') {
          flatten(node.left);
          flatten(node.right);
        } else if (j.StringLiteral.check(node) || (j.Literal.check(node) && typeof node.value === 'string')) {
          // Add string literal value
          if (parts.length === 0 || expressions.length >= parts.length) {
            parts.push(node.value);
          } else {
            parts[parts.length - 1] += node.value;
          }
        } else {
          // Add expression
          if (parts.length === 0) {
            parts.push('');
          }
          expressions.push(node);
        }
      };
      
      flatten(path.node);
      
      // Ensure we have the right number of quasis (one more than expressions)
      while (parts.length <= expressions.length) {
        parts.push('');
      }
      
      // Create template literal
      const quasis = parts.map((part, i) => 
        j.templateElement({ raw: part, cooked: part }, i === parts.length - 1)
      );
      
      const templateLiteral = j.templateLiteral(quasis, expressions);
      j(path).replaceWith(templateLiteral);
      
      modified = true;
      if (path.node.loc) {
        changes.push({
          type: 'concatToTemplateLiteral',
          line: path.node.loc.start.line
        });
      }
    });
  
  return { modified, changes };
}

/**
 * Transform Object.assign({}, ...) to object spread
 */
function objectAssignToSpread(j, root) {
  let modified = false;
  const changes = [];
  
  root.find(j.CallExpression, {
    callee: {
      type: 'MemberExpression',
      object: { name: 'Object' },
      property: { name: 'assign' }
    }
  })
    .filter(path => {
      // First argument must be empty object literal
      const firstArg = path.node.arguments[0];
      return j.ObjectExpression.check(firstArg) && firstArg.properties.length === 0;
    })
    .forEach(path => {
      const spreadProperties = path.node.arguments.slice(1).map(arg =>
        j.spreadElement(arg)
      );
      
      const objectExpression = j.objectExpression(spreadProperties);
      j(path).replaceWith(objectExpression);
      
      modified = true;
      if (path.node.loc) {
        changes.push({
          type: 'objectAssignToSpread',
          line: path.node.loc.start.line
        });
      }
    });
  
  return { modified, changes };
}

/**
 * Transform Array.from().forEach() to for...of
 */
function arrayFromForEachToForOf(j, root) {
  let modified = false;
  const changes = [];
  
  root.find(j.CallExpression)
    .filter(path => {
      const node = path.node;
      // Check if this is a forEach call
      if (!j.MemberExpression.check(node.callee) || 
          !j.Identifier.check(node.callee.property) ||
          node.callee.property.name !== 'forEach') {
        return false;
      }
      
      // Check if the object is Array.from()
      const object = node.callee.object;
      if (!j.CallExpression.check(object) ||
          !j.MemberExpression.check(object.callee) ||
          !j.Identifier.check(object.callee.object) ||
          object.callee.object.name !== 'Array' ||
          !j.Identifier.check(object.callee.property) ||
          object.callee.property.name !== 'from') {
        return false;
      }
      
      return true;
    })
    .forEach(path => {
      const node = path.node;
      const iterable = node.callee.object.arguments[0];
      const callback = node.arguments[0];
      
      // Only transform if callback is function with 1-2 params
      if (callback && 
          (j.ArrowFunctionExpression.check(callback) || j.FunctionExpression.check(callback)) &&
          callback.params.length >= 1 && callback.params.length <= 2) {
        const itemParam = callback.params[0];
        const body = callback.body;
        
        // Create for...of loop
        const forOfLoop = j.forOfStatement(
          j.variableDeclaration('const', [j.variableDeclarator(itemParam)]),
          iterable,
          j.BlockStatement.check(body) ? body : j.blockStatement([j.expressionStatement(body)])
        );
        
        // Replace the expression statement containing the forEach call
        const statement = path.parent;
        if (j.ExpressionStatement.check(statement.node)) {
          j(statement).replaceWith(forOfLoop);
          
          modified = true;
          if (node.loc) {
            changes.push({
              type: 'arrayFromForEachToForOf',
              line: node.loc.start.line
            });
          }
        }
      }
    });
  
  return { modified, changes };
}

/**
 * Transform all .forEach() calls to for...of loops
 */
function forEachToForOf(j, root) {
  let modified = false;
  const changes = [];
  
  root.find(j.CallExpression)
    .filter(path => {
      const node = path.node;
      // Check if this is a forEach call
      if (!j.MemberExpression.check(node.callee) || 
          !j.Identifier.check(node.callee.property) ||
          node.callee.property.name !== 'forEach') {
        return false;
      }
      
      // Skip Array.from().forEach() as it's handled by arrayFromForEachToForOf
      const object = node.callee.object;
      if (j.CallExpression.check(object) &&
          j.MemberExpression.check(object.callee) &&
          j.Identifier.check(object.callee.object) &&
          object.callee.object.name === 'Array' &&
          j.Identifier.check(object.callee.property) &&
          object.callee.property.name === 'from') {
        return false;
      }
      
      return true;
    })
    .forEach(path => {
      const node = path.node;
      const iterable = node.callee.object;
      const callback = node.arguments[0];
      
      // Only transform if callback is function with 1-2 params
      if (callback && 
          (j.ArrowFunctionExpression.check(callback) || j.FunctionExpression.check(callback)) &&
          callback.params.length >= 1 && callback.params.length <= 2) {
        const itemParam = callback.params[0];
        const body = callback.body;
        
        // Create for...of loop
        const forOfLoop = j.forOfStatement(
          j.variableDeclaration('const', [j.variableDeclarator(itemParam)]),
          iterable,
          j.BlockStatement.check(body) ? body : j.blockStatement([j.expressionStatement(body)])
        );
        
        // Replace the expression statement containing the forEach call
        const statement = path.parent;
        if (j.ExpressionStatement.check(statement.node)) {
          j(statement).replaceWith(forOfLoop);
          
          modified = true;
          if (node.loc) {
            changes.push({
              type: 'forEachToForOf',
              line: node.loc.start.line
            });
          }
        }
      }
    });
  
  return { modified, changes };
}

/**
 * Transform for...of Object.keys() loops to for...in
 */
function forOfKeysToForIn(j, root) {
  let modified = false;
  const changes = [];
  
  root.find(j.ForOfStatement)
    .filter(path => {
      const node = path.node;
      const right = node.right;
      
      // Check if iterating over Object.keys() call
      if (j.CallExpression.check(right) &&
          j.MemberExpression.check(right.callee) &&
          j.Identifier.check(right.callee.object) &&
          right.callee.object.name === 'Object' &&
          j.Identifier.check(right.callee.property) &&
          right.callee.property.name === 'keys' &&
          right.arguments.length === 1) {
        return true;
      }
      
      return false;
    })
    .forEach(path => {
      const node = path.node;
      const left = node.left;
      const objectArg = node.right.arguments[0];
      const body = node.body;
      
      // Create for...in loop
      const forInLoop = j.forInStatement(
        left,
        objectArg,
        body
      );
      
      j(path).replaceWith(forInLoop);
      
      modified = true;
      if (node.loc) {
        changes.push({
          type: 'forOfKeysToForIn',
          line: node.loc.start.line
        });
      }
    });
  
  return { modified, changes };
}

/**
 * Transform new Promise((resolve, reject) => { resolve(fn()) }) to Promise.try(fn)
 */
function promiseTry(j, root) {
  let modified = false;
  const changes = [];
  
  root.find(j.NewExpression)
    .filter(path => {
      const node = path.node;
      // Check if this is new Promise(...)
      if (!j.Identifier.check(node.callee) || node.callee.name !== 'Promise') {
        return false;
      }
      
      // Check if there's one argument that's a function
      if (node.arguments.length !== 1) {
        return false;
      }
      
      const executor = node.arguments[0];
      if (!j.ArrowFunctionExpression.check(executor) && !j.FunctionExpression.check(executor)) {
        return false;
      }
      
      // Check if function has 1-2 params (resolve, reject)
      if (executor.params.length < 1 || executor.params.length > 2) {
        return false;
      }
      
      // Check if body is a block with single resolve() call or expression body
      const body = executor.body;
      
      // For arrow functions with expression body: (resolve) => someFunc()
      if (!j.BlockStatement.check(body)) {
        return true;
      }
      
      // For functions with block body containing single resolve(expr) call
      if (body.body.length === 1 && j.ExpressionStatement.check(body.body[0])) {
        const expr = body.body[0].expression;
        if (j.CallExpression.check(expr) && 
            j.Identifier.check(expr.callee) &&
            expr.callee.name === executor.params[0].name) {
          return true;
        }
      }
      
      return false;
    })
    .forEach(path => {
      const node = path.node;
      const executor = node.arguments[0];
      const body = executor.body;
      
      let expression;
      
      // Extract the expression
      if (!j.BlockStatement.check(body)) {
        // Arrow function with expression body: (resolve) => expr
        expression = body;
      } else if (body.body.length === 1 && j.ExpressionStatement.check(body.body[0])) {
        // Block with resolve(expr) call
        const callExpr = body.body[0].expression;
        if (j.CallExpression.check(callExpr) && callExpr.arguments.length > 0) {
          expression = callExpr.arguments[0];
        }
      }
      
      if (expression) {
        // Wrap expression in arrow function for Promise.try
        const tryArg = j.arrowFunctionExpression([], expression);
        
        // Create Promise.try(fn)
        const promiseTryCall = j.callExpression(
          j.memberExpression(
            j.identifier('Promise'),
            j.identifier('try')
          ),
          [tryArg]
        );
        
        j(path).replaceWith(promiseTryCall);
        
        modified = true;
        if (node.loc) {
          changes.push({
            type: 'promiseTry',
            line: node.loc.start.line
          });
        }
      }
    });
  
  return { modified, changes };
}

/**
 * Transform JavaScript code using the specified transformers
 * @param {string} code - The source code to transform
 * @param {Object} options - Transformation options
 * @param {string} options.baseline - Baseline level ('widely-available' or 'newly-available')
 * @returns {Object} - Object with { code, modified, changes }
 */
function transform(code, options = {}) {
  const baseline = options.baseline || 'widely-available';
  const enabledTransformers = BASELINE_LEVELS[baseline] || BASELINE_LEVELS['widely-available'];
  
  const j = jscodeshift.withParser('tsx');
  const root = j(code);
  
  let modified = false;
  const allChanges = [];
  
  // Apply transformers
  const transformerFunctions = {
    varToConst,
    concatToTemplateLiteral,
    objectAssignToSpread,
    arrayFromForEachToForOf,
    forEachToForOf,
    forOfKeysToForIn,
    promiseTry,
  };
  
  for (const transformerName of enabledTransformers) {
    const transformer = transformerFunctions[transformerName];
    if (transformer) {
      const result = transformer(j, root);
      if (result.modified) {
        modified = true;
        allChanges.push(...result.changes);
      }
    }
  }
  
  return {
    code: root.toSource(),
    modified,
    changes: allChanges
  };
}

export {
  transform,
  BASELINE_LEVELS,
};
