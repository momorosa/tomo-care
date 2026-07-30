import test from "node:test"
import assert from "node:assert/strict"
import {
    SEND_LIBRELA_APPOINTMENT_REQUEST,
    buildSendLibrelaAppointmentRequestProposal,
    sha256,
} from "./librelaAppointmentRequest.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"
const ORCHESTRATION_RUN_ID = "77777777-7777-4777-8777-777777777777"
const REMINDER_ID = "11111111-1111-4111-8111-111111111111"
const INJECTION_ID = "22222222-2222-4222-8222-222222222222"
const CONTACT_ID = "33333333-3333-4333-8333-333333333333"
const MESSAGE_BODY =
    "Hello clinic,\n\nCould we schedule Momo’s next Librela injection?\n\nThank you,\nRosa"

function buildReminder(overrides = {}) {
    return {
        id: REMINDER_ID,
        pet_id: PET_ID,
        doc_id: "44444444-4444-4444-8444-444444444444",
        event_type: "reminder",
        event_date: "2026-07-22",
        status: "planned",
        updated_at: "2026-07-20T12:00:00.000Z",
        details_json: {
            subtype: "Librela",
            due_date: "2026-07-29",
            anchor_event_id: INJECTION_ID,
            source_org: "SoMa Animal Hospital",
        },
        ...overrides,
    }
}

function buildInjection(overrides = {}) {
    return {
        id: INJECTION_ID,
        pet_id: PET_ID,
        event_type: "injection",
        event_date: "2026-06-10",
        status: "verified",
        updated_at: "2026-06-10T18:00:00.000Z",
        details_json: { medication: "Librela" },
        ...overrides,
    }
}

function buildRecipient(overrides = {}) {
    return {
        id: CONTACT_ID,
        organization_name: "SoMa Animal Hospital",
        channel: "sms",
        address: buildTestSmsAddress(),
        verification_status: "verified",
        verification_source: "owner_confirmed_clinic_text_thread",
        verified_by: "Rosa",
        verified_at: "2026-07-28T17:00:00.000Z",
        is_active: true,
        updated_at: "2026-07-28T17:00:00.000Z",
        ...overrides,
    }
}

function buildProposal(overrides = {}) {
    return buildSendLibrelaAppointmentRequestProposal({
        petId: PET_ID,
        orchestrationRunId: ORCHESTRATION_RUN_ID,
        reminder: buildReminder(),
        injection: buildInjection(),
        recipient: buildRecipient(),
        messageBody: MESSAGE_BODY,
        requestSource: "dashboard",
        requestedBy: "Rosa",
        ...overrides,
    })
}

test("freezes the exact message, verified recipient identity, and Librela evidence", () => {
    const proposal = buildProposal()

    assert.equal(
        proposal.action_type,
        SEND_LIBRELA_APPOINTMENT_REQUEST
    )
    assert.equal(proposal.status, "proposed")
    assert.equal(
        proposal.orchestration_run_id,
        ORCHESTRATION_RUN_ID
    )
    assert.equal(proposal.source_event_id, REMINDER_ID)
    assert.equal(proposal.payload_json.message_body, MESSAGE_BODY)
    assert.equal(proposal.payload_json.message_sha256, sha256(MESSAGE_BODY))
    assert.equal(proposal.payload_json.provider_contact_id, CONTACT_ID)
    assert.equal(
        proposal.payload_json.last_verified_injection_date,
        "2026-06-10"
    )
    assert.equal(proposal.payload_json.due_date, "2026-07-29")
    assert.equal(proposal.evidence_json.length, 3)
})

test("does not expose the SMS address in preview, payload, or evidence JSON", () => {
    const recipient = buildRecipient()
    const serialized = JSON.stringify(buildProposal({ recipient }))

    assert.doesNotMatch(serialized, new RegExp(escapeRegex(recipient.address)))
    assert.equal(
        buildProposal({ recipient }).payload_json
            .recipient_fingerprint_sha256,
        sha256(`sms:${recipient.address}`)
    )
})

test("editing one character creates a different frozen message and idempotency key", () => {
    const original = buildProposal()
    const edited = buildProposal({
        messageBody: `${MESSAGE_BODY}!`,
    })

    assert.notEqual(
        edited.payload_json.message_sha256,
        original.payload_json.message_sha256
    )
    assert.notEqual(edited.idempotency_key, original.idempotency_key)
})

test("rejects an inactive, unverified, or mismatched recipient", () => {
    for (const recipient of [
        buildRecipient({ is_active: false }),
        buildRecipient({ verification_status: "unverified" }),
        buildRecipient({ organization_name: "Another Clinic" }),
    ]) {
        assert.throws(
            () => buildProposal({ recipient }),
            /recipient|clinic/i
        )
    }
})

test("rejects unrelated or changed Librela evidence", () => {
    assert.throws(
        () =>
            buildProposal({
                reminder: buildReminder({ status: "completed" }),
            }),
        /planned Librela reminder/
    )
    assert.throws(
        () =>
            buildProposal({
                injection: buildInjection({ status: "planned" }),
            }),
        /verified Librela/
    )
    assert.throws(
        () =>
            buildProposal({
                injection: buildInjection({
                    id: "55555555-5555-4555-8555-555555555555",
                }),
            }),
        /does not match/
    )
})

function buildTestSmsAddress() {
    return String.fromCharCode(
        43,
        49,
        52,
        49,
        53,
        53,
        53,
        53,
        48,
        49,
        57,
        57
    )
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
