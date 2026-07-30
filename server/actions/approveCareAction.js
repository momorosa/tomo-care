import {
    MARK_HOME_MEDICATION_GIVEN,
    buildMarkHomeMedicationGivenProposal,
} from "./homeMedicationGiven.js"
import {
    MARK_INSURANCE_CLAIM_FILED,
    buildMarkInsuranceClaimFiledProposal,
} from "./insuranceClaimFiled.js"
import {
    SEND_LIBRELA_APPOINTMENT_REQUEST,
    buildSendLibrelaAppointmentRequestProposal,
} from "./librelaAppointmentRequest.js"

const SUPPORTED_ACTION_TYPES = new Set([
    MARK_HOME_MEDICATION_GIVEN,
    MARK_INSURANCE_CLAIM_FILED,
    SEND_LIBRELA_APPOINTMENT_REQUEST,
])

export class ActionApprovalError extends Error {
    constructor({ status, reason, message, cause }) {
        super(message, cause ? { cause } : undefined)
        this.name = "ActionApprovalError"
        this.status = status
        this.reason = reason
    }
}

export async function approveCareAction({
    repository,
    actionId,
    approvedBy,
    currentCareDate,
    approvedAt = new Date().toISOString(),
}) {
    assertRepository(repository)
    assertRequiredString(actionId, "actionId")
    assertRequiredString(approvedBy, "approvedBy")

    const action = await repository.findActionById(actionId)

    if (!action) {
        throw approvalError(
            404,
            "action_not_found",
            "The proposed care action was not found."
        )
    }

    if (!SUPPORTED_ACTION_TYPES.has(action.action_type)) {
        throw approvalError(
            409,
            "unsupported_action_type",
            `Approval is not implemented for action type: ${action.action_type}`
        )
    }

    if (action.status === "approved") {
        return {
            disposition: "existing",
            action,
        }
    }

    if (action.status !== "proposed") {
        throw approvalError(
            409,
            "action_not_proposed",
            `Only a proposed action can be approved. Current status: ${action.status}`
        )
    }

    await assertSourceEvidenceIsCurrent({
        repository,
        action,
        currentCareDate,
    })

    const approvedAction = await repository.approveProposedAction({
        actionId: action.id,
        approvedBy,
        approvedAt,
        expectedUpdatedAt: action.updated_at,
    })

    if (approvedAction) {
        return {
            disposition: "approved",
            action: approvedAction,
        }
    }

    // The conditional update may lose a race to another request. Reload the
    // action and treat an already-approved result as an idempotent success.
    const latestAction = await repository.findActionById(action.id)

    if (latestAction?.status === "approved") {
        return {
            disposition: "existing",
            action: latestAction,
        }
    }

    throw approvalError(
        409,
        "action_state_changed",
        "The action changed while approval was being recorded. Review it again."
    )
}

async function assertSourceEvidenceIsCurrent({
    repository,
    action,
    currentCareDate,
}) {
    if (action.action_type === MARK_HOME_MEDICATION_GIVEN) {
        return assertHomeMedicationEvidenceIsCurrent({
            repository,
            action,
            currentCareDate,
        })
    }

    if (action.action_type === MARK_INSURANCE_CLAIM_FILED) {
        return assertInsuranceClaimEvidenceIsCurrent({
            repository,
            action,
            currentCareDate,
        })
    }

    if (action.action_type === SEND_LIBRELA_APPOINTMENT_REQUEST) {
        return assertLibrelaAppointmentEvidenceIsCurrent({
            repository,
            action,
        })
    }
}

