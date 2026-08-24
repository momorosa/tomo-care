export const SPECIALIST_HANDOFF_SCHEMA_VERSION = "specialist_handoff_v1"

export const SPECIALIST_FAILURE_TYPES = Object.freeze([
    "timeout",
    "unavailable",
    "malformed_input",
    "malformed_result",
    "stale_evidence",
    "partial_result",
    "permission_denied",
    "internal_error",
])

const FAILURE_TYPES = new Set(SPECIALIST_FAILURE_TYPES)
const CONTRACT_TRUTH_TIERS = new Set([
    "source",
    "candidate",
    "trusted",
    "action_state",
    "review_assessment",
])

export class SpecialistContractError extends Error {
    constructor(message, { reason = "internal_error", retryable = false } = {}) {
        super(message)
        this.name = "SpecialistContractError"
        this.reason = FAILURE_TYPES.has(reason) ? reason : "internal_error"
        this.retryable = Boolean(retryable)
    }
}

export function defineSpecialistContract({
    name,
    version,
    description,
    allowedTruthTiers,
    allowedTools,
    timeoutMs,
    validateInput,
    validateOutput,
}) {
    assertNonBlank(name, "name")
    assertPositiveInteger(version, "version")
    assertNonBlank(description, "description")
    assertPositiveInteger(timeoutMs, "timeoutMs")

    if (!Array.isArray(allowedTruthTiers) || !allowedTruthTiers.length) {
        throw new TypeError("allowedTruthTiers must contain at least one truth tier.")
    }

    for (const truthTier of allowedTruthTiers) {
        if (!CONTRACT_TRUTH_TIERS.has(truthTier)) {
            throw new TypeError(`Unsupported truth tier: ${truthTier}`)
        }
    }

    if (!Array.isArray(allowedTools) || !allowedTools.length) {
        throw new TypeError("allowedTools must contain at least one tool name.")
    }

    allowedTools.forEach((toolName) => assertNonBlank(toolName, "tool name"))

    if (typeof validateInput !== "function") {
        throw new TypeError("validateInput is required.")
    }

    if (typeof validateOutput !== "function") {
        throw new TypeError("validateOutput is required.")
    }

    return Object.freeze({
        schema_version: SPECIALIST_HANDOFF_SCHEMA_VERSION,
        name,
        version,
        description,
        allowed_truth_tiers: Object.freeze([...allowedTruthTiers]),
        allowed_tools: Object.freeze([...new Set(allowedTools)]),
        timeout_ms: timeoutMs,
        validate_input: validateInput,
        validate_output: validateOutput,
    })
}

export function createSpecialistToolBroker({ contract, tools, signal }) {
    assertContract(contract)

    const allowedTools = new Set(contract.allowed_tools)

    return Object.freeze({
        async call(toolName, input = {}) {
            if (!allowedTools.has(toolName)) {
                throw new SpecialistContractError(
                    `${contract.name} is not allowed to use ${toolName}.`,
                    {
                        reason: "permission_denied",
                        retryable: false,
                    }
                )
            }

            const tool = tools?.[toolName]
            if (typeof tool !== "function") {
                throw new SpecialistContractError(
                    `${toolName} is unavailable for ${contract.name}.`,
                    {
                        reason: "unavailable",
                        retryable: true,
                    }
                )
            }

            if (signal?.aborted) {
                throw new SpecialistContractError(
                    `${contract.name} timed out before ${toolName} completed.`,
                    {
                        reason: "timeout",
                        retryable: true,
                    }
                )
            }

            return tool(input, { signal })
        },
    })
}

export async function invokeSpecialist({
    contract,
    input,
    handler,
    tools,
}) {
    assertContract(contract)

    if (typeof handler !== "function") {
        return buildSpecialistFailure({
            contract,
            type: "unavailable",
            message: `${contract.name} is unavailable.`,
            retryable: true,
        })
    }

    if (!isValid(() => contract.validate_input(input))) {
        return buildSpecialistFailure({
            contract,
            type: "malformed_input",
            message: `${contract.name} received an invalid handoff.`,
            retryable: false,
        })
    }

    const controller = new AbortController()
    let timeoutId = null

    try {
        const result = await Promise.race([
            handler({
                input,
                tools: createSpecialistToolBroker({
                    contract,
                    tools,
                    signal: controller.signal,
                }),
            }),
            new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    controller.abort()
                    reject(
                        new SpecialistContractError(
                            `${contract.name} timed out.`,
                            {
                                reason: "timeout",
                                retryable: true,
                            }
                        )
                    )
                }, contract.timeout_ms)
            }),
        ])

        if (!isValid(() => contract.validate_output(result))) {
            return buildSpecialistFailure({
                contract,
                type: "malformed_result",
                message: `${contract.name} returned an invalid result.`,
                retryable: false,
            })
        }

        return {
            schema_version: SPECIALIST_HANDOFF_SCHEMA_VERSION,
            specialist: {
                name: contract.name,
                version: contract.version,
            },
            status: "completed",
            result,
            failure: null,
        }
    } catch (error) {
        const failure = normalizeFailure(error)

        return buildSpecialistFailure({
            contract,
            type: failure.type,
            message: failure.message,
            retryable: failure.retryable,
        })
    } finally {
        if (timeoutId) clearTimeout(timeoutId)
    }
}

export function buildSpecialistFailure({
    contract,
    type,
    message,
    retryable,
}) {
    assertContract(contract)

    const failureType = FAILURE_TYPES.has(type) ? type : "internal_error"

    return {
        schema_version: SPECIALIST_HANDOFF_SCHEMA_VERSION,
        specialist: {
            name: contract.name,
            version: contract.version,
        },
        status: "failed",
        result: null,
        failure: {
            type: failureType,
            message: cleanFailureMessage(message, contract.name),
            retryable: Boolean(retryable),
        },
    }
}

function normalizeFailure(error) {
    if (error instanceof SpecialistContractError) {
        return {
            type: error.reason,
            message: error.message,
            retryable: error.retryable,
        }
    }

    return {
        type: "internal_error",
        message: "The specialist could not complete the handoff.",
        retryable: true,
    }
}

function cleanFailureMessage(message, specialistName) {
    if (typeof message !== "string" || !message.trim()) {
        return `${specialistName} could not complete the handoff.`
    }

    return message.trim().slice(0, 300)
}

function isValid(validate) {
    try {
        return validate() === true
    } catch {
        return false
    }
}

function assertContract(contract) {
    if (
        contract?.schema_version !== SPECIALIST_HANDOFF_SCHEMA_VERSION ||
        typeof contract?.name !== "string" ||
        !Number.isInteger(contract?.version)
    ) {
        throw new TypeError("A valid specialist contract is required.")
    }
}

function assertNonBlank(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(`${label} must be a non-empty string.`)
    }
}

function assertPositiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new TypeError(`${label} must be a positive integer.`)
    }
}
