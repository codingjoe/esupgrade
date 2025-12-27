#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { transform } = require('../src/index');

/**
 * CLI tool for esupgrade
 */

function printHelp() {
  console.log(`
esupgrade - Auto-upgrade your JavaScript syntax

Usage:
  esupgrade [options] <files...>

Options:
  --baseline <level>    Set baseline level: 'widely-available' (default) or 'newly-available'
  --check               Check if files need upgrading without modifying them (exit 1 if changes needed)
  --write               Write changes to files (default)
  --help                Show this help message

Examples:
  esupgrade src/**/*.js
  esupgrade --baseline newly-available src/
  esupgrade --check src/app.js
  `);
}

function parseArgs(args) {
  const options = {
    baseline: 'widely-available',
    check: false,
    write: true,
    files: [],
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--baseline') {
      options.baseline = args[++i];
      if (!['widely-available', 'newly-available'].includes(options.baseline)) {
        console.error(`Error: Invalid baseline level '${options.baseline}'`);
        console.error(`Must be 'widely-available' or 'newly-available'`);
        process.exit(1);
      }
    } else if (arg === '--check') {
      options.check = true;
      options.write = false;
    } else if (arg === '--write') {
      options.write = true;
      options.check = false;
    } else if (!arg.startsWith('--')) {
      options.files.push(arg);
    }
  }
  
  return options;
}

function findFiles(patterns) {
  const files = [];
  
  for (const pattern of patterns) {
    try {
      const stats = fs.statSync(pattern);
      
      if (stats.isFile()) {
        files.push(pattern);
      } else if (stats.isDirectory()) {
        // Recursively find .js, .jsx, .ts, .tsx files
        const dirFiles = walkDirectory(pattern);
        files.push(...dirFiles);
      }
    } catch (error) {
      console.error(`Error: Cannot access '${pattern}': ${error.message}`);
      process.exit(1);
    }
  }
  
  return files;
}

function walkDirectory(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      files.push(...walkDirectory(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

function processFile(filePath, options) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const result = transform(code, { baseline: options.baseline });
    
    if (result.modified) {
      if (options.write) {
        fs.writeFileSync(filePath, result.code, 'utf8');
        console.log(`✓ Upgraded: ${filePath}`);
      } else {
        console.log(`✗ Needs upgrade: ${filePath}`);
      }
      return true;
    } else {
      if (!options.check) {
        console.log(`  No changes: ${filePath}`);
      }
      return false;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printHelp();
    process.exit(1);
  }
  
  const options = parseArgs(args);
  
  if (options.files.length === 0) {
    console.error('Error: No files specified');
    printHelp();
    process.exit(1);
  }
  
  let files = [];
  try {
    files = findFiles(options.files);
  } catch (error) {
    console.error(`Error finding files: ${error.message}`);
    process.exit(1);
  }
  
  if (files.length === 0) {
    console.log('No JavaScript files found');
    process.exit(0);
  }
  
  console.log(`Processing ${files.length} file(s) with baseline: ${options.baseline}\n`);
  
  let modifiedCount = 0;
  for (const file of files) {
    if (processFile(file, options)) {
      modifiedCount++;
    }
  }
  
  console.log(`\nSummary: ${modifiedCount} file(s) ${options.write ? 'upgraded' : 'need upgrading'}`);
  
  if (options.check && modifiedCount > 0) {
    process.exit(1);
  }
}

main();
