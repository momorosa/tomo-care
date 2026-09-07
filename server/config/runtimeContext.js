import process from "node:process"
import { getCareDate } from "../lib/careDates.js"
import {
    DEMO_PET_ID,
    DEMO_PROJECT_REF,
} from "../demo/scenarioManifest.js"

export const RUNTIME_MODES = Object.freeze({
    REAL: "real",
    DEMO: "demo",
})

export class RuntimeConfigurationError extends Error {
    constructor(reason, message) {
        super(message)
        this.name = "RuntimeConfigurationError"
        this.reason = reason
    }
}

export function getRuntimeMode(env = process.env) {
    const mode = env.TOMOCARE_RUNTIME_MODE?.trim().toLowerCase()

    if (!Object.values(RUNTIME_MODES).includes(mode)) {
        throw new RuntimeConfigurationError(
            "invalid_runtime_mode",
            "TOMOCARE_RUNTIME_MODE must be exactly real or demo."
        )
    }

    return mode
}

export function getServerRuntimeContext(env = process.env) {
    const mode = getRuntimeMode(env)
    const supabaseUrl = requiredValue(env.SUPABASE_URL, "SUPABASE_URL")
    const projectRef = parseHostedSupabaseProjectRef(supabaseUrl)
    const petId = requiredValue(env.TOMO_PET_ID, "TOMO_PET_ID")

    if (mode === RUNTIME_MODES.DEMO) {
        if (projectRef !== DEMO_PROJECT_REF) {
            throw new RuntimeConfigurationError(
                "demo_project_mismatch",
                "Demo mode requires the exact allowlisted Supabase demo project."
            )
        }

        if (petId !== DEMO_PET_ID) {
            throw new RuntimeConfigurationError(
                "demo_pet_mismatch",
                "Demo mode requires the exact synthetic pet identifier."
            )
        }
    }

    if (
        mode === RUNTIME_MODES.REAL &&
        (projectRef === DEMO_PROJECT_REF || petId === DEMO_PET_ID)
    ) {
        throw new RuntimeConfigurationError(
            "real_demo_identity_collision",
            "Real mode cannot target the allowlisted demo project or synthetic pet."
        )
    }

    return Object.freeze({ mode, supabaseUrl, projectRef, petId })
}

export function toPublicRuntimeContext(
    runtimeContext,
    { now = new Date(), timeZone } = {}
) {
    const careDate = getCareDate(now, timeZone)
    const isDemo = runtimeContext.mode === RUNTIME_MODES.DEMO

    return Object.freeze({
        mode: runtimeContext.mode,
        label: isDemo ? "Demo data" : "Private care",
        data_notice: isDemo ? "Fictional data only." : null,
        care_date: careDate,
    })
}

export function parseHostedSupabaseProjectRef(value) {
    let url

    try {
        url = new URL(value)
    } catch {
        throw new RuntimeConfigurationError(
            "invalid_supabase_url",
            "SUPABASE_URL must be a valid hosted Supabase project URL."
        )
    }

    const match = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)
    if (
        url.protocol !== "https:" ||
        !match ||
        (url.pathname !== "/" && url.pathname !== "") ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash
    ) {
        throw new RuntimeConfigurationError(
            "invalid_supabase_url",
            "SUPABASE_URL must be the exact hosted project root URL."
        )
    }

    return match[1]
}

function requiredValue(value, name) {
    const normalized = value?.trim()
    if (!normalized) {
        throw new RuntimeConfigurationError(
            "missing_runtime_configuration",
            `${name} is required.`
        )
    }
    return normalized
}
