import assert from "node:assert/strict"
import test from "node:test"

import { classifyAttachment } from "./gmailInbox.js"
import {
    buildGmailDocumentProvenance,
    getInboxProcessingPlan,
} from "./documentProvenance.js"

test("ingests varied receipts, invoices, and Rabies certificates", () => {
    const cases = [
        ["receipt_demo.pdf", "canonical_receipt_pdf"],
        ["clinic-invoice-2026.pdf", "candidate_invoice_pdf"],
        ["poppy-rabies.pdf", "candidate_vaccine_evidence_pdf"],
        ["official-vaccination-certificate.pdf", "candidate_vaccine_evidence_pdf"],
        ["scanned-vet-record.pdf", "candidate_veterinary_pdf"],
    ]

    for (const [filename, reason] of cases) {
        assert.deepEqual(classifyAttachment({ filename }), {
            action: "ingest",
            reason,
        })
    }
})

test("keeps the known duplicate and non-PDF intake boundaries", () => {
    assert.equal(
        classifyAttachment({ filename: "invoice-breakdown.pdf" }).action,
        "skip"
    )
    assert.equal(
        classifyAttachment({ filename: "rabies-certificate.jpg" }).reason,
        "not_pdf"
    )
})

test("keeps Gmail sender identity out of the clinical source fields", () => {
    const result = buildGmailDocumentProvenance({
        forwardedBy: { name: "Rosa Choi", email: "owner@example.com" },
        originalSender: { name: "Rosa Choi", email: "owner@example.com" },
    })

    assert.equal(result.source_org, null)
    assert.equal(result.source_person, null)
    assert.equal(result.transport.original_sender.name, "Rosa Choi")
})

test("retries ingested duplicates while leaving reviewed records deduplicated", () => {
    const plan = getInboxProcessingPlan([
        {
            action: "created_document",
            documentId: "new-doc",
            filename: "certificate.pdf",
        },
        {
            action: "retry_existing_document",
            existingDocId: "stuck-doc",
            filename: "receipt.pdf",
        },
        {
            action: "skip_duplicate_document",
            existingDocId: "reviewed-doc",
            filename: "already-reviewed.pdf",
        },
    ])

    assert.deepEqual(plan, [
        {
            documentId: "new-doc",
            filename: "certificate.pdf",
            intakeAction: "created_document",
        },
        {
            documentId: "stuck-doc",
            filename: "receipt.pdf",
            intakeAction: "retry_existing_document",
        },
    ])
})
