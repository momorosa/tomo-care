import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { Buffer } from "node:buffer"
import { DEMO_INTAKE_FIXTURE as fixture } from "../demo/scenarioManifest.js"
import { fetchCanonicalReceiptEmails } from "./gmailInbox.js"
import { ingestGmailReceipts } from "./ingestGmailReceipts.js"
import { getDocumentProcessingDecision } from "./documentProcessingDecision.js"
import { isKnownDemoSource, DEMO_SOURCE_EXCLUDED } from "./realCareDemoGuard.js"

const env = { TOMOCARE_RUNTIME_MODE: "real", TOMO_PET_ID: "real-pet" }

function mockMailbox({ subject, filename, bytes }) {
    let downloads = 0
    return {
        get downloads() { return downloads },
        gmail: { users: { messages: {
            async list() { return { data: { messages: [{ id: "message" }] } } },
            async get() { return { data: {
                id: "message",
                payload: {
                    headers: [{ name: "Subject", value: subject }],
                    parts: [{ filename, mimeType: "application/pdf", body: { attachmentId: "pdf" } }],
                },
            } } },
            attachments: { async get() {
                downloads += 1
                return { data: { data: bytes.toString("base64url") } }
            } },
        } } },
    }
}

test("private care excludes the marked message and exact filename before downloading", async () => {
    for (const input of [
        { subject: "Fwd: [TomoCare Demo] Librela visit", filename: "renamed.pdf" },
        { subject: "Clinic invoice", filename: fixture.filename.toUpperCase() },
    ]) {
        const mailbox = mockMailbox({ ...input, bytes: Buffer.from("unused") })
        const result = await fetchCanonicalReceiptEmails({ env, dependencies: { gmail: mailbox.gmail } })
        assert.equal(mailbox.downloads, 0)
        assert.equal(result[0].attachments.length, 0)
        assert.equal(result[0].skippedAttachments[0].reason, DEMO_SOURCE_EXCLUDED)
    }
})

test("renaming the fixture and removing the subject marker cannot bypass its fingerprint", async () => {
    const bytes = await readFile(new URL(`../../demo/fixtures/${fixture.filename}`, import.meta.url))
    const mailbox = mockMailbox({ subject: "Clinic invoice", filename: "new-invoice.pdf", bytes })
    const result = await fetchCanonicalReceiptEmails({ env, dependencies: { gmail: mailbox.gmail } })
    assert.equal(mailbox.downloads, 1)
    assert.equal(result[0].attachments.length, 0)
    assert.equal(result[0].skippedAttachments[0].reason, DEMO_SOURCE_EXCLUDED)
})

test("ordinary clinic documents with the word demo remain eligible", async () => {
    const mailbox = mockMailbox({ subject: "Visit notes", filename: "receipt_demo.pdf", bytes: Buffer.from("different source") })
    const result = await fetchCanonicalReceiptEmails({ env, dependencies: { gmail: mailbox.gmail } })
    assert.equal(result[0].attachments.length, 1)
    assert.equal(isKnownDemoSource({ filename: "sample-invoice.pdf" }), false)
})

test("the ingestion boundary independently rejects the fixture before lookup, retry, or writes", async () => {
    for (const dryRun of [false, true]) {
        let calls = 0
        const unexpected = async () => { calls += 1; throw new Error("must not access persisted state") }
        const result = await ingestGmailReceipts({ env, dryRun, dependencies: {
            async fetchCanonicalReceiptEmails() { return [{
                subject: "Invoice", attachments: [{ filename: "renamed.pdf", contentSha256: fixture.contentSha256 }],
            }] },
            findExistingDocument: unexpected,
            uploadOrReusePdf: unexpected,
            createDocumentRow: unexpected,
        } })
        assert.equal(calls, 0)
        assert.equal(result.documentsCreated, 0)
        assert.equal(result.retryableDocuments, 0)
        assert.equal(result.rejectedAttachments, 1)
    }
})

test("exclusions reported by Gmail remain visible in the intake summary", async () => {
    const result = await ingestGmailReceipts({ env, dependencies: {
        async fetchCanonicalReceiptEmails() { return [{ attachments: [], skippedAttachments: [{ filename: fixture.filename, reason: DEMO_SOURCE_EXCLUDED }] }] },
    } })
    assert.equal(result.rejectedAttachments, 1)
    assert.equal(result.items[0].reason, DEMO_SOURCE_EXCLUDED)
})

test("previously saved synthetic sources cannot be manually retried in private care", () => {
    for (const identity of [
        { external_refs: { content_sha256: fixture.contentSha256 } },
        { external_refs: { gmail_attachment_filename: fixture.filename } },
        { id: fixture.documentId },
        { file_url: fixture.storageKey },
        { external_refs: { demo_owned: true } },
    ]) {
        const document = { status: "ingested", ...identity }
        assert.equal(getDocumentProcessingDecision(document, { runtimeMode: "real" }).allowed, false)
        assert.equal(getDocumentProcessingDecision(document, { runtimeMode: "demo" }).allowed, true)
    }
    assert.equal(getDocumentProcessingDecision({ status: "ingested" }, { runtimeMode: "real" }).allowed, true)
    assert.equal(getDocumentProcessingDecision({ status: "verified" }, { runtimeMode: "demo" }).allowed, false)
})
