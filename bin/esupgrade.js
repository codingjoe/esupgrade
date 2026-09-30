#!/usr/bin/env node

import { Command, Option } from "commander"
import { diffLines } from "diff"
import { once } from "events"
import fs from "fs/promises"
import process from "node:process"
import pkg from "../package.json" with { type: "json" }
import { transform } from "../src/index.js"
import { WorkerPool } from "../src/pool.js"

/**
 * CLI tool for esupgrade.
 */

/**
 * Process a file using a worker thread.
 * @param {string} filePath - Path to the file to process.
 * @param {Object} options - Processing options.
 * @param {string} options.baseline - Baseline level for transformations.
 * @param {boolean} options.check - Whether to only check for changes.
 * @param {boolean} options.write - Whether to write changes to file.
 * @param {boolean} options.verbose - The verbosity level for logging.
 * @param {import("../src/pool.js").TransformWorker} worker - Worker that transforms the file.
 * @returns {Promise<{modified: boolean, error: boolean}>} Result of processing.
 */
async function processFile(filePath, options, worker) {
  // Validate that the provided path exists and is a file.
  try {
    const stats = await fs.stat(filePath)
    if (!stats.isFile()) {
      console.error(`Error: '${filePath}' is not a file`)
      process.exit(1)
    }
  } catch (error) {
    console.error(`Error: Cannot access '${filePath}': ${error.message}`)
    process.exit(1)
  }

  try {
    // The worker only ships the original source when a diff can be printed.
    const showsDiff = options.check || !options.write
    const workerResult = await worker.transform({
      filePath,
      baseline: options.baseline,
      includeOriginal: showsDiff,
    })

    if (!workerResult.success) {
      if (options.verbose) console.error(workerResult.error)
      console.error(
        `\x1b[31m✗\x1b[0m Error: ${filePath}: ${workerResult.error.message}`,
      )
      return { modified: false, error: true }
    }

    const result = workerResult.result

    if (result.modified) {
      if (showsDiff) {
        displayDiff(filePath, result.original, result.code)
      }

      if (options.write) {
        await fs.writeFile(filePath, result.code, "utf8")
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
function displayDiff(filePath, original, modified) {
  const changes = diffLines(original, modified).filter(
    ({ added, removed }) => added || removed,
  )

  console.group(`\x1b[31m✗\x1b[0m ${filePath}`)
  for (const { added, value } of changes) {
    const prefix = added ? `  \x1b[32m+ ` : `  \x1b[31m- `
    for (const line of value.split("\n")) {
      if (line.trim() !== "") {
        console.info(`${prefix}${line}\x1b[0m`)
      }
    }
  }
  console.groupEnd()
}

/**
 * Process stdin using the configured transformation options.
 * @param {Object} options - Processing options.
 * @param {string} options.baseline - Baseline level for transformations.
 * @param {boolean} options.check - Whether to only check for changes.
 * @param {boolean} options.write - Whether to write changes to file.
 * @param {boolean} options.verbose - The verbosity level for logging.
 * @returns {Promise<void>} Complete when stdin processing finishes.
 */
async function processStdin(options) {
  if (options.write) {
    console.error("Error: '--write' cannot be used with stdin")
    process.exit(1)
  }

  try {
    const code = await readStdin()
    const result = transform(code, options.baseline)

    if (options.check) {
      if (result.modified) {
        process.exit(1)
      }
      return
    }

    process.stdout.write(result.code)
  } catch (error) {
    if (options.verbose) console.error(error)
    console.error(`\x1b[31m✗\x1b[0m Error: stdin: ${error.message}`)
    process.exit(128)
  }
}

/**
 * Read source code from stdin.
 * @returns {Promise<string>} Source code from stdin.
 */
async function readStdin() {
  process.stdin.setEncoding("utf8")
  let code = ""

  process.stdin.on("data", (chunk) => {
    code += chunk
  })
  await once(process.stdin, "end")
  return code
}

/**
 * Orchestrates the CLI application.
 */
class CLIRunner {
  constructor(workerPath) {
    this.workerPool = new WorkerPool(processFile, workerPath)
  }

  /**
   * Process files and report results.
   * @param {string[]} patterns - File paths to process (no globbing).
   * @param {Object} options - Processing options.
   */
  async run(patterns, options) {
    switch (this.#getInputMode(patterns)) {
      case "stdin":
        await processStdin(options)
        return
      case "mixed":
        console.error("Error: '-' cannot be combined with file paths")
        return process.exit(1)
      default:
        break
    }

    console.time("Processing")
    // Hand CLI-provided names directly to the worker pool; file validation occurs in processFile.
    const results = await this.workerPool.processFiles(patterns, options)
    console.timeEnd("Processing")

    this.#reportSummary(results, options)
  }

  /**
   * Classify the input mode selected by CLI arguments.
   * @param {string[]} patterns - File paths to process.
   * @returns {"files" | "stdin" | "mixed"} Selected input mode.
   */
  #getInputMode(patterns) {
    const stdinCount = patterns.filter((pattern) => pattern === "-").length

    switch (stdinCount) {
      case 0:
        return "files"
      case 1:
        return patterns.length === 1 ? "stdin" : "mixed"
      default:
        return "mixed"
    }
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
const cliRunner = new CLIRunner(new URL("../src/worker.js", import.meta.url))

program
  .name("esupgrade")
  .description("Auto-upgrade your JavaScript syntax")
  .version(pkg.version)
  .argument("<files...>", "Files or directories to process, or '-' to read from stdin")
  .addOption(
    new Option("--baseline <level>", "Set baseline level for transformations")
      .choices(["widely-available", "newly-available"])
      .default("widely-available"),
  )
  .option("--verbose, -v", "Show more detailed output.", false)
  .option(
    "--check",
    "Report which files need upgrading and exit with code 1 if any do",
    false,
  )
  .option("--write", "Write changes to files", false)
  .action(async (files, options) => {
    await cliRunner.run(files, options)
  })

program.parse()
