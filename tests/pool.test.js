import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, test } from "node:test"
import { TransformWorker, WorkerPool } from "../src/pool.js"

const WORKER_PATH = path.join(process.cwd(), "src", "worker.js")
const SILENT_WORKER_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "silent-worker.js",
)

/**
 * Collect the workers a pool used while processing files.
 *
 * @returns {{fileProcessor: Function, usedWorkers: Set<TransformWorker>}} Stub processor
 */
function createRecordingProcessor() {
  const usedWorkers = new Set()

  return {
    usedWorkers,
    async fileProcessor(filePath, options, worker) {
      usedWorkers.add(worker)

      return { modified: false, error: false }
    },
  }
}

describe("TransformWorker", () => {
  let tempDir

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "esupgrade-pool-"))
  })

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("transform a file in a worker thread", async () => {
    const filePath = path.join(tempDir, "legacy.js")
    fs.writeFileSync(filePath, "var x = 1;")
    const worker = new TransformWorker(WORKER_PATH)

    const message = await worker.transform({
      filePath,
      baseline: "widely-available",
      includeOriginal: true,
    })
    await worker.terminate()

    assert.equal(message.success, true, "reports success")
    assert.equal(message.result.modified, true, "reports the change")
    assert.equal(message.result.code, "const x = 1;", "transforms the code")
    assert.match(message.result.original, /var x/, "returns the original source")
  })

  test("omit the original source when it is not requested", async () => {
    const filePath = path.join(tempDir, "legacy.js")
    fs.writeFileSync(filePath, "var x = 1;")
    const worker = new TransformWorker(WORKER_PATH)

    const message = await worker.transform({
      filePath,
      baseline: "widely-available",
      includeOriginal: false,
    })
    await worker.terminate()

    assert.equal(message.result.modified, true, "reports the change")
    assert.equal(message.result.code, "const x = 1;", "transforms the code")
    assert.equal(message.result.original, undefined, "omits the original source")
  })

  test("report files the worker cannot read", async () => {
    const worker = new TransformWorker(WORKER_PATH)

    const message = await worker.transform({
      filePath: path.join(tempDir, "missing.js"),
      baseline: "widely-available",
      includeOriginal: true,
    })
    await worker.terminate()

    assert.equal(message.success, false, "reports a failure")
    assert.match(message.error.message, /ENOENT/, "reports the read failure")
  })

  test("reject pending requests when the worker stops", async () => {
    const worker = new TransformWorker(SILENT_WORKER_PATH)
    const pending = worker.transform({
      filePath: "unused.js",
      baseline: "widely-available",
      includeOriginal: false,
    })

    await worker.terminate()

    await assert.rejects(
      pending,
      { name: "Error", message: /^Worker stopped with exit code \d+$/ },
      "rejects the request",
    )
  })

  test("reject requests sent to a stopped worker", async () => {
    const worker = new TransformWorker(SILENT_WORKER_PATH)
    await worker.terminate()

    await assert.rejects(
      worker.transform({
        filePath: "unused.js",
        baseline: "widely-available",
        includeOriginal: false,
      }),
      { name: "Error", message: /^Worker stopped with exit code \d+$/ },
      "rejects the request",
    )
  })

  test("reject requests when the worker module fails to load", async () => {
    const worker = new TransformWorker(path.join(tempDir, "missing-worker.js"))

    await assert.rejects(
      worker.transform({
        filePath: "unused.js",
        baseline: "widely-available",
        includeOriginal: false,
      }),
      { code: "MODULE_NOT_FOUND" },
      "rejects the request",
    )
  })
})

describe("WorkerPool", () => {
  test("process files with a limited number of workers", async () => {
    const files = ["a.js", "b.js", "c.js", "d.js"]
    const { fileProcessor, usedWorkers } = createRecordingProcessor()
    const pool = new WorkerPool(fileProcessor, SILENT_WORKER_PATH, 2)

    const results = await pool.processFiles(files, {})

    assert.equal(results.length, files.length, "returns one result per file")
    assert.deepEqual(
      results.map((result) => result.modified),
      [false, false, false, false],
      "keeps the input order",
    )
    assert.equal(usedWorkers.size, 2, "reuses workers across files")
  })

  test("replace a worker that stopped", async () => {
    const files = ["a.js", "b.js"]
    const usedWorkers = new Set()

    async function stopAfterFile(filePath, options, worker) {
      usedWorkers.add(worker)
      await worker.terminate()

      return { modified: false, error: false }
    }

    const pool = new WorkerPool(stopAfterFile, SILENT_WORKER_PATH, 1)

    const results = await pool.processFiles(files, {})

    assert.equal(results.length, files.length, "processes every file")
    assert.equal(usedWorkers.size, 2, "spawns a replacement worker")
  })

  test("process no files without spawning a worker", async () => {
    const { fileProcessor, usedWorkers } = createRecordingProcessor()
    const pool = new WorkerPool(fileProcessor, SILENT_WORKER_PATH, 2)

    const results = await pool.processFiles([], {})

    assert.deepEqual(results, [], "returns no results")
    assert.equal(usedWorkers.size, 0, "spawns no worker")
  })
})
