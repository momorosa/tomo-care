import test from "node:test"
import assert from "node:assert/strict"
import {
    MARK_INSURANCE_CLAIM_FILED,
    buildMarkInsuranceClaimFiledProposal,
} from "./insuranceClaimFiled.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"
const REMINDER_ID = "11111111-1111-4111-8111-111111111111"
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222"

function buildReminder(overrides = {}) {
    return {
        id: REMINDER_ID,
        pet_id: PET_ID,
        doc_id: DOCUMENT_ID,
        event_type: "reminder",
        event_date: "2026-05-14",
        status: "planned",
        updated_at: "2026-07-20T12:00:00.000Z",
        details_json: {
            subtype: "Insurance claim",
            action_type: "create_insurance_claim_reminder",
            insurance_provider: "Nationwide",
            treatment_date: "2026-04-14",
            target_submit_date: "2026-05-14",
            claim_deadline_date: "2026-10-11",
            source_document_id: DOCUMENT_ID,
            source_document_title: "SoMa Animal Hospital receipt",
        },
        ...overrides,
    }
}

function buildSourceDocument(overrides = {}) {
    return {
        id: DOCUMENT_ID,
        pet_id: PET_ID,
        title: "SoMa Animal Hospital receipt",
        doc_type: "receipt",
        doc_date: "2026-04-14",
        source_org: "SoMa Animal Hospital",
        status: "verified",
        ...overrides,
    }
}

function buildProposal(overrides = {}) {
    return buildMarkInsuranceClaimFiledProposal({
        petId: PET_ID,
        reminder: buildReminder(),
        sourceDocument: buildSourceDocument(),
        filedDate: "2026-07-24",
        currentCareDate: "2026-07-24",
        requestSource: "dashboard",
        requestedBy: "Rosa",
        ...overrides,
    })
}

test("builds a two-change claim-filing proposal without mutating evidence", () => {
    const reminder = buildReminder()
    const sourceDocument = buildSourceDocument()
    const reminderBefore = structuredClone(reminder)
    const documentBefore = structuredClone(sourceDocument)

    const proposal = buildProposal({ reminder, sourceDocument })

    assert.deepEqual(reminder, reminderBefore)
    assert.deepEqual(sourceDocument, documentBefore)
    assert.equal(proposal.action_type, MARK_INSURANCE_CLAIM_FILED)
    assert.equal(proposal.status, "proposed")
    assert.equal(proposal.source_event_id, REMINDER_ID)
    assert.equal(proposal.preview_json.changes.length, 2)
    assert.equal(
        proposal.preview_json.changes[0].record_type,
        "insurance_claim_submission"
    )
    assert.equal(proposal.payload_json.filed_date, "2026-07-24")
    assert.equal(proposal.payload_json.source_document_id, DOCUMENT_ID)
    assert.equal(proposal.evidence_json.length, 2)
})

test("creates a stable semantic idempotency key", () => {
    const first = buildProposal()
    const second = buildProposal()

    assert.equal(first.idempotency_key, second.idempotency_key)
    assert.equal(
        first.idempotency_key,
        `mark_insurance_claim_filed:${PET_ID}:${REMINDER_ID}:2026-07-24`
    )
})

test("rejects reminders from a different pet", () => {
    assert.throws(
        () =>
            buildProposal({
                reminder: buildReminder({
                    pet_id: "33333333-3333-4333-8333-333333333333",
                }),
            }),
        /does not belong to this pet/
    )
})

test("rejects reminders that are not planned insurance claims", () => {
    assert.throws(
        () => buildProposal({ reminder: buildReminder({ status: "completed" }) }),
        /Only a planned reminder/
    )

    assert.throws(
        () =>
            buildProposal({
                reminder: buildReminder({
                    details_json: {
                        ...buildReminder().details_json,
                        subtype: "Librela",
                    },
                }),
            }),
        /not an insurance-claim reminder/
    )
})

test("rejects unverified or mismatched source documents", () => {
    assert.throws(
        () =>
            buildProposal({
                sourceDocument: buildSourceDocument({ status: "ingested" }),
            }),
        /must still be verified/
    )

    assert.throws(
        () =>
            buildProposal({
                sourceDocument: buildSourceDocument({
                    id: "44444444-4444-4444-8444-444444444444",
                }),
            }),
        /does not match the verified source document/
    )
})

test("rejects a treatment date that no longer matches the source document", () => {
    assert.throws(
        () =>
            buildProposal({
                sourceDocument: buildSourceDocument({
                    doc_date: "2026-04-15",
                }),
            }),
        /Treatment date no longer matches/
    )
})

test("rejects future filing dates and dates before treatment", () => {
    assert.throws(
        () =>
            buildProposal({
                filedDate: "2026-07-25",
                currentCareDate: "2026-07-24",
            }),
        /cannot be in the future/
    )

    assert.throws(
        () => buildProposal({ filedDate: "2026-04-13" }),
        /cannot be before the treatment date/
    )
})

test("rejects incomplete claim evidence instead of inventing it", () => {
    assert.throws(
        () =>
            buildProposal({
                reminder: buildReminder({
                    details_json: {
                        ...buildReminder().details_json,
                        claim_deadline_date: null,
                    },
                }),
            }),
        /claim_deadline_date must be a valid ISO date/
    )
})