import assert from "node:assert/strict"
import test from "node:test"

import { composeGroundedAnswer } from "./answerComposer.js"
import { buildQueryPlan } from "./queryPlanner.js"
import { buildTrustedContextFromRows } from "./trustedContext.js"

const DOC_ID = "81000000-0000-4000-8000-000000000001"
const EVENT_ID = "82000000-0000-4000-8000-000000000001"
const FACT_ID = "83000000-0000-4000-8000-000000000001"

function trustedContext({ clinicStatus = null } = {}) {
    return buildTrustedContextFromRows({
        petId: "80000000-0000-4000-8000-000000000001",
        documents: [
            {
                id: DOC_ID,
                title: "SYNTHETIC — Rabies vaccination certificate",
                doc_type: "vaccination_certificate",
                doc_date: "2026-04-12",
                source_org: "Fictional Veterinary Center",
                file_url: "synthetic/rabies-certificate.pdf",
                status: "verified",
            },
        ],
        events: [
            {
                id: EVENT_ID,
                doc_id: DOC_ID,
                event_type: "vaccine",
                event_date: "2026-04-12",
                status: "verified",
                details_json: {
                    care_item: "rabies",
                    evidence_type: "official_vaccination_certificate",
                },
            },
        ],
        facts: [
            {
                id: FACT_ID,
                doc_id: DOC_ID,
                fact_type: "preventive_care_status",
                fact_date: "2029-04-11",
                status: "verified",
                verified_at: "2026-08-26T12:00:00.000Z",
                value_json: {
                    care_kind: "vaccine",
                    care_item: "rabies",
                    clinic_reported_next_due: "2029-04-11",
                    clinic_reported_status: clinicStatus,
                },
            },
        ],
    })
}

function answer(question, context = trustedContext()) {
    const queryPlan = buildQueryPlan(question)
    return composeGroundedAnswer({ question, queryPlan, context })
}

test("routes and answers administration from certificate-backed event only", () => {
    const result = answer("When did Momo receive her Rabies vaccine?")

    assert.equal(result.query_plan.vaccine_focus, "administration")
    assert.match(result.answer, /April 12, 2026/)
    assert.equal(result.citations[0].id, EVENT_ID)
})

test("answers clinic-reported next due from its independent trusted fact", () => {
    const result = answer("When is Momo's Rabies vaccine due next?")

    assert.equal(result.query_plan.vaccine_focus, "next_due")
    assert.match(result.answer, /clinic-reported/i)
    assert.match(result.answer, /April 11, 2029/)
    assert.equal(result.citations[0].id, FACT_ID)
})

test("returns the verified certificate document with a source PDF citation", () => {
    const result = answer("Show me Momo's Rabies certificate.")

    assert.equal(result.query_plan.vaccine_focus, "certificate")
    assert.equal(result.citations[0].id, DOC_ID)
    assert.equal(result.citations[0].source_pdf_available, true)
})

test("does not infer clinic status from next due or today's date", () => {
    const result = answer("Is Momo's Rabies vaccine current?")

    assert.equal(result.query_plan.vaccine_focus, "clinic_reported_status")
    assert.match(result.answer, /won’t infer one/i)
    assert.equal(result.citations.length, 0)
})

test("repeats an explicit clinic status without medical interpretation", () => {
    const result = answer(
        "What is Momo's Rabies vaccine status?",
        trustedContext({ clinicStatus: "current" })
    )

    assert.match(result.answer, /clinic-reported.*current/i)
    assert.equal(result.citations[0].id, FACT_ID)
    assert.match(result.limitations[0], /without independently interpreting/i)
})
