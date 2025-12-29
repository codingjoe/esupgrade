#!/usr/bin/env node

import fs from "fs"
import path from "path"
import { Command, Option } from "commander"
import { transform } from "../src/index.js"

/**
 * CLI tool for esupgrade
 */

const program = new Command()

program
  .name("esupgrade")
  .description("Auto-upgrade your JavaScript syntax")
  .argument("[files...]", "Files or directories to process")
  .addOption(
    new Option("--baseline <level>", "Set baseline level for transformations")
      .choices(["widely-available", "newly-available"])
      .default("widely-available"),
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
    const result = transform(code, options.baseline)

    if (result.modified) {
      if (options.check) {
        // Group changes by type for summary
        const changesByType = {}
        if (result.changes && result.changes.length > 0) {
          for (const change of result.changes) {
            if (!changesByType[change.type]) {
              changesByType[change.type] = 0
            }
            changesByType[change.type]++
          }
        }

        const transformations = Object.keys(changesByType)
          .map((type) => {
            const displayName = type
              .replace(/([A-Z])/g, " $1")
              .trim()
              .toLowerCase()
            return displayName
          })
          .join(", ")

        console.log(`✗ ${filePath}`)
        if (transformations) {
          console.log(`  ${transformations}`)
        }
      }

      if (options.write) {
        fs.writeFileSync(filePath, result.code, "utf8")
        if (!options.check) {
          console.log(`✓ ${filePath}`)
        } else {
          console.log(`  ✓ written`)
        }
      }

      return { modified: true, changes: result.changes }
    } else {
      if (!options.check) {
        console.log(`  ${filePath}`)
      }
      return { modified: false, changes: [] }
    }
  } catch (error) {
    console.error(`✗ Error: ${filePath}: ${error.message}`)
    return { modified: false, changes: [] }
  }
}

function processFiles(patterns, options) {
  const files = findFiles(patterns)

  if (files.length === 0) {
    console.log("No JavaScript files found")
    process.exit(0)
  }

  let modifiedCount = 0
  const allChanges = []

  for (const file of files) {
    const result = processFile(file, options)
    if (result.modified) {
      modifiedCount++
      allChanges.push(...result.changes)
    }
  }

  // Summary
  if (options.check) {
    console.log("")
    if (modifiedCount > 0) {
      // Count unique transformation types
      const transformTypes = new Set(allChanges.map((c) => c.type))
      const typeCount = transformTypes.size
      const totalChanges = allChanges.length

      console.log(
        `${modifiedCount} file${modifiedCount !== 1 ? "s" : ""} need${modifiedCount === 1 ? "s" : ""} upgrading (${totalChanges} change${totalChanges !== 1 ? "s" : ""}, ${typeCount} type${typeCount !== 1 ? "s" : ""})`,
      )
      if (options.write) {
        console.log("Changes have been written")
      }
    } else {
      console.log("All files are up to date")
    }
  } else {
    console.log("")
    if (modifiedCount > 0) {
      console.log(`✓ ${modifiedCount} file${modifiedCount !== 1 ? "s" : ""} upgraded`)
    } else {
      console.log("All files are up to date")
    }
  }

  // Exit with code 1 if --check specified and there were changes
  if (options.check && modifiedCount > 0) {
    process.exit(1)
  }
}

program.parse()
