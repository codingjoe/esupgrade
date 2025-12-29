#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import { Worker } from "worker_threads"
import { once } from "events"
import { Command, Option } from "commander"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * CLI tool for esupgrade
 */

/**
 * Handles worker thread execution for file processing
 */
class WorkerRunner {
  constructor(workerPath) {
    this.workerPath = workerPath
  }

  /**
   * Run a worker thread to process a file
   */
  async run(filePath, baseline) {
    const worker = new Worker(this.workerPath, {
      workerData: { filePath, baseline },
    })

    const [message] = await once(worker, "message")
    return message
  }
}

/**
 * Processes individual files and handles output
 */
class FileProcessor {
  constructor(workerRunner) {
    this.workerRunner = workerRunner
  }

  /**
   * Process a file using a worker thread
   */
  async processFile(filePath, options) {
    try {
      const workerResult = await this.workerRunner.run(filePath, options.baseline)

      if (!workerResult.success) {
        console.error(`✗ Error: ${filePath}: ${workerResult.error}`)
        return { modified: false, changes: [], error: true }
      }

      const result = workerResult.result

      if (result.modified) {
        if (options.check) {
          this.#reportChanges(filePath, result.changes)
        }

        if (options.write) {
          fs.writeFileSync(filePath, result.code, "utf8")
          if (!options.check) {
            console.log(`✓ ${filePath}`)
          } else {
            console.log(`  ✓ written`)
          }
        }

        return { modified: true, changes: result.changes, error: false }
      } else {
        if (!options.check) {
          console.log(`  ${filePath}`)
        }
        return { modified: false, changes: [], error: false }
      }
    } catch (error) {
      console.error(`✗ Error: ${filePath}: ${error.message}`)
      return { modified: false, changes: [], error: true }
    }
  }

  #reportChanges(filePath, changes) {
    const changesByType = {}
    if (changes && changes.length > 0) {
      for (const change of changes) {
        if (!changesByType[change.type]) {
          changesByType[change.type] = 0
        }
        changesByType[change.type]++
      }
    }

    const transformations = Object.keys(changesByType)
      .map((type) =>
        type
          .replace(/([A-Z])/g, " $1")
          .trim()
          .toLowerCase(),
      )
      .join(", ")

    console.log(`✗ ${filePath}`)
    if (transformations) {
      console.log(`  ${transformations}`)
    }
  }
}

/**
 * Manages a pool of workers for parallel file processing
 */
class WorkerPool {
  constructor(fileProcessor, maxWorkers = os.cpus().length) {
    this.fileProcessor = fileProcessor
    this.maxWorkers = maxWorkers
  }

  /**
   * Process files with a worker pool for better CPU utilization
   */
  async processFiles(files, options) {
    const results = new Array(files.length)
    let fileIndex = 0

    // Worker pool pattern - each worker processes files until queue is empty
    const processNext = async () => {
      while (fileIndex < files.length) {
        const currentIndex = fileIndex++
        const file = files[currentIndex]
        results[currentIndex] = await this.fileProcessor.processFile(file, options)
      }
    }

    // Start worker pool and wait for all to complete
    const workerCount = Math.min(this.maxWorkers, files.length)
    const workers = Array.from({ length: workerCount }, () => processNext())
    await Promise.all(workers)

    return results
  }
}

/**
 * Finds JavaScript files from patterns
 */
class FileFinder {
  static IGNORED_DIRS = ["node_modules", ".git"]
  static JS_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]

  constructor() {}

  /**
   * Find files matching patterns
   */
  *find(patterns) {
    for (const pattern of patterns) {
      try {
        const stats = fs.statSync(pattern)

        if (stats.isFile()) {
          yield pattern
        } else if (stats.isDirectory()) {
          yield* this._walkDirectory(pattern)
        }
      } catch (error) {
        console.error(`Error: Cannot access '${pattern}': ${error.message}`)
        process.exit(1)
      }
    }
  }

  *_walkDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (FileFinder.IGNORED_DIRS.includes(entry.name)) {
          continue
        }
        yield* this._walkDirectory(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (FileFinder.JS_EXTENSIONS.includes(ext)) {
          yield fullPath
        }
      }
    }
  }
}

/**
 * Orchestrates the CLI application
 */
class CLIRunner {
  constructor(workerPath) {
    const workerRunner = new WorkerRunner(workerPath)
    const fileProcessor = new FileProcessor(workerRunner)
    this.workerPool = new WorkerPool(fileProcessor)
    this.fileFinder = new FileFinder()
  }

  /**
   * Process files and report results
   */
  async run(patterns, options) {
    const files = [...this.fileFinder.find(patterns)]

    if (files.length === 0) {
      console.log("No JavaScript files found")
      process.exit(0)
    }

    const results = await this.workerPool.processFiles(files, options)
    this.#reportSummary(results, options)
  }

  #reportSummary(results, options) {
    let modifiedCount = 0
    const allChanges = results.flatMap((result) =>
      result.modified ? (modifiedCount++, result.changes) : [],
    )
    
    const errorCount = results.filter((result) => result.error).length

    console.log("")

    if (options.check) {
      if (modifiedCount > 0) {
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
      if (modifiedCount > 0) {
        console.log(`✓ ${modifiedCount} file${modifiedCount !== 1 ? "s" : ""} upgraded`)
      } else {
        console.log("All files are up to date")
      }
    }

    // Errors take precedence over --check flag.
    // Exit with error code if any file processing errors occurred.
    if (errorCount > 0) {
      process.exit(1)
    }
    
    if (options.check && modifiedCount > 0) {
      process.exit(1)
    }
  }
}

// Initialize CLI
const program = new Command()
const cliRunner = new CLIRunner(path.join(__dirname, "../src/worker.js"))

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
  .action(async (files, options) => {
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

    await cliRunner.run(files, processingOptions)
  })

program.parse()
