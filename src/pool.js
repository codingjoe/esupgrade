import os from "os"
import { Worker } from "worker_threads"

/**
 * @typedef {(filePath: string, options: Object, worker: TransformWorker) => Promise<{modified: boolean, error: boolean}>} FileProcessorFunction
 */

/**
 * Loading the transformation pipeline takes tens of milliseconds, so one worker
 * transforms many files instead of being spawned for a single file.
 */
export class TransformWorker {
  #worker
  #pending = null
  #stopError = null

  /**
   * @param {string | URL} workerPath - Path of the worker thread module
   */
  constructor(workerPath) {
    this.#worker = new Worker(workerPath)
    this.#worker.on("message", (message) => this.#settle(message))
    this.#worker.on("error", (error) => this.#stop(error))
    this.#worker.on("exit", (code) =>
      this.#stop(new Error(`Worker stopped with exit code ${code}`)),
    )
  }

  get stopped() {
    return this.#stopError !== null
  }

  /**
   * A stopped thread drops posted messages without a response, so requests fail
   * immediately instead of waiting for a reply that never comes. One request runs
   * at a time, so a second request fails loudly instead of losing the first.
   *
   * @param {{filePath: string, baseline: string, includeOriginal: boolean}} request - File to transform
   * @returns {Promise<Object>} Worker response message
   */
  transform(request) {
    if (this.#stopError) {
      return Promise.reject(this.#stopError)
    }

    if (this.#pending) {
      return Promise.reject(new Error("Worker already transformed a file"))
    }

    return new Promise((resolve, reject) => {
      this.#pending = { resolve, reject }
      this.#worker.postMessage(request)
    })
  }

  /**
   * @returns {Promise<number>} Exit code of the stopped thread
   */
  terminate() {
    return this.#worker.terminate()
  }

  /**
   * @param {Object} message - Worker response message
   */
  #settle(message) {
    this.#pending?.resolve(message)
    this.#pending = null
  }

  /**
   * @param {Error} error - Reason the worker stopped
   */
  #stop(error) {
    this.#stopError ??= error
    this.#pending?.reject(error)
    this.#pending = null
  }
}

/**
 * Each worker loads the transformation pipeline once and then processes files
 * until the queue is empty. A worker that stopped is replaced before it takes on
 * the next file, so one stopped thread cannot fail the remaining files.
 */
export class WorkerPool {
  #fileProcessor
  #workerPath
  #maxWorkers

  /**
   * @param {FileProcessorFunction} fileProcessor - Processor that handles one file
   * @param {string | URL} workerPath - Path of the worker thread module
   * @param {number} [maxWorkers] - Upper bound of concurrent workers
   */
  constructor(fileProcessor, workerPath, maxWorkers = os.availableParallelism()) {
    this.#fileProcessor = fileProcessor
    this.#workerPath = workerPath
    this.#maxWorkers = maxWorkers
  }

  /**
   * The results keep the input order of the given files.
   *
   * @param {string[]} files - Files to process
   * @param {Object} options - Processing options
   * @returns {Promise<Array<{modified: boolean, error: boolean}>>} Result per file
   */
  async processFiles(files, options) {
    const results = new Array(files.length)
    let fileIndex = 0

    const processQueue = async () => {
      let worker = new TransformWorker(this.#workerPath)

      try {
        while (fileIndex < files.length) {
          const currentIndex = fileIndex++
          results[currentIndex] = await this.#fileProcessor(
            files[currentIndex],
            options,
            worker,
          )
          worker = await this.#replaceStoppedWorker(worker)
        }
      } finally {
        await worker.terminate()
      }
    }

    const workerCount = Math.min(this.#maxWorkers, files.length)
    const queues = Array.from({ length: workerCount }, processQueue)
    await Promise.all(queues)

    return results
  }

  /**
   * Provide a running worker for the next file.
   *
   * @param {TransformWorker} worker - Worker that handled the previous file
   * @returns {Promise<TransformWorker>} The worker itself, or a replacement
   */
  async #replaceStoppedWorker(worker) {
    if (!worker.stopped) {
      return worker
    }

    await worker.terminate()

    return new TransformWorker(this.#workerPath)
  }
}
