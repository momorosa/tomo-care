import process from "node:process"
import { getRuntimeMode, RUNTIME_MODES } from "../config/runtimeContext.js"

export function getInsuranceProviderForRuntime(
    requestedProvider,
    env = process.env
) {
    if (getRuntimeMode(env) === RUNTIME_MODES.DEMO) return "Pet insurance"

    return requestedProvider?.trim() || "Nationwide"
}
