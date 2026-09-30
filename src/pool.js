import os from "os"
import { Worker } from "worker_threads"

/**
 * Processes a single file on a worker thread.
 *
 * @typedef {(filePath: string, options: Object, worker: TransformWorker) => Promise<{modified: boolean, error: boolean}>} FileProcessorFunction
 */

/**
 * Error raised when a worker thread stops before answering a request.
 */
class WorkerStopError extends Error {
  /**
   * @param {string} message - Reason the worker stopped
   */
  constructor(message) {
    super(message)
    this.name = "WorkerStopError"
  }
}

/**
 * Worker thread that transforms files on request.
 *
 * Loading the transformation pipeline takes tens of milliseconds, so one worker
 * transforms many files instead of being spawned for a single file.
 */
export class TransformWorker {
  #worker
  #requests = new Map()
  #nextRequestId = 0
  #stopError = null

  /**
   * @param {string} workerPath - Path of the worker thread module
   */
  constructor(workerPath) {
    this.#worker = new Worker(workerPath)
    this.#worker.on("message", (message) => this.#settle(message))
    this.#worker.on("error", (error) => this.#stop(error))
    this.#worker.on("exit", (code) =>
      this.#stop(new WorkerStopError(`Worker stopped with exit code ${code}`)),
    )
  }

  /**
   * Report whether the worker thread stopped.
   *
   * @returns {boolean} True when the thread no longer answers requests
   */
  get stopped() {
    return this.#stopError !== null
  }

  /**
   * Transform a single file.
   *
   * A stopped thread drops posted messages without a response, so requests fail
   * immediately instead of waiting for a reply that never comes.
   *
   * @param {{filePath: string, baseline: string, includeOriginal: boolean}} request - File to transform
   * @returns {Promise<Object>} Worker response message
   */
  transform(request) {
    if (this.#stopError) {
      return Promise.reject(this.#stopError)
    }

    this.#nextRequestId++
    const requestId = this.#nextRequestId

    return new Promise((resolve, reject) => {
      this.#requests.set(requestId, { resolve, reject })
      this.#worker.postMessage({ id: requestId, ...request })
    })
  }

  /**
   * Stop the worker thread.
   *
   * @returns {Promise<void>} Resolves when the thread stopped
   */
  async terminate() {
    await this.#worker.terminate()
    this.#stop(new WorkerStopError("Worker terminated"))
  }

  /**
   * Resolve the request a response belongs to.
   *
   * @param {{id: number}} message - Worker response message
   */
  #settle(message) {
    const request = this.#requests.get(message.id)

    if (request) {
      this.#requests.delete(message.id)
      request.resolve(message)
    }
  }

  /**
   * Mark the worker stopped and reject every pending request.
   *
   * @param {Error} error - Reason the worker stopped
   */
  #stop(error) {
    this.#stopError = error

    for (const { reject } of this.#requests.values()) {
      reject(error)
    }

    this.#requests.clear()
  }
}

/**
 * Fixed set of worker threads that transform a queue of files.
 *
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
   * @param {string} workerPath - Path of the worker thread module
   * @param {number} [maxWorkers] - Upper bound of concurrent workers
   */
  constructor(fileProcessor, workerPath, maxWorkers = os.availableParallelism()) {
    this.#fileProcessor = fileProcessor
    this.#workerPath = workerPath
    this.#maxWorkers = maxWorkers
  }

  /**
   * Process files with the worker pool, keeping the input order of the results.
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
          results[currentIndex] = await this.#fileProcessor.processFile(
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
