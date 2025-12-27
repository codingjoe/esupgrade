const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const transformers = require('./transformers');

/**
 * Baseline levels for ECMAScript features
 */
const BASELINE_LEVELS = {
  'widely-available': [
    'varToLetConst',
    'concatToTemplateLiteral',
    'objectAssignToSpread',
    'concatToSpread',
    'functionToArrow',
    'arrayFromForEachToForOf',
  ],
  'newly-available': [
    'varToLetConst',
    'concatToTemplateLiteral',
    'objectAssignToSpread',
    'concatToSpread',
    'functionToArrow',
    'arrayFromForEachToForOf',
  ]
};

/**
 * Transform JavaScript code using the specified transformers
 * @param {string} code - The source code to transform
 * @param {Object} options - Transformation options
 * @param {string} options.baseline - Baseline level ('widely-available' or 'newly-available')
 * @returns {Object} - Object with { code, modified }
 */
function transform(code, options = {}) {
  const baseline = options.baseline || 'widely-available';
  const enabledTransformers = BASELINE_LEVELS[baseline] || BASELINE_LEVELS['widely-available'];
  
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (error) {
    throw new Error(`Parse error: ${error.message}`);
  }
  
  let modified = false;
  
  // Apply transformers
  traverse(ast, {
    enter(path) {
      // Skip if already processed
      if (path.node._transformed) {
        return;
      }
      
      // Try each enabled transformer
      for (const transformerName of enabledTransformers) {
        const transformer = transformers[transformerName];
        if (transformer && transformer(path)) {
          modified = true;
          // Mark as transformed to avoid re-processing
          if (path.node) {
            path.node._transformed = true;
          }
          break;
        }
      }
    }
  });
  
  // Clean up transformation markers
  traverse(ast, {
    enter(path) {
      if (path.node._transformed) {
        delete path.node._transformed;
      }
    }
  });
  
  const output = generate(ast, {
    retainLines: false,
    compact: false,
    concise: false,
  }, code);
  
  return {
    code: output.code,
    modified
  };
}

module.exports = {
  transform,
  BASELINE_LEVELS,
};