async function assertHomeMedicationEvidenceIsCurrent({
    repository,
    action,
    currentCareDate,
}) {
    const payload = action.payload_json || {}

    assertReminderSnapshotContract({ action, payload })

    const reminder = await loadCurrentReminder({
        repository,
        action,
        payload,
    })

    let rebuiltProposal

    try {
        rebuiltProposal = buildMarkHomeMedicationGivenProposal({
            petId: action.pet_id,
            reminder,
            administeredDate: payload.administered_date,
            requestSource: action.request_source,
            requestedBy: action.requested_by,
            currentCareDate,
        })
    } catch (error) {
        throw new ActionApprovalError({
            status: 409,
            reason: "action_no_longer_eligible",
            message:
                error?.message ||
                "The care action is no longer eligible for approval.",
            cause: error,
        })
    }

    if (rebuiltProposal.idempotency_key !== action.idempotency_key) {
        throw approvalError(
            409,
            "invalid_action_contract",
            "The proposed action no longer matches its trusted evidence."
        )
    }
}

async function assertInsuranceClaimEvidenceIsCurrent({
    repository,
    action,
    currentCareDate,
}) {
    const payload = action.payload_json || {}

    assertReminderSnapshotContract({ action, payload })

    if (
        typeof payload.source_document_id !== "string" ||
        !payload.source_document_id.trim()
    ) {
        throw approvalError(
            409,
            "invalid_action_contract",
            "The proposed action is missing its verified document snapshot."
        )
    }

    if (typeof repository.findVerifiedDocument !== "function") {
        throw new Error("repository.findVerifiedDocument is required.")
    }

    const [reminder, sourceDocument] = await Promise.all([
        loadCurrentReminder({ repository, action, payload }),
        repository.findVerifiedDocument({
            petId: action.pet_id,
            documentId: payload.source_document_id,
        }),
    ])

    if (!sourceDocument) {
        throw approvalError(
            409,
            "source_evidence_missing",
            "The verified source document no longer exists or is no longer verified. Prepare a new action."
        )
    }

    const sourceDocumentChanged =
        sourceDocument.status !== payload.source_document_status ||
        sourceDocument.title !== payload.source_document_title ||
        sourceDocument.doc_date !== payload.source_document_date ||
        (sourceDocument.source_org || null) !== payload.source_org

    if (sourceDocumentChanged) {
        throw approvalError(
            409,
            "source_evidence_changed",
            "The verified source document changed after this proposal was prepared. Review and prepare it again."
        )
    }

    let rebuiltProposal

    try {
        rebuiltProposal = buildMarkInsuranceClaimFiledProposal({
            petId: action.pet_id,
            reminder,
            sourceDocument,
            filedDate: payload.filed_date,
            requestSource: action.request_source,
            requestedBy: action.requested_by,
            currentCareDate,
        })
    } catch (error) {
        throw new ActionApprovalError({
            status: 409,
            reason: "action_no_longer_eligible",
            message:
                error?.message ||
                "The insurance claim action is no longer eligible for approval.",
            cause: error,
        })
    }

    const frozenProposalMatches =
        rebuiltProposal.idempotency_key === action.idempotency_key &&
        jsonMatches(rebuiltProposal.preview_json, action.preview_json) &&
        jsonMatches(rebuiltProposal.payload_json, action.payload_json) &&
        jsonMatches(rebuiltProposal.evidence_json, action.evidence_json)

    if (!frozenProposalMatches) {
        throw approvalError(
            409,
            "invalid_action_contract",
            "The proposed action no longer matches its trusted evidence."
        )
    }
}

