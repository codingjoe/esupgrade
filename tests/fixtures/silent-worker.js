import { parentPort } from "worker_threads"

/** Worker thread that ignores every request. Used to test worker shutdown. */

function ignoreRequest() {}

parentPort.on("message", ignoreRequest)
