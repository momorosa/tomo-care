import {
    buildAppleMessagesLaunchUri,
    buildPrivateRecipientDisplay,
} from "../messaging/appleMessagesHandoff.js"

const HANDOFF_ACTOR = "Rosa"
const CONTRACT_VERSION = 1
const CONTRACT_LIFETIME_MS = 60_000

export class AppleMessagesHandoffError extends Error {
    constructor({ status, reason, message, cause }) {
        super(message, cause ? { cause } : undefined)
        this.name = "AppleMessagesHandoffError"
        this.status = status
        this.reason = reason
    }
}

export async function prepareLibrelaAppleMessagesHandoff({
    repository,
    actionId,
    now = () => new Date(),
}) {
    assertRepository(repository)
    assertRequiredString(actionId, "actionId")

    let prepared

    try {
        prepared = await repository.prepareLibrelaAppleMessagesHandoff({
            actionId,
            requestedBy: HANDOFF_ACTOR,
        })
    } catch (error) {
        throw mapPreparationError(error)
    }

    assertPreparedContract(prepared)

    const issuedAtDate = now()

    if (!(issuedAtDate instanceof Date) || Number.isNaN(issuedAtDate.valueOf())) {
        throw handoffError(
            500,
            "invalid_server_time",
            "TomoCare could not create a current Messages handoff."
        )
    }

    const issuedAt = issuedAtDate.toISOString()
    const expiresAt = new Date(
        issuedAtDate.getTime() + CONTRACT_LIFETIME_MS
    ).toISOString()
    const launchUri = buildAppleMessagesLaunchUri({
        recipientAddress: prepared.recipient_address,
        messageBody: prepared.message_body,
    })

    return {
        disposition: prepared.disposition,
        handoff: {
            id: prepared.handoff_id,
            state: prepared.state,
            target_app: prepared.target_app,
            recipient_name: prepared.recipient_name,
            recipient_display: buildPrivateRecipientDisplay(
                prepared.recipient_address
            ),
            launch_uri: launchUri,
            contract_version: CONTRACT_VERSION,
            issued_at: issuedAt,
            expires_at: expiresAt,
        },
    }
}

function assertPreparedContract(prepared) {
    const valid =
        prepared &&
        ["created", "existing"].includes(prepared.disposition) &&
        prepared.state === "messages_handoff_requested" &&
        prepared.target_app === "apple_messages" &&
        prepared.contract_version === CONTRACT_VERSION

    for (const field of [
        "handoff_id",
        "recipient_name",
        "recipient_address",
        "message_body",
    ]) {
        if (typeof prepared?.[field] !== "string" || !prepared[field].trim()) {
            throw invalidResponseError()
        }
    }

    if (!valid) throw invalidResponseError()
}

function mapPreparationError(error) {
    const message = String(error?.message || "")
    const reason = message.split(":", 1)[0]
    const mappings = {
        invalid_request: [400, "The Messages handoff request is incomplete."],
        action_not_found: [404, "The approved appointment request was not found."],
        unsupported_action_type: [409, "This care action cannot open in Messages."],
        action_not_approved: [409, "Approve the reviewed message before opening it in Messages."],
        invalid_action_contract: [409, "The reviewed request no longer matches its trusted information. Prepare it again."],
        source_evidence_missing: [409, "Trusted Librela information is no longer available. Prepare the request again."],
        source_evidence_changed: [409, "Trusted Librela information changed after approval. Review and prepare the request again."],
        recipient_not_verified: [409, "The clinic’s SMS contact is no longer active and verified."],
        orchestration_run_changed: [409, "The appointment workflow changed after approval. Review and prepare the request again."],
        handoff_contract_changed: [409, "The existing Messages handoff no longer matches this request."],
    }
    const mapping = mappings[reason]

    if (!mapping) return error

    return new AppleMessagesHandoffError({
        status: mapping[0],
        reason,
        message: mapping[1],
        cause: error,
    })
}

function invalidResponseError() {
    return handoffError(
        502,
        "invalid_handoff_response",
        "TomoCare could not confirm a safe Messages handoff. Nothing was opened."
    )
}

function handoffError(status, reason, message) {
    return new AppleMessagesHandoffError({ status, reason, message })
}

function assertRepository(repository) {
    if (typeof repository?.prepareLibrelaAppleMessagesHandoff !== "function") {
        throw new Error(
            "repository.prepareLibrelaAppleMessagesHandoff is required."
        )
    }
}

function assertRequiredString(value, field) {
    if (typeof value !== "string" || !value.trim()) {
        throw handoffError(400, "invalid_request", `${field} is required.`)
    }
}
