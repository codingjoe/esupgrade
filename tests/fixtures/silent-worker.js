import { parentPort } from "worker_threads"

/** Worker thread that ignores every request. Used to test worker shutdown. */

parentPort.on("message", () => {})
