import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { fetchCanonicalReceiptEmails } from "./gmailInbox.js"
import { getDemoGmailIntakeContract } from "../demo/demoGmailIntakeContract.js"
import {
    DEMO_PET_ID,
    DEMO_PROJECT_URL,
} from "../demo/scenarioManifest.js"

const DEMO_ENV = Object.freeze({
    TOMOCARE_RUNTIME_MODE: "demo",
    SUPABASE_URL: DEMO_PROJECT_URL,
    TOMO_PET_ID: DEMO_PET_ID,
    DEMO_GMAIL_ALLOWED_SENDER: "demo-sender@example.com",
    DEMO_GMAIL_RECIPIENT: "demo-inbox@example.com",
})

const FIXTURE_URL = new URL(
    "../../demo/fixtures/tomocare-demo-v1-harborlight-invoice.pdf",
    import.meta.url
)

function gmailMessage(contract, overrides = {}) {
    return {
        id: "message-1",
        threadId: "thread-1",
        internalDate: String(Date.parse("2026-09-08T12:00:00.000Z")),
        payload: {
            mimeType: "multipart/mixed",
            headers: [
                { name: "From", value: contract.senderEmail },
                { name: "To", value: contract.recipientEmail },
                {
                    name: "Subject",
                    value: `${contract.subjectPrefix} Librela visit`,
                },
            ],
            parts: [
                {
                    filename: contract.filename,
                    mimeType: contract.mimeType,
                    body: {
                        attachmentId: "attachment-1",
                        size: 1,
                    },
                },
            ],
        },
        ...overrides,
    }
}

test("queries the allowlisted demo envelope and downloads only the approved PDF", async () => {
    const contract = getDemoGmailIntakeContract(DEMO_ENV)
    const pdfBytes = await readFile(fileURLToPath(FIXTURE_URL))
    let query = null
    let attachmentDownloads = 0
    const gmail = {
        users: {
            async getProfile() {
                return { data: { emailAddress: contract.recipientEmail } }
            },
            messages: {
                async list(input) {
                    query = input.q
                    return { data: { messages: [{ id: "message-1" }] } }
                },
                async get() {
                    return { data: gmailMessage(contract) }
                },
                attachments: {
                    async get() {
                        attachmentDownloads += 1
                        return {
                            data: {
                                data: pdfBytes.toString("base64url"),
                            },
                        }
                    },
                },
            },
        },
    }

    const emails = await fetchCanonicalReceiptEmails({
        env: DEMO_ENV,
        dependencies: { gmail },
    })

    assert.equal(query, contract.query)
    assert.equal(attachmentDownloads, 1)
    assert.equal(emails.length, 1)
    assert.equal(emails[0].attachments.length, 1)
    assert.equal(emails[0].attachments[0].contentSha256, contract.contentSha256)
    assert.equal(emails[0].demoSenderVerified, true)
    assert.equal(emails[0].originalSender.email, null)
})

test("rejects a subject that contains but does not start with the marker before download", async () => {
    const contract = getDemoGmailIntakeContract(DEMO_ENV)
    let attachmentDownloads = 0
    const message = gmailMessage(contract)
    message.payload.headers = message.payload.headers.map((header) =>
        header.name === "Subject"
            ? {
                  ...header,
                  value: `Librela visit ${contract.subjectPrefix}`,
              }
            : header
    )
    const gmail = {
        users: {
            async getProfile() {
                return { data: { emailAddress: contract.recipientEmail } }
            },
            messages: {
                async list() {
                    return { data: { messages: [{ id: "message-1" }] } }
                },
                async get() {
                    return { data: message }
                },
                attachments: {
                    async get() {
                        attachmentDownloads += 1
                        throw new Error("must not download")
                    },
                },
            },
        },
    }

    const emails = await fetchCanonicalReceiptEmails({
        env: DEMO_ENV,
        dependencies: { gmail },
    })

    assert.equal(attachmentDownloads, 0)
    assert.equal(emails[0].attachments.length, 0)
    assert.equal(
        emails[0].skippedAttachments[0].reason,
        "demo_gmail_subject_mismatch"
    )
})

test("stops before mailbox search when OAuth is connected to the wrong recipient", async () => {
    let listCalled = false
    const gmail = {
        users: {
            async getProfile() {
                return { data: { emailAddress: "wrong@example.com" } }
            },
            messages: {
                async list() {
                    listCalled = true
                },
            },
        },
    }

    await assert.rejects(
        () =>
            fetchCanonicalReceiptEmails({
                env: DEMO_ENV,
                dependencies: { gmail },
            }),
        (error) => error.reason === "demo_gmail_account_mismatch"
    )
    assert.equal(listCalled, false)
})
