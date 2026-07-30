import { MockSmsProviderError } from "../messaging/mockSmsProvider.js"

const EXECUTION_ACTOR = "tomo-care-backend"

export class LibrelaAppointmentExecutionError extends Error {
    constructor({
        status,
        reason,
        message,
        recovery,
        outcomeUnknown = false,
        cause,
    }) {
        super(message, cause ? { cause } : undefined)
        this.name = "LibrelaAppointmentExecutionError"
        this.status = status
        this.reason = reason
        this.recovery = recovery
        this.outcomeUnknown = outcomeUnknown
        this.retryable = false
    }
}

export async function executeSendLibrelaAppointmentRequest({
    repository,
    actionId,
    provider,
}) {
    assertRepository(repository)
    assertProvider(provider)

    let claim

    try {
        claim = await repository.claimSendLibrelaAppointmentRequest({
            actionId,
            executedBy: EXECUTION_ACTOR,
        })
    } catch (error) {
        throw mapClaimError(error)
    }

    if (claim?.disposition === "existing" && claim.status === "succeeded") {
        return {
            disposition: "existing",
            action_id: claim.action_id,
            status: claim.status,
            result: claim.result,
        }
    }

    if (claim?.disposition === "locked") {
        throw lockedExecutionError(claim.status)
    }

    if (
        claim?.disposition !== "claimed" ||
        claim.status !== "executing" ||
        !claim.delivery
    ) {
        throw executionError({
            status: 502,
            reason: "invalid_execution_response",
            message:
                "TomoCare could not confirm the outbound execution claim. The message was not sent by this request.",
            recovery: "refresh",
            outcomeUnknown: true,
        })
    }

    const delivery = claim.delivery
    assertDeliveryContract(delivery)

    let providerResult

    try {
        providerResult = await provider.sendMessage({
            to: delivery.recipient_address,
            body: delivery.message_body,
            idempotencyKey: delivery.idempotency_key,
        })
    } catch (error) {
        if (error instanceof MockSmsProviderError) {
            return finalizeUnknownOutcome({
                repository,
                actionId,
                delivery,
                provider,
                error,
            })
        }

        return finalizeUnknownOutcome({
            repository,
            actionId,
            delivery,
            provider,
            error,
        })
    }

    if (providerResult?.outcome === "failed") {
        const result = buildResult({
            deliveryStatus: "failed",
            delivery,
            providerResult,
        })
        const errorJson = {
            schema_version: 1,
            reason: "provider_rejected",
            provider: providerResult.provider,
            provider_code: providerResult.errorCode || null,
            retryable: false,
        }

        await finalize({
            repository,
            actionId,
            deliveryStatus: "failed",
            result,
            errorJson,
        })

        throw executionError({
            status: 502,
            reason: "delivery_failed",
            message:
                "The mock provider rejected the message. No delivery was recorded.",
            recovery: "review_action",
        })
    }

    if (providerResult?.outcome !== "sent") {
        return finalizeUnknownOutcome({
            repository,
            actionId,
            delivery,
            provider,
            error: new Error("Provider returned an unsupported outcome."),
        })
    }

    const result = buildResult({
        deliveryStatus: "sent",
        delivery,
        providerResult,
    })

    try {
        const finalized = await finalize({
            repository,
            actionId,
            deliveryStatus: "sent",
            result,
            errorJson: null,
        })

        return {
            disposition: finalized?.disposition || "executed",
            action_id: finalized?.action_id || actionId,
            status: finalized?.status || "succeeded",
            result: finalized?.result || result,
        }
    } catch (error) {
        throw executionError({
            status: 503,
            reason: "delivery_outcome_unknown",
            message:
                "The provider accepted the message, but TomoCare could not persist the final result. The action is locked for review and must not be resent automatically.",
            recovery: "review_delivery",
            outcomeUnknown: true,
            cause: error,
        })
    }
}

