import process from "node:process"
import { getRuntimeMode, RUNTIME_MODES } from "./runtimeContext.js"

export class DemoExternalSideEffectError extends Error {
    constructor(capability) {
        super(
            `${capability} is unavailable with demo data. Nothing was contacted outside TomoCare.`
        )
        this.name = "DemoExternalSideEffectError"
        this.reason = "demo_external_action_blocked"
    }
}

export function assertExternalSideEffectAllowed(
    capability,
    env = process.env
) {
    if (getRuntimeMode(env) === RUNTIME_MODES.DEMO) {
        throw new DemoExternalSideEffectError(capability)
    }
}
