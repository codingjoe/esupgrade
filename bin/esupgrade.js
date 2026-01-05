#!/usr/bin/env node

import { Command, Option } from "commander"
import { diffLines } from "diff"
import { once } from "events"
import fs from "fs"
import process from "node:process"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"
import { Worker } from "worker_threads"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * CLI tool for esupgrade.
 */

/**
 * Handles worker thread execution for file processing.
 */
class WorkerRunner {
  constructor(workerPath) {
    this.workerPath = workerPath
  }

  /**
   * Run a worker thread to process a file.
   * @param {string} filePath - Path to the file to process.
   * @param {string} baseline - Baseline level for transformations.
   * @returns {Promise<Object>} Worker message result.
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
 * Processes individual files and handles output.
 */
class FileProcessor {
  constructor(workerRunner) {
    this.workerRunner = workerRunner
  }

  /**
   * Process a file using a worker thread.
   * @param {string} filePath - Path to the file to process.
   * @param {Object} options - Processing options.
   * @param {string} options.baseline - Baseline level for transformations.
   * @param {boolean} options.check - Whether to only check for changes.
   * @param {boolean} options.write - Whether to write changes to file.
   * @returns {Promise<{modified: boolean, error: boolean}>} Result of processing.
   */
  async processFile(filePath, options) {
    try {
      const workerResult = await this.workerRunner.run(filePath, options.baseline)

      if (!workerResult.success) {
        console.error(`\x1b[31m✗\x1b[0m Error: ${filePath}: ${workerResult.error}`)
        return { modified: false, error: true }
      }

      const result = workerResult.result

      if (result.modified) {
        // Display diff if check mode or if not writing (dry-run)
        if (options.check || !options.write) {
          this.#displayDiff(filePath, result.original, result.code)
        }

        if (options.write) {
          fs.writeFileSync(filePath, result.code, "utf8")
          if (!options.check) {
            console.info(`\x1b[32m✓\x1b[0m ${filePath}`)
          }
        }

        return { modified: true, error: false }
      }

      // Show unmodified files unless in check-only mode
      if (!options.check) {
        console.debug(`  ${filePath}`)
      }
      return { modified: false, error: false }
    } catch (error) {
      console.error(`\x1b[31m✗\x1b[0m Error: ${filePath}: ${error.message}`)
      return { modified: false, error: true }
    }
  }

  /**
   * Display a diff between original and modified code.
   * @param {string} filePath - Path to the file being displayed.
   * @param {string} original - Original code.
   * @param {string} modified - Modified code.
   */
  #displayDiff(filePath, original, modified) {
    const diff = diffLines(original, modified)

    console.group(`\x1b[31m✗\x1b[0m ${filePath}`)
    for (const part of diff) {
      if (part.added) {
        for (const line of part.value.split("\n")) {
          if (line.trim() !== "") {
            console.info(`  \x1b[32m+ ${line}\x1b[0m`)
          }
        }
      } else if (part.removed) {
        for (const line of part.value.split("\n")) {
          if (line.trim() !== "") {
            console.info(`  \x1b[31m- ${line}\x1b[0m`)
          }
        }
      }
    }
    console.groupEnd()
  }
}

/**
 * Manages a pool of workers for parallel file processing.
 */
class WorkerPool {
  constructor(fileProcessor, maxWorkers = os.cpus().length) {
    this.fileProcessor = fileProcessor
    this.maxWorkers = maxWorkers
  }

  /**
   * Process files with a worker pool for better CPU utilization.
   * @param {string[]} files - Files to process.
   * @param {Object} options - Processing options.
   * @returns {Promise<Array>} Array of processing results.
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
 * Finds JavaScript files from patterns.
 */
class FileFinder {
  static IGNORED_DIRS = ["node_modules", ".git"]
  static JS_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]

  constructor() {}

  /**
   * Find files matching patterns.
   * @param {string[]} patterns - File or directory patterns.
   * @yields {string} File paths matching the patterns.
   */
  *find(patterns) {
    for (const pattern of patterns) {
      try {
        const stats = fs.statSync(pattern)

        if (stats.isFile()) {
          yield pattern
        } else if (stats.isDirectory()) {
          yield* this.#walkDirectory(pattern)
        }
      } catch (error) {
        console.error(`Error: Cannot access '${pattern}': ${error.message}`)
        process.exit(1)
      }
    }
  }

  *#walkDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (FileFinder.IGNORED_DIRS.includes(entry.name)) {
          continue
        }
        yield* this.#walkDirectory(fullPath)
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
 * Orchestrates the CLI application.
 */
class CLIRunner {
  constructor(workerPath) {
    const workerRunner = new WorkerRunner(workerPath)
    const fileProcessor = new FileProcessor(workerRunner)
    this.workerPool = new WorkerPool(fileProcessor)
    this.fileFinder = new FileFinder()
  }

  /**
   * Process files and report results.
   * @param {string[]} patterns - File or directory patterns.
   * @param {Object} options - Processing options.
   */
  async run(patterns, options) {
    const files = [...this.fileFinder.find(patterns)]

    if (files.length === 0) {
      console.info("No JavaScript files found")
      process.exit(0)
    }

    console.time("Processing")
    const results = await this.workerPool.processFiles(files, options)
    console.timeEnd("Processing")

    this.#reportSummary(results, options)
  }

  #reportSummary(results, options) {
    let modifiedCount = 0
    const errorCount = results.filter((result) => {
      if (result.modified) {
        modifiedCount++
      }
      return result.error
    }).length

    console.info("")

    if (modifiedCount === 0) {
      console.info("All files are up to date")
    } else {
      if (options.check) {
        console.info(
          `${modifiedCount} file${modifiedCount !== 1 ? "s" : ""} need${modifiedCount === 1 ? "s" : ""} upgrading`,
        )
        if (options.write) {
          console.info("Changes have been written")
        }
      } else if (options.write) {
        // --write without --check
        console.info(
          `✓ ${modifiedCount} file${modifiedCount !== 1 ? "s" : ""} upgraded`,
        )
      } else {
        // Dry-run mode (no --check, no --write)
        console.info(
          `${modifiedCount} file${modifiedCount !== 1 ? "s" : ""} would be upgraded`,
        )
      }
    }

    // Errors take precedence over --check flag.
    // Exit with error code if any file processing errors occurred.
    if (errorCount > 0) {
      process.exit(128)
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
  .argument("<files...>", "Files or directories to process")
  .addOption(
    new Option("--baseline <level>", "Set baseline level for transformations")
      .choices(["widely-available", "newly-available"])
      .default("widely-available"),
  )
  .option("--check", "Report which files need upgrading and exit with code 1 if any do")
  .option("--write", "Write changes to files")
  .action(async (files, options) => {
    // Handle check/write options - they are not mutually exclusive
    // Default: write is false (read-only mode unless --write is specified)
    const shouldWrite = options.write || false
    const shouldCheck = options.check || false

    const processingOptions = {
      baseline: options.baseline,
      write: shouldWrite,
      check: shouldCheck,
    }

    await cliRunner.run(files, processingOptions)
  })

program.parse()