async function finalizeUnknownOutcome({
    repository,
    actionId,
    delivery,
    provider,
    error,
}) {
    const result = {
        schema_version: 1,
        delivery_status: "outcome_unknown",
        provider: provider.name,
        provider_mode: provider.mode,
        message_sha256: delivery.message_sha256,
        provider_contact_id: delivery.provider_contact_id,
        execution_actor: EXECUTION_ACTOR,
    }
    const errorJson = {
        schema_version: 1,
        reason: "provider_outcome_unknown",
        provider: provider.name,
        provider_code: error?.code || null,
        retryable: false,
    }

    try {
        await finalize({
            repository,
            actionId,
            deliveryStatus: "outcome_unknown",
            result,
            errorJson,
        })
    } catch {
        // The action remains executing, which is also a locked state. Never
        // make a second provider call when persistence cannot be confirmed.
    }

    throw executionError({
        status: 503,
        reason: "delivery_outcome_unknown",
        message:
            "TomoCare could not confirm whether the provider accepted the message. The action is locked for review and must not be resent automatically.",
        recovery: "review_delivery",
        outcomeUnknown: true,
        cause: error,
    })
}

async function finalize({
    repository,
    actionId,
    deliveryStatus,
    result,
    errorJson,
}) {
    return repository.finalizeSendLibrelaAppointmentRequest({
        actionId,
        executedBy: EXECUTION_ACTOR,
        deliveryStatus,
        result,
        error: errorJson,
    })
}

function buildResult({ deliveryStatus, delivery, providerResult }) {
    return {
        schema_version: 1,
        delivery_status: deliveryStatus,
        provider: providerResult.provider,
        provider_mode: providerResult.mode,
        provider_message_id: providerResult.providerMessageId || null,
        attempted_at: providerResult.attemptedAt,
        accepted_at: providerResult.acceptedAt || null,
        message_sha256: delivery.message_sha256,
        provider_contact_id: delivery.provider_contact_id,
        recipient_name: delivery.recipient_name,
        execution_actor: EXECUTION_ACTOR,
    }
}

function lockedExecutionError(status) {
    if (status === "failed") {
        return executionError({
            status: 409,
            reason: "delivery_failed",
            message:
                "This delivery attempt has a known failure and is locked for review.",
            recovery: "review_action",
        })
    }

    return executionError({
        status: 409,
        reason: "delivery_outcome_unknown",
        message:
            "This delivery attempt is in progress or its outcome is unknown. It is locked to prevent a duplicate message.",
        recovery: "review_delivery",
        outcomeUnknown: true,
    })
}

function mapClaimError(error) {
    const rawMessage = String(error?.message || "")
    const reason = rawMessage.split(":", 1)[0].trim()

    if (reason === "action_not_found") {
        return executionError({
            status: 404,
            reason,
            message: "The care action was not found.",
            recovery: "refresh",
            cause: error,
        })
    }

    if (
        [
            "action_not_approved",
            "invalid_action_contract",
            "source_evidence_missing",
            "source_evidence_changed",
            "recipient_not_verified",
        ].includes(reason)
    ) {
        return executionError({
            status: 409,
            reason,
            message:
                "The approved outbound request no longer matches its trusted evidence. Nothing was sent.",
            recovery: "prepare_again",
            cause: error,
        })
    }

    return executionError({
        status: 503,
        reason: "execution_claim_unknown",
        message:
            "TomoCare could not confirm the outbound execution claim. Refresh the action before trying again.",
        recovery: "refresh",
        outcomeUnknown: true,
        cause: error,
    })
}

function assertDeliveryContract(delivery) {
    for (const field of [
        "recipient_address",
        "message_body",
        "message_sha256",
        "idempotency_key",
        "provider_contact_id",
        "recipient_name",
    ]) {
        if (typeof delivery[field] !== "string" || !delivery[field].trim()) {
            throw executionError({
                status: 502,
                reason: "invalid_execution_response",
                message:
                    "TomoCare received an incomplete delivery contract. Nothing was sent.",
                recovery: "review_action",
            })
        }
    }
}

function assertRepository(repository) {
    for (const method of [
        "claimSendLibrelaAppointmentRequest",
        "finalizeSendLibrelaAppointmentRequest",
    ]) {
        if (typeof repository?.[method] !== "function") {
            throw new Error(`repository.${method} is required.`)
        }
    }
}

function assertProvider(provider) {
    if (
        typeof provider?.sendMessage !== "function" ||
        typeof provider?.name !== "string" ||
        typeof provider?.mode !== "string"
    ) {
        throw new Error("A server-owned outbound message provider is required.")
    }
}

function executionError(options) {
    return new LibrelaAppointmentExecutionError(options)
}