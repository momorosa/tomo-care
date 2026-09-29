import { RUNTIME_MODES } from "../config/runtimeContext.js"
import { EXTERNAL_CAPABILITIES } from "../config/externalSideEffects.js"

const ALLOWED_DEMO_REQUESTS = Object.freeze([
    Object.freeze({
        method: "POST",
        pattern: /^\/api\/events\/[^/]+\/actions\/sync-demo-calendar\/?$/,
        capability: "demo_calendar",
    }),
    Object.freeze({
        method: "POST",
        pattern: /^\/api\/gmail\/check-inbox\/?$/,
        capability: EXTERNAL_CAPABILITIES.DEMO_GMAIL_INTAKE,
    }),
])

const BLOCKED_DEMO_REQUESTS = Object.freeze([
    Object.freeze({
        method: "POST",
        pattern: /^\/api\/events\/[^/]+\/actions\/sync-google-calendar\/?$/,
        capability: "Google Calendar write",
    }),
    Object.freeze({
        method: "GET",
        pattern: /^\/api\/debug\/google-calendar\/?$/,
        capability: "Google Calendar connection",
    }),
    Object.freeze({
        method: "POST",
        pattern: /^\/api\/care-actions\/[^/]+\/apple-messages-handoff(?:\/resolve)?\/?$/,
        capability: "Apple Messages handoff",
    }),
])

export function getRuntimeBoundaryDecision({ method, pathname, runtime }) {
    if (runtime.mode === RUNTIME_MODES.DEMO) {
        const allowed = ALLOWED_DEMO_REQUESTS.find(
            (rule) =>
                rule.method === method.toUpperCase() &&
                rule.pattern.test(pathname)
        )

        if (allowed) {
            return Object.freeze({
                type: "allow_demo_capability",
                capability: allowed.capability,
            })
        }

        const blocked = BLOCKED_DEMO_REQUESTS.find(
            (rule) =>
                rule.method === method.toUpperCase() &&
                rule.pattern.test(pathname)
        )

        if (blocked) {
            return Object.freeze({
                type: "blocked_demo_side_effect",
                capability: blocked.capability,
            })
        }
    }

    const petMatch = pathname.match(/^\/api\/pets\/([^/]+)(\/.*)?$/)
    if (!petMatch) return Object.freeze({ type: "allow" })

    const requestedPet = decodeURIComponent(petMatch[1])
    if (requestedPet === "current") {
        return Object.freeze({
            type: "rewrite_current_pet",
            pathname: `/api/pets/${runtime.petId}${petMatch[2] || ""}`,
        })
    }

    if (requestedPet !== runtime.petId) {
        return Object.freeze({ type: "reject_pet_scope" })
    }

    return Object.freeze({ type: "allow" })
}

export function createRuntimeBoundaryMiddleware(runtime) {
    return function runtimeBoundary(req, res, next) {
        const parsed = new URL(req.originalUrl || req.url, "http://localhost")
        const decision = getRuntimeBoundaryDecision({
            method: req.method,
            pathname: parsed.pathname,
            runtime,
        })

        if (decision.type === "blocked_demo_side_effect") {
            return res.status(409).json({
                ok: false,
                reason: "demo_external_action_blocked",
                error:
                    `${decision.capability} is unavailable with demo data. ` +
                    "Nothing was contacted, opened, or changed outside TomoCare.",
            })
        }

        if (decision.type === "reject_pet_scope") {
            return res.status(404).json({
                ok: false,
                reason: "pet_scope_not_available",
                error: "The requested care profile is not available.",
            })
        }

        if (decision.type === "rewrite_current_pet") {
            const query = parsed.search || ""
            req.url = `${decision.pathname}${query}`
        }

        return next()
    }
}
