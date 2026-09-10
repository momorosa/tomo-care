import test from "node:test"
import assert from "node:assert/strict"
import {
    evaluateDemoGmailAccount,
    evaluateDemoGmailAttachment,
    evaluateDemoGmailEnvelope,
    getDemoGmailIntakeContract,
} from "./demoGmailIntakeContract.js"
import {
    DEMO_INTAKE_FIXTURE,
    DEMO_PET_ID,
    DEMO_PROJECT_URL,
    DEMO_STORAGE_PREFIX,
} from "./scenarioManifest.js"

const DEMO_ENV = Object.freeze({
    TOMOCARE_RUNTIME_MODE: "demo",
    SUPABASE_URL: DEMO_PROJECT_URL,
    TOMO_PET_ID: DEMO_PET_ID,
    DEMO_GMAIL_ALLOWED_SENDER: "demo-sender@example.com",
    DEMO_GMAIL_RECIPIENT: "demo-inbox@example.com",
})

test("builds one exact demo Gmail query and manifest-owned target", () => {
    const contract = getDemoGmailIntakeContract(DEMO_ENV)

    assert.match(contract.query, /from:demo-sender@example\.com/)
    assert.match(contract.query, /deliveredto:demo-inbox@example\.com/)
    assert.match(contract.query, /subject:"\[TomoCare Demo\]"/)
    assert.match(contract.query, /has:attachment/)
    assert.match(contract.query, /tomocare-demo-v1-harborlight-invoice\.pdf/)
    assert.equal(contract.documentId, DEMO_INTAKE_FIXTURE.documentId)
    assert.equal(contract.contentSha256, DEMO_INTAKE_FIXTURE.contentSha256)
    assert.equal(
        contract.storageKey,
        `${DEMO_STORAGE_PREFIX}/intake/${DEMO_INTAKE_FIXTURE.filename}`
    )
})

test("requires exact demo runtime, sender, and recipient configuration", () => {
    for (const env of [
        { ...DEMO_ENV, TOMOCARE_RUNTIME_MODE: "real" },
        { ...DEMO_ENV, DEMO_GMAIL_ALLOWED_SENDER: "" },
        { ...DEMO_ENV, DEMO_GMAIL_RECIPIENT: "not-an-email" },
    ]) {
        assert.throws(() => getDemoGmailIntakeContract(env))
    }
})

test("accepts only the configured account and exact direct-message envelope", () => {
    const contract = getDemoGmailIntakeContract(DEMO_ENV)

    assert.equal(
        evaluateDemoGmailAccount({
            authenticatedEmail: "DEMO-INBOX@example.com",
            contract,
        }).accepted,
        true
    )

    const accepted = evaluateDemoGmailEnvelope({
        fromEmail: "demo-sender@example.com",
        recipientEmails: ["demo-inbox@example.com"],
        subject: "[TomoCare Demo] Librela visit",
        isForwarded: false,
        attachmentParts: [
            {
                filename: DEMO_INTAKE_FIXTURE.filename,
                mimeType: DEMO_INTAKE_FIXTURE.mimeType,
            },
        ],
        contract,
    })

    assert.equal(accepted.accepted, true)
    assert.equal(accepted.attachmentParts.length, 1)
})

test("rejects a wrong account, sender, recipient, prefix, forward, filename, or MIME type", () => {
    const contract = getDemoGmailIntakeContract(DEMO_ENV)
    const base = {
        fromEmail: contract.senderEmail,
        recipientEmails: [contract.recipientEmail],
        subject: `${contract.subjectPrefix} Librela visit`,
        isForwarded: false,
        attachmentParts: [
            {
                filename: contract.filename,
                mimeType: contract.mimeType,
            },
        ],
        contract,
    }

    assert.equal(
        evaluateDemoGmailAccount({
            authenticatedEmail: "wrong@example.com",
            contract,
        }).accepted,
        false
    )

    for (const change of [
        { fromEmail: "wrong@example.com" },
        { recipientEmails: ["wrong@example.com"] },
        { subject: `Visit notes ${contract.subjectPrefix}` },
        { isForwarded: true },
        {
            attachmentParts: [
                { filename: "other.pdf", mimeType: contract.mimeType },
            ],
        },
        {
            attachmentParts: [
                { filename: contract.filename, mimeType: "text/plain" },
            ],
        },
    ]) {
        assert.equal(
            evaluateDemoGmailEnvelope({ ...base, ...change }).accepted,
            false
        )
    }
})

test("requires the exact approved PDF content hash", () => {
    const contract = getDemoGmailIntakeContract(DEMO_ENV)
    const attachment = {
        filename: contract.filename,
        mimeType: contract.mimeType,
        contentSha256: contract.contentSha256,
    }

    assert.equal(
        evaluateDemoGmailAttachment({ attachment, contract }).accepted,
        true
    )
    assert.equal(
        evaluateDemoGmailAttachment({
            attachment: { ...attachment, contentSha256: "0".repeat(64) },
            contract,
        }).accepted,
        false
    )
})
