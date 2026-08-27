export const INSURANCE_CLAIM_SUBTYPE = "Insurance claim"
export const INSURANCE_TARGET_SUBMIT_DAYS = 30
export const INSURANCE_ELIGIBILITY_WINDOW_DAYS = 180
export const INSURANCE_RULE_VERSION = "insurance_claim_v1"

function parseIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
        throw new Error(`Invalid date: ${value}`)
    }

    const [year, month, day] = value.split("-").map(Number)
    return new Date(Date.UTC(year, month - 1, day))
}

function addDays(dateString, days) {
    const date = parseIsoDate(dateString)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
}

function isFinancialSource(document) {
    if (document?.doc_type === "vaccination_certificate") return false

    const extracted = document?.text_extracted || {}
    return (
        document?.doc_type === "receipt" ||
        document?.doc_type === "invoice" ||
        Boolean(extracted.invoice_id) ||
        (Array.isArray(extracted.cost_items) &&
            extracted.cost_items.length > 0)
    )
}

export function buildInsuranceClaimReminderPlan({
    document,
    careDate,
    requestedBy = "rosa",
    insuranceProvider = "Nationwide",
    requestedAt = new Date().toISOString(),
} = {}) {
    if (document?.status !== "verified") {
        return {
            actionable: false,
            reason: "source_not_verified",
            message:
                "Document must be verified before TomoCare can create insurance claim reminders from it.",
        }
    }

    if (!isFinancialSource(document)) {
        return {
            actionable: false,
            reason: "source_not_financial",
            message:
                "Insurance claim reminders are available only for verified receipts or invoices with financial evidence.",
        }
    }

    if (!document.doc_date) {
        return {
            actionable: false,
            reason: "treatment_date_missing",
            message: "No treatment date was found for this verified document.",
        }
    }

    const targetSubmitDate = addDays(
        document.doc_date,
        INSURANCE_TARGET_SUBMIT_DAYS
    )
    const claimDeadlineDate = addDays(
        document.doc_date,
        INSURANCE_ELIGIBILITY_WINDOW_DAYS
    )

    if (claimDeadlineDate < careDate) {
        return {
            actionable: false,
            reason: "claim_window_expired",
            message:
                "This treatment date is outside the 180-day insurance claim eligibility window.",
            treatment_date: document.doc_date,
            claim_deadline_date: claimDeadlineDate,
        }
    }

    const targetHasArrived = targetSubmitDate <= careDate
    const reminderDate = targetHasArrived ? careDate : targetSubmitDate
    const timingState = targetHasArrived ? "due_now" : "upcoming"
    const message = targetHasArrived
        ? "It has been at least 30 days since the treatment date. Fill out your insurance claim now and get reimbursed."
        : "Submit this insurance claim within 30 days of the treatment date if possible."

    return {
        actionable: true,
        treatment_date: document.doc_date,
        target_submit_date: targetSubmitDate,
        claim_deadline_date: claimDeadlineDate,
        reminder_date: reminderDate,
        timing_state: timingState,
        payload: {
            pet_id: document.pet_id,
            doc_id: document.id,
            event_type: "reminder",
            event_date: reminderDate,
            status: "planned",
            details_json: {
                subtype: INSURANCE_CLAIM_SUBTYPE,
                action_type: "create_insurance_claim_reminder",
                rule_version: INSURANCE_RULE_VERSION,
                insurance_provider: insuranceProvider,
                treatment_date: document.doc_date,
                target_submit_date: targetSubmitDate,
                claim_deadline_date: claimDeadlineDate,
                due_date: claimDeadlineDate,
                target_submit_days: INSURANCE_TARGET_SUBMIT_DAYS,
                eligibility_window_days:
                    INSURANCE_ELIGIBILITY_WINDOW_DAYS,
                timing_state: timingState,
                message,
                source_document_id: document.id,
                source_document_title: document.title,
                source_org: document.source_org,
                requested_by: requestedBy,
                requested_at: requestedAt,
                created_from: "post_verify_action",
                calendar_sync_status: "not_synced",
            },
        },
    }
}
