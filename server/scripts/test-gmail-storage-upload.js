import { fetchCanonicalReceiptEmails } from "../gmail/gmailInbox.js"
import process from "node:process"
import {
    buildGmailStorageKey,
    uploadPdfToTomoDocs,
} from "../gmail/storage.js"

const TOMO_PET_ID = process.env.TOMO_PET_ID?.trim();

if (!TOMO_PET_ID) {
    throw new Error("TOMO_PET_ID is required.");
}

const emails = await fetchCanonicalReceiptEmails({
    maxResults: 5,
})

console.log(`Found ${emails.length} email(s) with canonical receipt candidates.`)

let uploadedCount = 0

for (const email of emails) {
    for (const attachment of email.attachments) {
        const storageKey = buildGmailStorageKey({
            petId: TOMO_PET_ID,
            receivedAt: email.receivedAt,
            filename: attachment.filename,
            contentSha256: attachment.contentSha256,
        })

        console.log("\nUploading:")
        console.log({
            gmailMsgId: email.gmailMsgId,
            filename: attachment.filename,
            contentSha256: attachment.contentSha256,
            storageKey,
        })

        const uploaded = await uploadPdfToTomoDocs({
            storageKey,
            buffer: attachment.data,
            upsert: false,
        })

        uploadedCount += 1

        console.log("Uploaded:")
        console.log(uploaded)
    }
}

console.log(`\nDone. Uploaded ${uploadedCount} PDF(s) to tomo-docs.`)
