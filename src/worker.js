import fs from "fs/promises"
import { parentPort } from "worker_threads"
import { transform } from "./index.js"

/** Worker thread that transforms files on request. */

/**
 * Convert an error into a plain object.
 *
 * Babel parse errors define `message` as an accessor, which structured clone
 * serializes as an empty string.
 *
 * @param {Error} error - Error thrown while transforming a file.
 * @returns {{name: string, message: string, stack: string | undefined}} Plain error data.
 */
function serializeError({ name, message, stack }) {
  return { name, message, stack }
}

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
    parentPort.postMessage({ success: false, error: serializeError(error) })
  }
})
