import { parentPort, workerData } from "worker_threads"
import fs from "fs"
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
    result,
  })
} catch (error) {
  parentPort.postMessage({
    success: false,
    filePath,
    error: error.message,
  })
}