async function assertLibrelaAppointmentEvidenceIsCurrent({
    repository,
    action,
}) {
    const payload = action.payload_json || {}

    assertReminderSnapshotContract({ action, payload })

    for (const field of [
        "injection_event_id",
        "injection_event_updated_at",
        "provider_contact_id",
        "provider_contact_updated_at",
        "message_body",
        "message_sha256",
    ]) {
        if (typeof payload[field] !== "string" || !payload[field].trim()) {
            throw approvalError(
                409,
                "invalid_action_contract",
                "The proposed outbound request is missing frozen evidence."
            )
        }
    }

    for (const method of ["findEvent", "findVerifiedProviderContactById"]) {
        if (typeof repository[method] !== "function") {
            throw new Error(`repository.${method} is required.`)
        }
    }

    const [reminder, injection, recipient] = await Promise.all([
        loadCurrentReminder({ repository, action, payload }),
        repository.findEvent({
            petId: action.pet_id,
            eventId: payload.injection_event_id,
        }),
        repository.findVerifiedProviderContactById(
            payload.provider_contact_id
        ),
    ])

    if (!injection || !recipient) {
        throw approvalError(
            409,
            "source_evidence_missing",
            "The verified injection or clinic recipient is no longer available. Prepare a new request."
        )
    }

    if (
        injection.updated_at !== payload.injection_event_updated_at ||
        recipient.updated_at !== payload.provider_contact_updated_at
    ) {
        throw approvalError(
            409,
            "source_evidence_changed",
            "The verified injection or clinic recipient changed after this request was prepared."
        )
    }

    let rebuiltProposal

    try {
        rebuiltProposal = buildSendLibrelaAppointmentRequestProposal({
            petId: action.pet_id,
            orchestrationRunId: action.orchestration_run_id,
            reminder,
            injection,
            recipient,
            messageBody: payload.message_body,
            requestSource: action.request_source,
            requestedBy: action.requested_by,
        })
    } catch (error) {
        throw new ActionApprovalError({
            status: 409,
            reason: "action_no_longer_eligible",
            message:
                error?.message ||
                "The Librela appointment request is no longer eligible for approval.",
            cause: error,
        })
    }

    const frozenProposalMatches =
        rebuiltProposal.orchestration_run_id ===
            action.orchestration_run_id &&
        rebuiltProposal.idempotency_key === action.idempotency_key &&
        jsonMatches(rebuiltProposal.preview_json, action.preview_json) &&
        jsonMatches(rebuiltProposal.payload_json, action.payload_json) &&
        jsonMatches(rebuiltProposal.evidence_json, action.evidence_json)

    if (!frozenProposalMatches) {
        throw approvalError(
            409,
            "invalid_action_contract",
            "The proposed outbound request no longer matches the exact message and trusted recipient that were reviewed."
        )
    }
}

function assertReminderSnapshotContract({ action, payload }) {
    if (
        payload.schema_version !== 1 ||
        payload.pet_id !== action.pet_id ||
        payload.source_reminder_id !== action.source_event_id ||
        typeof payload.source_reminder_updated_at !== "string" ||
        !payload.source_reminder_updated_at
    ) {
        throw approvalError(
            409,
            "invalid_action_contract",
            "The proposed action is missing its trusted reminder snapshot."
        )
    }
}

async function loadCurrentReminder({ repository, action, payload }) {
    const reminder = await repository.findReminder({
        petId: action.pet_id,
        reminderId: action.source_event_id,
    })

    if (!reminder) {
        throw approvalError(
            409,
            "source_evidence_missing",
            "The trusted reminder no longer exists. Prepare a new action."
        )
    }

    if (reminder.updated_at !== payload.source_reminder_updated_at) {
        throw approvalError(
            409,
            "source_evidence_changed",
            "The trusted reminder changed after this proposal was prepared. Review and prepare it again."
        )
    }

    return reminder
}

function jsonMatches(left, right) {
    return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right))
}

function sortJson(value) {
    if (Array.isArray(value)) {
        return value.map(sortJson)
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, sortJson(value[key])])
        )
    }

    return value
}

function assertRepository(repository) {
    const requiredMethods = [
        "findActionById",
        "findReminder",
        "approveProposedAction",
    ]

    for (const method of requiredMethods) {
        if (typeof repository?.[method] !== "function") {
            throw new Error(`repository.${method} is required.`)
        }
    }
}

function assertRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw approvalError(400, "invalid_request", `${label} is required.`)
    }
}

function approvalError(status, reason, message) {
    return new ActionApprovalError({ status, reason, message })
}
