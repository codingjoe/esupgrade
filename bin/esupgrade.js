#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { transform } from '../src/index.js';

/**
 * CLI tool for esupgrade
 */

const program = new Command();

program
  .name('esupgrade')
  .description('Auto-upgrade your JavaScript syntax')
  .version('0.1.0')
  .argument('[files...]', 'Files or directories to process')
  .option('--baseline <level>', 'Set baseline level: widely-available (default) or newly-available', 'widely-available')
  .option('--check', 'Check if files need upgrading without modifying them (exit 1 if changes needed)')
  .option('--write', 'Write changes to files (default)')
  .action((files, options) => {
    if (files.length === 0) {
      console.error('Error: No files specified');
      program.help();
    }

    // Validate baseline option
    if (!['widely-available', 'newly-available'].includes(options.baseline)) {
      console.error(`Error: Invalid baseline level '${options.baseline}'`);
      console.error(`Must be 'widely-available' or 'newly-available'`);
      process.exit(1);
    }

    // Handle check/write options
    // Default is to write unless --check is specified
    const shouldWrite = !options.check;
    const shouldCheck = options.check;

    const processingOptions = {
      baseline: options.baseline,
      write: shouldWrite,
      check: shouldCheck
    };

    processFiles(files, processingOptions);
  });

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

function processFiles(patterns, options) {
  let files = [];
  try {
    files = findFiles(patterns);
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

program.parse();
