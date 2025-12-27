import { parse } from '@babel/parser';
import traverseDefault from '@babel/traverse';
import generateDefault from '@babel/generator';
import * as transformers from './transformers.js';

// Handle default exports from Babel packages
const traverse = traverseDefault.default || traverseDefault;
const generate = generateDefault.default || generateDefault;

/**
 * Baseline levels for ECMAScript features
 * 
 * Currently both levels have the same transformers because all implemented
 * transformations use features that are widely-available according to Baseline.
 * Future versions may add transformers that are only enabled for 'newly-available'.
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
    ast = parse(code, {
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

export {
  transform,
  BASELINE_LEVELS,
};
