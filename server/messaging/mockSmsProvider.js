import { createHash } from "node:crypto"
import process from "node:process"

const SUPPORTED_OUTCOMES = new Set([
    "sent",
    "failed",
    "outcome_unknown",
])

export class MockSmsProviderError extends Error {
    constructor({ kind, code, message }) {
        super(message)
        this.name = "MockSmsProviderError"
        this.kind = kind
        this.code = code
    }
}

export function createMockSmsProvider({
    outcome = process.env.MOCK_SMS_OUTCOME || "sent",
    now = () => new Date().toISOString(),
} = {}) {
    if (!SUPPORTED_OUTCOMES.has(outcome)) {
        throw new Error(`Unsupported mock SMS outcome: ${outcome}`)
    }

    return {
        name: "mock",
        mode: "mock",
        async sendMessage({ to, body, idempotencyKey }) {
            assertNonBlank(to, "to")
            assertNonBlank(body, "body")
            assertNonBlank(idempotencyKey, "idempotencyKey")

            const attemptedAt = now()

            if (outcome === "failed") {
                return {
                    outcome,
                    provider: "mock",
                    mode: "mock",
                    attemptedAt,
                    errorCode: "mock_rejected",
                    errorMessage:
                        "The mock provider rejected the delivery request.",
                }
            }

            if (outcome === "outcome_unknown") {
                throw new MockSmsProviderError({
                    kind: "outcome_unknown",
                    code: "mock_outcome_unknown",
                    message:
                        "The mock provider could not confirm the delivery outcome.",
                })
            }

            return {
                outcome,
                provider: "mock",
                mode: "mock",
                attemptedAt,
                acceptedAt: attemptedAt,
                providerMessageId: buildMockMessageId(idempotencyKey),
            }
        },
    }
}

function buildMockMessageId(idempotencyKey) {
    const digest = createHash("sha256")
        .update(idempotencyKey, "utf8")
        .digest("hex")
        .slice(0, 24)

    return `mock_${digest}`
}

function assertNonBlank(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${label} is required.`)
    }
}