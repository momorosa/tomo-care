import test from "node:test"
import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import {
    buildGmailDocumentPayload,
    ingestGmailReceipts,
} from "./ingestGmailReceipts.js"
import { getDemoGmailIntakeContract } from "../demo/demoGmailIntakeContract.js"
import {
    DEMO_PET_ID,
    DEMO_PROJECT_URL,
} from "../demo/scenarioManifest.js"

const DEMO_ENV = Object.freeze({
    TOMOCARE_RUNTIME_MODE: "demo",
    SUPABASE_URL: DEMO_PROJECT_URL,
    TOMO_PET_ID: DEMO_PET_ID,
    DEMO_GMAIL_ALLOWED_SENDER: "private-demo-sender@example.com",
    DEMO_GMAIL_RECIPIENT: "private-demo-inbox@example.com",
})

function acceptedEmail(contract) {
    return {
        gmailMsgId: "demo-message-id",
        threadId: "demo-thread-id",
        receivedAt: "2026-09-08T12:00:00.000Z",
        subject: `${contract.subjectPrefix} Librela visit`,
        demoSenderVerified: true,
        demoRecipientVerified: true,
        forwardedBy: { name: null, email: null },
        originalSender: { name: null, email: null },
        attachments: [
            {
                filename: contract.filename,
                mimeType: contract.mimeType,
                contentSha256: contract.contentSha256,
                gmailAttachmentId: "demo-attachment-id",
                intakeReason: "allowlisted_demo_invoice",
                data: Buffer.from("synthetic fixture bytes"),
            },
        ],
    }
}

test("uses the deterministic demo document and Storage identities", async () => {
    const contract = getDemoGmailIntakeContract(DEMO_ENV)
    const calls = []

    const result = await ingestGmailReceipts({
        env: DEMO_ENV,
        dependencies: {
            async fetchCanonicalReceiptEmails({ env }) {
                assert.equal(env, DEMO_ENV)
                return [acceptedEmail(contract)]
            },
            async findExistingDocument(input) {
                calls.push(["find", input])
                return null
            },
            async uploadOrReusePdf(input) {
                calls.push(["upload", input.storageKey])
                return {
                    uploaded: true,
                    reusedExistingObject: false,
                }
            },
            async createDocumentRow(input) {
                calls.push(["create", input])
                return { id: input.documentId, status: "ingested" }
            },
        },
    })

    assert.equal(result.documentsCreated, 1)
    assert.equal(result.uploadedObjects, 1)
    assert.equal(calls[0][1].documentId, contract.documentId)
    assert.equal(calls[0][1].storageKey, contract.storageKey)
    assert.equal(calls[1][1], contract.storageKey)
    assert.equal(calls[2][1].documentId, contract.documentId)
    assert.deepEqual(calls[2][1].demoContract, contract)
})

test("rechecking the inbox reuses the matching document without uploading or creating", async () => {
    const contract = getDemoGmailIntakeContract(DEMO_ENV)
    let uploadCalled = false
    let createCalled = false

    const result = await ingestGmailReceipts({
        env: DEMO_ENV,
        dependencies: {
            async fetchCanonicalReceiptEmails() {
                return [acceptedEmail(contract)]
            },
            async findExistingDocument() {
                return {
                    id: contract.documentId,
                    file_url: contract.storageKey,
                    status: "needs_review",
                    external_refs: {
                        content_sha256: contract.contentSha256,
                    },
                }
            },
            async uploadOrReusePdf() {
                uploadCalled = true
            },
            async createDocumentRow() {
                createCalled = true
            },
        },
    })

    assert.equal(result.documentsCreated, 0)
    assert.equal(result.skippedDuplicates, 1)
    assert.equal(uploadCalled, false)
    assert.equal(createCalled, false)
})

test("rejects changed fixture bytes before Storage or database mutation", async () => {
    const contract = getDemoGmailIntakeContract(DEMO_ENV)
    const email = acceptedEmail(contract)
    email.attachments[0].contentSha256 = "0".repeat(64)
    let mutated = false

    const result = await ingestGmailReceipts({
        env: DEMO_ENV,
        dependencies: {
            async fetchCanonicalReceiptEmails() {
                return [email]
            },
            async findExistingDocument() {
                mutated = true
            },
            async uploadOrReusePdf() {
                mutated = true
            },
            async createDocumentRow() {
                mutated = true
            },
        },
    })

    assert.equal(result.rejectedAttachments, 1)
    assert.equal(result.documentsCreated, 0)
    assert.equal(mutated, false)
})

test("demo document provenance records validation without personal addresses", () => {
    const contract = getDemoGmailIntakeContract(DEMO_ENV)
    const email = acceptedEmail(contract)
    const payload = buildGmailDocumentPayload({
        petId: contract.petId,
        email,
        attachment: email.attachments[0],
        storageKey: contract.storageKey,
        documentId: contract.documentId,
        demoContract: contract,
    })
    const serialized = JSON.stringify(payload)

    assert.equal(payload.id, contract.documentId)
    assert.equal(payload.file_url, contract.storageKey)
    assert.equal(payload.external_refs.demo_sender_verified, true)
    assert.equal(payload.external_refs.demo_recipient_verified, true)
    assert.equal(payload.external_refs.scenario_id, contract.scenarioId)
    assert.doesNotMatch(serialized, /private-demo-(sender|inbox)/)
})
