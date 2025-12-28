#!/usr/bin/env node

import fs from "fs"
import path from "path"
import { Command } from "commander"
import { transform } from "../src/index.js"

/**
 * CLI tool for esupgrade
 */

const program = new Command()

program
  .name("esupgrade")
  .description("Auto-upgrade your JavaScript syntax")
  .version("0.1.0")
  .argument("[files...]", "Files or directories to process")
  .option(
    "--baseline <level>",
    "Set baseline level: widely-available (default) or newly-available",
    "widely-available",
  )
  .option("--check", "Report which files need upgrading and exit with code 1 if any do")
  .option(
    "--write",
    "Write changes to files (default: true unless only --check is specified)",
  )
  .action((files, options) => {
    if (files.length === 0) {
      console.error("Error: No files specified")
      program.help()
    }

    // Validate baseline option
    if (!["widely-available", "newly-available"].includes(options.baseline)) {
      console.error(`Error: Invalid baseline level '${options.baseline}'`)
      console.error(`Must be 'widely-available' or 'newly-available'`)
      process.exit(1)
    }

    // Handle check/write options - they are not mutually exclusive
    // Default: write is true unless ONLY --check is specified (no --write)
    const shouldWrite = options.write !== undefined ? options.write : !options.check
    const shouldCheck = options.check || false

    const processingOptions = {
      baseline: options.baseline,
      write: shouldWrite,
      check: shouldCheck,
    }

    processFiles(files, processingOptions)
  })

function findFiles(patterns) {
  const files = []

  for (const pattern of patterns) {
    try {
      const stats = fs.statSync(pattern)

      if (stats.isFile()) {
        files.push(pattern)
      } else if (stats.isDirectory()) {
        // Recursively find .js, .jsx, .ts, .tsx files
        const dirFiles = walkDirectory(pattern)
        files.push(...dirFiles)
      }
    } catch (error) {
      console.error(`Error: Cannot access '${pattern}': ${error.message}`)
      process.exit(1)
    }
  }

  return files
}

function walkDirectory(dir) {
  const files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue
      }
      files.push(...walkDirectory(fullPath))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
        files.push(fullPath)
      }
    }
  }

  return files
}

function processFile(filePath, options) {
  try {
    const code = fs.readFileSync(filePath, "utf8")
    const result = transform(code, { baseline: options.baseline })

    if (result.modified) {
      if (options.check) {
        console.log(`✗ ${filePath}`)
        if (result.changes && result.changes.length > 0) {
          // Group changes by type
          const changesByType = {}

          for (const change of result.changes) {
            if (!changesByType[change.type]) {
              changesByType[change.type] = []
            }
            changesByType[change.type].push(change.line)
          }

          for (const [type, lines] of Object.entries(changesByType)) {
            const uniqueLines = [...new Set(lines)].sort((a, b) => a - b)
            const displayName = type
              .replace(/([A-Z])/g, " $1")
              .trim()
              .toLowerCase()
            console.log(
              `  - ${displayName} (line${uniqueLines.length > 1 ? "s" : ""}: ${uniqueLines.join(", ")})`,
            )
          }
        }
      }

      if (options.write) {
        fs.writeFileSync(filePath, result.code, "utf8")
        if (!options.check) {
          console.log(`✓ Upgraded: ${filePath}`)
        } else {
          console.log(`  ✓ Changes written to file`)
        }
      }

      return true
    } else {
      if (!options.check) {
        console.log(`  No changes: ${filePath}`)
      }
      return false
    }
  } catch (error) {
    console.error(`Error processing ${filePath}: ${error.message}`)
    return false
  }
}

function processFiles(patterns, options) {
  let files = []
  try {
    files = findFiles(patterns)
  } catch (error) {
    console.error(`Error finding files: ${error.message}`)
    process.exit(1)
  }

  if (files.length === 0) {
    console.log("No JavaScript files found")
    process.exit(0)
  }

  console.log(`Processing ${files.length} file(s) with baseline: ${options.baseline}\n`)

  let modifiedCount = 0
  for (const file of files) {
    if (processFile(file, options)) {
      modifiedCount++
    }
  }

  // Summary
  console.log("")
  if (modifiedCount > 0) {
    if (options.write && options.check) {
      console.log(`Summary: ${modifiedCount} file(s) upgraded`)
    } else if (options.write) {
      console.log(`Summary: ${modifiedCount} file(s) upgraded`)
    } else {
      console.log(`Summary: ${modifiedCount} file(s) need upgrading`)
    }
  } else {
    console.log("Summary: All files are already modern")
  }

  // Exit with code 1 if --check specified and there were changes
  if (options.check && modifiedCount > 0) {
    process.exit(1)
  }
}

program.parse()
