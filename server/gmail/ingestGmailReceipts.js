import process from "node:process"
import { fetchCanonicalReceiptEmails } from "./gmailInbox.js"
import { buildGmailStorageKey } from "./storageKey.js"

const DEFAULT_PET_ID =
    process.env.TOMO_PET_ID || "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"

function inferDocType(attachment) {
    const filename = attachment.filename.toLowerCase()

    if (filename.includes("receipt")) return "receipt"
    if (filename.includes("lab")) return "lab_report"
    if (filename.includes("invoice")) return "receipt"

    return "document"
}

function buildDocumentTitle({ email, attachment }) {
    const org = email.originalSender?.name || email.originalSender?.email || "Gmail"
    return `${org} — ${attachment.filename}`
}

function isStorageAlreadyExistsError(error) {
    const message = String(error?.message || "").toLowerCase()
    const statusCode = error?.statusCode || error?.status

    return (
        statusCode === 409 ||
        message.includes("already exists") ||
        message.includes("duplicate") ||
        message.includes("the resource already exists")
    )
}

async function uploadOrReusePdf({ storageKey, buffer }) {
    try {
        const { uploadPdfToTomoDocs } = await import("./storage.js")
        const uploaded = await uploadPdfToTomoDocs({
            storageKey,
        buffer,
        upsert: false,
        })

        return {
            ...uploaded,
            uploaded: true,
            reusedExistingObject: false,
        }
    } catch (error) {
        if (isStorageAlreadyExistsError(error)) {
            return {
                bucket: "tomo-docs",
                storageKey,
                path: storageKey,
                uploaded: false,
                reusedExistingObject: true,
            }
        }

        throw error
    }
}

async function findExistingDocument({ contentSha256, storageKey }) {
    const { sbAdmin } = await import("../supabase.js")

    if (contentSha256) {
        const { data, error } = await sbAdmin
            .from("documents")
            .select("id, file_url, status, external_refs")
            .eq("external_refs->>content_sha256", contentSha256)
            .maybeSingle()

        if (error) throw error
        if (data) return data;
     }

    if (storageKey) {
        const { data, error } = await sbAdmin
            .from("documents")
            .select("id, file_url, status, external_refs")
            .eq("file_url", storageKey)
            .maybeSingle();

        if (error) throw error
        if (data) return data
    }

    return null
}

async function createDocumentRow({
    petId,
    email,
    attachment,
    storageKey,
}) {
    const { sbAdmin } = await import("../supabase.js")
    const payload = {
        pet_id: petId,
        doc_type: inferDocType(attachment),
        title: buildDocumentTitle({ email, attachment }),

        // Leave doc_date null for now.
        // The extractor/verification flow should determine the actual document date.
        doc_date: null,

        source_org:
            email.originalSender?.name ||
            email.originalSender?.email ||
            "Gmail",

        source_person: email.originalSender?.email || null,

        // Stable Supabase Storage key, not a signed URL.
        file_url: storageKey,

        status: "ingested",

        remarks: "Imported from TomoCare Gmail inbox.",

        external_refs: {
            source: "email",
            source_channel: "gmail",

            gmail_msg_id: email.gmailMsgId,
            gmail_thread_id: email.threadId,
            gmail_attachment_id: attachment.gmailAttachmentId,
            gmail_attachment_filename: attachment.filename,

            content_sha256: attachment.contentSha256,
            received_at: email.receivedAt,

            forwarded_by: email.forwardedBy,
            original_sender: email.originalSender,

            intake_reason: attachment.intakeReason,
        },
    }

    const { data, error } = await sbAdmin
        .from("documents")
        .insert(payload)
        .select(
            "id, pet_id, doc_type, title, file_url, status, source_org, source_person, external_refs"
        )
        .single()

    if (error) throw error

    return data;
}

export async function ingestGmailReceipts({
    petId = DEFAULT_PET_ID,
    maxResults = 25,
    dryRun = false,
    dependencies = {},
} = {}) {
    const fetchEmails =
        dependencies.fetchCanonicalReceiptEmails ||
        fetchCanonicalReceiptEmails
    const findDocument =
        dependencies.findExistingDocument || findExistingDocument
    const uploadPdf = dependencies.uploadOrReusePdf || uploadOrReusePdf
    const createDocument =
        dependencies.createDocumentRow || createDocumentRow

    const emails = await fetchEmails({
        maxResults,
    })

    const summary = {
        emailsFound: emails.length,
        attachmentsFound: 0,
        documentsCreated: 0,
        skippedDuplicates: 0,
        uploadedObjects: 0,
        reusedStorageObjects: 0,
        dryRun,
        items: [],
    }

    for (const email of emails) {
        for (const attachment of email.attachments) {
            summary.attachmentsFound += 1

            const storageKey = buildGmailStorageKey({
                petId,
                receivedAt: email.receivedAt,
                filename: attachment.filename,
                contentSha256: attachment.contentSha256,
            })

            const existingDoc = await findDocument({
                contentSha256: attachment.contentSha256,
                storageKey,
            })

            if (existingDoc) {
                summary.skippedDuplicates += 1
                summary.items.push({
                    action: "skip_duplicate_document",
                    gmailMsgId: email.gmailMsgId,
                    filename: attachment.filename,
                    contentSha256: attachment.contentSha256,
                    existingDocId: existingDoc.id,
                    existingStatus: existingDoc.status,
                    storageKey,
                })

                continue
            }

            if (dryRun) {
                summary.items.push({
                    action: "would_ingest",
                    gmailMsgId: email.gmailMsgId,
                    filename: attachment.filename,
                    contentSha256: attachment.contentSha256,
                    storageKey,
                })
                continue
            }

            const uploaded = await uploadPdf({
                storageKey,
                buffer: attachment.data,
            })

            if (uploaded.uploaded) {
                summary.uploadedObjects += 1
            }

            if (uploaded.reusedExistingObject) {
                summary.reusedStorageObjects += 1
            }

            const document = await createDocument({
                petId,
                email,
                attachment,
                storageKey,
            })

            summary.documentsCreated += 1

            summary.items.push({
                action: "created_document",
                documentId: document.id,
                gmailMsgId: email.gmailMsgId,
                filename: attachment.filename,
                contentSha256: attachment.contentSha256,
                storageKey,
                uploadedObject: uploaded.uploaded,
                reusedExistingObject: uploaded.reusedExistingObject,
                status: document.status,
            })
        }
    }

    return summary
}
