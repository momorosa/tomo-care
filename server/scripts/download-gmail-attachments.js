import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_REDIRECT_URI,
} = process.env;

if (
  !GMAIL_CLIENT_ID ||
  !GMAIL_CLIENT_SECRET ||
  !GMAIL_REFRESH_TOKEN ||
  !GMAIL_REDIRECT_URI
) {
  throw new Error("Missing one or more Gmail OAuth env vars.");
}

const messageId = process.argv[2];

if (!messageId) {
  throw new Error(
    "Pass a Gmail message ID. Example: node server/scripts/download-gmail-attachments.js 19eaea7633a7df96"
  );
}

const oauth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({
  version: "v1",
  auth: oauth2Client,
});

function collectAttachments(part, results = []) {
  if (!part) return results;

  if (part.filename && part.body?.attachmentId) {
    results.push({
      filename: part.filename,
      mimeType: part.mimeType,
      attachmentId: part.body.attachmentId,
      size: part.body.size,
    });
  }

  if (part.parts) {
    for (const child of part.parts) {
      collectAttachments(child, results);
    }
  }

  return results;
}

function classifyAttachment(file) {
  const filename = file.filename.toLowerCase();

  if (!filename.endsWith(".pdf")) {
    return {
      action: "skip",
      reason: "not_pdf",
    };
  }

  if (filename.includes("invoice-breakdown")) {
    return {
      action: "skip",
      reason: "known_duplicate_invoice_breakdown",
    };
  }

  if (filename.startsWith("receipt_") || filename.includes("receipt")) {
    return {
      action: "ingest",
      reason: "canonical_receipt_pdf",
    };
  }

  return {
    action: "skip",
    reason: "unknown_pdf_type",
  };
}

function sanitizeFilename(filename) {
  return filename.replace(/[^\w.\-() ]+/g, "_");
}

function decodeBase64Url(data) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const messageRes = await gmail.users.messages.get({
  userId: "me",
  id: messageId,
  format: "full",
});

const allAttachments = collectAttachments(messageRes.data.payload);

if (allAttachments.length === 0) {
  console.log("No attachments found.");
  process.exit(0);
}

const attachmentsToIngest = [];

console.log("\nAttachment intake decision:");

for (const attachment of allAttachments) {
  const classification = classifyAttachment(attachment);

  console.log({
    filename: attachment.filename,
    action: classification.action,
    reason: classification.reason,
  });

  if (classification.action === "ingest") {
    attachmentsToIngest.push(attachment);
  }
}

if (attachmentsToIngest.length === 0) {
  console.log("\nNo canonical receipt PDFs found to download.");
  process.exit(0);
}

const outputDir = path.resolve(
  __dirname,
  "../tmp/gmail-downloads",
  messageId
);

fs.mkdirSync(outputDir, { recursive: true });

console.log("\nDownloading canonical receipt PDFs:");

for (const attachment of attachmentsToIngest) {
  const attachmentRes = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachment.attachmentId,
  });

  const data = attachmentRes.data.data;

  if (!data) {
    console.warn(`No data returned for ${attachment.filename}`);
    continue;
  }

  const buffer = decodeBase64Url(data);
  const contentHash = sha256(buffer);
  const safeFilename = sanitizeFilename(attachment.filename);
  const outputPath = path.join(outputDir, safeFilename);

  fs.writeFileSync(outputPath, buffer);

  console.log({
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    expectedSize: attachment.size,
    downloadedBytes: buffer.length,
    contentSha256: contentHash,
    savedTo: outputPath,
  });
}