import fs from "fs"
import { parentPort, workerData } from "worker_threads"
import { transform } from "./index.js"

/**
 * Worker thread for processing files in parallel.
 */

const { filePath, baseline } = workerData

try {
  const code = fs.readFileSync(filePath, "utf8")
  const result = transform(code, baseline)

  parentPort.postMessage({
    success: true,
    filePath,
    result: {
      modified: result.modified,
      original: code,
      code: result.code,
    },
  })
} catch (error) {
  parentPort.postMessage({
    success: false,
    filePath,
    error: error.message,
  })
}
