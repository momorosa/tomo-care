import process from "node:process"
import {
    getServerRuntimeContext,
    RUNTIME_MODES,
} from "../config/runtimeContext.js"
import {
    DEMO_INTAKE_FIXTURE,
    DEMO_PET_ID,
    DEMO_PROJECT_REF,
    DEMO_SCENARIO_ID,
    DEMO_STORAGE_BUCKET,
    DEMO_STORAGE_PREFIX,
} from "./scenarioManifest.js"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class DemoGmailIntakeConfigurationError extends Error {
    constructor(reason, message) {
        super(message)
        this.name = "DemoGmailIntakeConfigurationError"
        this.reason = reason
    }
}

export function getDemoGmailIntakeContract(env = process.env) {
    const runtime = getServerRuntimeContext(env)

    if (
        runtime.mode !== RUNTIME_MODES.DEMO ||
        runtime.projectRef !== DEMO_PROJECT_REF ||
        runtime.petId !== DEMO_PET_ID
    ) {
        throw configurationError(
            "demo_gmail_runtime_mismatch",
            "Demo Gmail intake requires the exact validated demo runtime."
        )
    }

    const senderEmail = requiredEmail(
        env.DEMO_GMAIL_ALLOWED_SENDER,
        "DEMO_GMAIL_ALLOWED_SENDER"
    )
    const recipientEmail = requiredEmail(
        env.DEMO_GMAIL_RECIPIENT,
        "DEMO_GMAIL_RECIPIENT"
    )

    const query = [
        `from:${senderEmail}`,
        `deliveredto:${recipientEmail}`,
        `subject:"${DEMO_INTAKE_FIXTURE.subjectPrefix}"`,
        "has:attachment",
        `filename:"${DEMO_INTAKE_FIXTURE.filename}"`,
    ].join(" ")

    return Object.freeze({
        capability: "demo_gmail_intake",
        senderEmail,
        recipientEmail,
        query,
        projectRef: DEMO_PROJECT_REF,
        scenarioId: DEMO_SCENARIO_ID,
        petId: DEMO_PET_ID,
        storageBucket: DEMO_STORAGE_BUCKET,
        storagePrefix: DEMO_STORAGE_PREFIX,
        ...DEMO_INTAKE_FIXTURE,
    })
}

export function evaluateDemoGmailAccount({
    authenticatedEmail,
    contract,
}) {
    if (normalizeEmail(authenticatedEmail) !== contract.recipientEmail) {
        return rejection("demo_gmail_account_mismatch")
    }

    return acceptance()
}

export function evaluateDemoGmailEnvelope({
    fromEmail,
    recipientEmails = [],
    subject,
    isForwarded = false,
    attachmentParts = [],
    contract,
}) {
    if (isForwarded) {
        return rejection("demo_gmail_forward_rejected")
    }

    if (normalizeEmail(fromEmail) !== contract.senderEmail) {
        return rejection("demo_gmail_sender_mismatch")
    }

    if (
        !recipientEmails
            .map(normalizeEmail)
            .filter(Boolean)
            .includes(contract.recipientEmail)
    ) {
        return rejection("demo_gmail_recipient_mismatch")
    }

    if (!String(subject || "").startsWith(contract.subjectPrefix)) {
        return rejection("demo_gmail_subject_mismatch")
    }

    const acceptedParts = attachmentParts.filter(
        (part) =>
            part.filename === contract.filename &&
            part.mimeType === contract.mimeType
    )

    if (acceptedParts.length !== 1) {
        return rejection("demo_gmail_attachment_mismatch")
    }

    return Object.freeze({
        accepted: true,
        reason: "demo_gmail_envelope_accepted",
        attachmentParts: Object.freeze(acceptedParts),
    })
}

export function evaluateDemoGmailAttachment({ attachment, contract }) {
    if (
        attachment?.filename !== contract.filename ||
        attachment?.mimeType !== contract.mimeType ||
        attachment?.contentSha256 !== contract.contentSha256
    ) {
        return rejection("demo_gmail_content_mismatch")
    }

    return acceptance("demo_gmail_content_accepted")
}

function requiredEmail(value, name) {
    const normalized = normalizeEmail(value)
    if (!normalized || !EMAIL_RE.test(normalized)) {
        throw configurationError(
            "demo_gmail_configuration_required",
            `${name} must contain one valid email address.`
        )
    }
    return normalized
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase()
}

function acceptance(reason = "accepted") {
    return Object.freeze({ accepted: true, reason })
}

function rejection(reason) {
    return Object.freeze({ accepted: false, reason })
}

function configurationError(reason, message) {
    return new DemoGmailIntakeConfigurationError(reason, message)
}
