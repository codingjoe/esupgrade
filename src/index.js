import * as recast from 'recast';
import { parse as babelParse } from '@babel/parser';
import * as transformers from './transformers.js';

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
 * @returns {Object} - Object with { code, modified, changes }
 */
function transform(code, options = {}) {
  const baseline = options.baseline || 'widely-available';
  const enabledTransformers = BASELINE_LEVELS[baseline] || BASELINE_LEVELS['widely-available'];
  
  let ast;
  try {
    ast = recast.parse(code, {
      parser: {
        parse(source) {
          return babelParse(source, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
            tokens: true,
          });
        }
      }
    });
  } catch (error) {
    throw new Error(`Parse error: ${error.message}`);
  }
  
  let modified = false;
  const changes = [];
  
  // Create visitor methods for each node type we care about
  const visitors = {
    visitCallExpression(path) {
      if (!path.node._transformed) {
        for (const transformerName of enabledTransformers) {
          const transformer = transformers[transformerName];
          if (transformer && transformer(path)) {
            modified = true;
            changes.push({
              type: transformerName,
              line: path.node.loc ? path.node.loc.start.line : 'unknown'
            });
            path.node._transformed = true;
            break;
          }
        }
      }
      this.traverse(path);
    },
    visitVariableDeclaration(path) {
      if (!path.node._transformed) {
        for (const transformerName of enabledTransformers) {
          const transformer = transformers[transformerName];
          if (transformer && transformer(path)) {
            modified = true;
            changes.push({
              type: transformerName,
              line: path.node.loc ? path.node.loc.start.line : 'unknown'
            });
            path.node._transformed = true;
            break;
          }
        }
      }
      this.traverse(path);
    },
    visitBinaryExpression(path) {
      if (!path.node._transformed) {
        for (const transformerName of enabledTransformers) {
          const transformer = transformers[transformerName];
          if (transformer && transformer(path)) {
            modified = true;
            changes.push({
              type: transformerName,
              line: path.node.loc ? path.node.loc.start.line : 'unknown'
            });
            path.node._transformed = true;
            break;
          }
        }
      }
      this.traverse(path);
    },
    visitFunctionExpression(path) {
      if (!path.node._transformed) {
        for (const transformerName of enabledTransformers) {
          const transformer = transformers[transformerName];
          if (transformer && transformer(path)) {
            modified = true;
            changes.push({
              type: transformerName,
              line: path.node.loc ? path.node.loc.start.line : 'unknown'
            });
            path.node._transformed = true;
            break;
          }
        }
      }
      this.traverse(path);
    }
  };
  
  // Apply transformers
  recast.visit(ast, visitors);
  
  // Clean up transformation markers
  recast.visit(ast, {
    visitNode(path) {
      if (path.node._transformed) {
        delete path.node._transformed;
      }
      this.traverse(path);
    }
  });
  
  const output = recast.print(ast, {
    tabWidth: 2,
    reuseWhitespace: true,
  });
  
  return {
    code: output.code,
    modified,
    changes
  };
}

export {
  transform,
  BASELINE_LEVELS,
};
