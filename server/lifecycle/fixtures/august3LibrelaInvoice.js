import { Buffer } from "node:buffer"
import crypto from "node:crypto"

export const AUGUST_3_FIXTURE_IDS = Object.freeze({
    pet: "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95",
    document: "30000000-0000-4000-8000-000000000003",
    priorDocument: "30000000-0000-4000-8000-000000000002",
    priorInjection: "10000000-0000-4000-8000-000000000610",
    priorReminder: "20000000-0000-4000-8000-000000000729",
    priorWeight: "40000000-0000-4000-8000-000000000610",
    augustInjection: "10000000-0000-4000-8000-000000000803",
    augustWeight: "40000000-0000-4000-8000-000000000803",
    librelaReminder: "20000000-0000-4000-8000-000000000914",
    insuranceReminder: "20000000-0000-4000-8000-000000000902",
})

export const AUGUST_3_RAW_TEXT = `
SoMa Animal Hospital
Patient: Momo
Date: 08/03/2026
Weight: 15.1 kg

Nurse Office Visit                         $44.00
Injection Librela                         -$14.78
Librela 10 mg/ml Solution Vial             $99.53
Injection Librela                          $31.65
Total paid                                $160.40
`.trim()

export const AUGUST_3_EXTRACTED = Object.freeze({
    doc_type: "receipt",
    doc_date: "2026-08-03",
    source_org: "SoMa Animal Hospital",
    invoice_id: "fixture-2026-08-03",
    summary: "Librela nurse visit for Momo.",
    weight_measurement: {
        value: 15.1,
        unit: "kg",
        measured_date: "2026-08-03",
        source_label: "Weight",
        source_context: "Patient: Momo · Weight: 15.1 kg",
    },
    events: [],
    cost_items: [
        {
            service_date: "2026-08-03",
            category: "visit",
            label: "Nurse Office Visit",
            amount: 44,
            currency: "USD",
        },
        {
            service_date: "2026-08-03",
            category: "medication",
            label: "Injection Librela",
            amount: -14.78,
            currency: "USD",
        },
        {
            service_date: "2026-08-03",
            category: "medication",
            label: "Librela 10 mg/ml Solution Vial",
            amount: 99.53,
            currency: "USD",
        },
        {
            service_date: "2026-08-03",
            category: "medication",
            label: "Injection Librela",
            amount: 31.65,
            currency: "USD",
        },
    ],
    totals: { paid: 160.4, currency: "USD" },
    labs: [],
    confidence: 1,
    notes: "Sanitized deterministic lifecycle fixture.",
})

const REVIEW_PATHS = [
    "doc_date",
    "weight_measurement.value",
    "weight_measurement.unit",
    "weight_measurement.measured_date",
    "cost_items[0].label",
    "cost_items[0].amount",
    "cost_items[1].label",
    "cost_items[1].amount",
    "cost_items[2].label",
    "cost_items[2].amount",
    "cost_items[3].label",
    "cost_items[3].amount",
    "cost_items[3].service_date",
    "totals.paid",
    "summary",
]

export const AUGUST_3_TRIAGE = Object.freeze({
    model: "fixture-reviewer",
    created_at: "2026-08-12T18:00:00.000Z",
    overall_confidence: "medium",
    fields: REVIEW_PATHS.map((path) => ({
        path,
        state: "needs-confirmation",
        reason: "Human confirmation required by the lifecycle fixture.",
    })),
    notes: "All 15 flagged fields require explicit review.",
})

export function buildAugust3GmailFixture() {
    const data = Buffer.from(
        "Sanitized TomoCare fixture PDF bytes for August 3, 2026."
    )

    return {
        gmailMsgId: "gmail-fixture-2026-08-03",
        threadId: "gmail-thread-fixture-2026-08-03",
        receivedAt: "2026-08-03T18:00:00.000Z",
        subject: "Fwd: Momo receipt",
        isForwarded: true,
        forwardedBy: {
            name: "Fixture owner",
            email: "fixture-owner@example.invalid",
        },
        originalSender: {
            name: "SoMa Animal Hospital",
            email: "fixture-clinic@example.invalid",
        },
        attachments: [
            {
                filename: "receipt_momo_2026-08-03.pdf",
                mimeType: "application/pdf",
                sizeBytes: data.length,
                contentSha256: crypto
                    .createHash("sha256")
                    .update(data)
                    .digest("hex"),
                gmailAttachmentId: "fixture-attachment-1",
                intakeReason: "canonical_receipt_pdf",
                data,
            },
        ],
        skippedAttachments: [],
    }
}
