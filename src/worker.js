import fs from "fs/promises"
import { parentPort } from "worker_threads"
import { transform } from "./index.js"

/** Worker thread that transforms files on request. */

parentPort.on("message", async ({ id, filePath, baseline, includeOriginal }) => {
  try {
    const code = await fs.readFile(filePath, "utf8")
    const result = transform(code, baseline)

    parentPort.postMessage({
      id,
      success: true,
      filePath,
      result: {
        modified: result.modified,
        original: includeOriginal ? code : undefined,
        code: result.code,
      },
    })
  } catch (error) {
    parentPort.postMessage({
      id,
      success: false,
      filePath,
      error,
    })
  }
})
