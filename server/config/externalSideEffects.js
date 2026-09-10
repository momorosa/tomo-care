import process from "node:process"
import { getRuntimeMode, RUNTIME_MODES } from "./runtimeContext.js"
import { getDemoGmailIntakeContract } from "../demo/demoGmailIntakeContract.js"

export const EXTERNAL_CAPABILITIES = Object.freeze({
    GMAIL_INTAKE: "gmail_intake",
    DEMO_GMAIL_INTAKE: "demo_gmail_intake",
})

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
    const mode = getRuntimeMode(env)

    if (capability === EXTERNAL_CAPABILITIES.DEMO_GMAIL_INTAKE) {
        getDemoGmailIntakeContract(env)
        return true
    }

    if (mode === RUNTIME_MODES.DEMO) {
        throw new DemoExternalSideEffectError(capability)
    }

    return true
}
