const EXPECTED_STATE = "messages_handoff_requested"
const EXPECTED_TARGET_APP = "apple_messages"
const EXPECTED_CONTRACT_VERSION = 1

export function validateAppleMessagesHandoffContract(
    handoff,
    { now = () => Date.now() } = {}
) {
    if (!handoff || typeof handoff !== "object") {
        throw new Error("TomoCare did not return a Messages handoff.")
    }

    if (
        handoff.state !== EXPECTED_STATE ||
        handoff.target_app !== EXPECTED_TARGET_APP ||
        handoff.contract_version !== EXPECTED_CONTRACT_VERSION
    ) {
        throw new Error("The Messages handoff contract is not supported.")
    }

    for (const field of [
        "id",
        "recipient_name",
        "recipient_display",
        "launch_uri",
        "issued_at",
        "expires_at",
    ]) {
        if (typeof handoff[field] !== "string" || !handoff[field].trim()) {
            throw new Error("The Messages handoff contract is incomplete.")
        }
    }

    if (!handoff.launch_uri.startsWith("sms:+")) {
        throw new Error("The Messages handoff does not use a trusted SMS URI.")
    }

    const issuedAt = Date.parse(handoff.issued_at)
    const expiresAt = Date.parse(handoff.expires_at)
    const currentTime = now()

    if (
        !Number.isFinite(issuedAt) ||
        !Number.isFinite(expiresAt) ||
        !Number.isFinite(currentTime) ||
        expiresAt <= issuedAt ||
        currentTime < issuedAt - 5_000 ||
        currentTime >= expiresAt
    ) {
        throw new Error(
            "The Messages handoff expired. Select Open in Messages again."
        )
    }

    return handoff
}

export function requestAppleMessagesDraft({
    handoff,
    location = window.location,
    now,
}) {
    const validHandoff = validateAppleMessagesHandoffContract(handoff, { now })
    location.assign(validHandoff.launch_uri)
}
