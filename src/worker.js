import fs from "fs/promises"
import { parentPort } from "worker_threads"
import { transform } from "./index.js"

/** Worker thread that transforms files on request. */

parentPort.on("message", async ({ filePath, baseline, includeOriginal }) => {
  try {
    const code = await fs.readFile(filePath, "utf8")
    const result = transform(code, baseline)

    parentPort.postMessage({
      success: true,
      result: result.modified
        ? { ...result, original: includeOriginal ? code : undefined }
        : { modified: false },
    })
  } catch (error) {
    parentPort.postMessage({ success: false, error })
  }
})
