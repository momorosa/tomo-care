import assert from "node:assert/strict"
import test from "node:test"

import { buildInsuranceClaimReminderPlan } from "./insuranceClaimReminder.js"

test("blocks insurance reminders for vaccination certificates", () => {
    const plan = buildInsuranceClaimReminderPlan({
        document: {
            id: "synthetic-certificate",
            pet_id: "synthetic-pet",
            status: "verified",
            doc_type: "vaccination_certificate",
            doc_date: "2026-04-12",
            text_extracted: {
                vaccine_evidence: [
                    {
                        care_item: "rabies",
                        source_record_type: "vaccination_certificate",
                    },
                ],
            },
        },
        careDate: "2026-04-13",
    })

    assert.equal(plan.actionable, false)
    assert.equal(plan.reason, "source_not_financial")
})

test("keeps verified receipt evidence eligible", () => {
    const plan = buildInsuranceClaimReminderPlan({
        document: {
            id: "synthetic-receipt",
            pet_id: "synthetic-pet",
            status: "verified",
            doc_type: "receipt",
            doc_date: "2026-04-12",
            title: "Synthetic veterinary receipt",
            source_org: "Fictional Veterinary Center",
            text_extracted: {
                invoice_id: "synthetic-invoice",
                cost_items: [{ label: "Office visit", amount: 44 }],
            },
        },
        careDate: "2026-04-13",
    })

    assert.equal(plan.actionable, true)
    assert.equal(plan.treatment_date, "2026-04-12")
})
