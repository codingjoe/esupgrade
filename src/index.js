import jscodeshift from 'jscodeshift';

/**
 * Baseline levels for ECMAScript features
 * 
 * Currently both levels have the same transformers because all implemented
 * transformations use features that are widely-available according to Baseline.
 * Future versions may add transformers that are only enabled for 'newly-available'.
 */
const BASELINE_LEVELS = {
  'widely-available': [
    'varToConst',
    'concatToTemplateLiteral',
    'objectAssignToSpread',
    'arrayFromForEachToForOf',
  ],
  'newly-available': [
    'varToConst',
    'concatToTemplateLiteral',
    'objectAssignToSpread',
    'arrayFromForEachToForOf',
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
      
      if (callback && (j.ArrowFunctionExpression.check(callback) || j.FunctionExpression.check(callback))) {
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
