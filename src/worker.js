import fs from "fs/promises"
import { parentPort, workerData } from "worker_threads"
import { transform } from "./index.js"

/** Worker thread for processing files in parallel. */

const { filePath, baseline, jQuery } = workerData

try {
  const code = await fs.readFile(filePath, "utf8")
  const result = transform(code, baseline, jQuery)

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
