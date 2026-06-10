import "dotenv/config";
import crypto from "node:crypto";
import { google } from "googleapis";

const {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_REDIRECT_URI,
} = process.env;

export const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export const DEFAULT_GMAIL_QUERY =
  "has:attachment filename:pdf newer_than:60d";

export function getGmailClient() {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error(
      "Missing Gmail OAuth env vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN."
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

  return google.gmail({
    version: "v1",
    auth: oauth2Client,
  });
}

function decodeBase64Url(data) {
  if (!data) return Buffer.alloc(0);

  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function getHeader(headers = [], name) {
  return (
    headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? null
  );
}

function parseAddress(raw) {
  if (!raw) {
    return {
      name: null,
      email: null,
    };
  }

  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);

  if (match) {
    return {
      name: match[1].trim() || null,
      email: match[2].trim().toLowerCase(),
    };
  }

  return {
    name: null,
    email: raw.trim().toLowerCase(),
  };
}

function collectPdfParts(payload, results = []) {
  if (!payload) return results;

  const filename = payload.filename || "";
  const isPdf =
    payload.mimeType === "application/pdf" ||
    filename.toLowerCase().endsWith(".pdf");

  if (isPdf && payload.body) {
    results.push({
      filename: filename || "attachment.pdf",
      mimeType: payload.mimeType || "application/pdf",
      attachmentId: payload.body.attachmentId || null,
      inlineData: payload.body.data || null,
      gmailBodySize: payload.body.size ?? null,
    });
  }

  for (const part of payload.parts || []) {
    collectPdfParts(part, results);
  }

  return results;
}

function getPlainTextBody(payload) {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).toString("utf8");
  }

  for (const part of payload.parts || []) {
    const text = getPlainTextBody(part);
    if (text) return text;
  }

  return "";
}

function resolveSenders({ fromHeader, subject, textBody }) {
  const fromHeaderParsed = parseAddress(fromHeader);

  const isForwarded =
    /^fwd:/i.test(subject || "") ||
    /forwarded message/i.test(textBody || "");

  let originalSender = null;

  if (isForwarded && textBody) {
    const match = textBody.match(/From:\s*(.+<[^>]+>|\S+@\S+)/i);

    if (match) {
      originalSender = parseAddress(match[1]);
    }
  }

  return {
    isForwarded,
    forwardedBy: fromHeaderParsed,
    originalSender: originalSender || fromHeaderParsed,
  };
}

export function classifyAttachment(file) {
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

async function downloadPdfPart({ gmail, messageId, part }) {
  if (part.inlineData) {
    return decodeBase64Url(part.inlineData);
  }

  if (!part.attachmentId) {
    return null;
  }

  const { data } = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: part.attachmentId,
  });

  return decodeBase64Url(data.data);
}

export async function fetchCanonicalReceiptEmails({
  query = DEFAULT_GMAIL_QUERY,
  maxResults = 25,
} = {}) {
  const gmail = getGmailClient();

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messageIds = (listRes.data.messages || []).map((message) => message.id);
  const results = [];

  for (const messageId of messageIds) {
    const { data: message } = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = message.payload?.headers || [];
    const subject = getHeader(headers, "Subject");
    const fromHeader = getHeader(headers, "From");
    const textBody = getPlainTextBody(message.payload);

    const allPdfParts = collectPdfParts(message.payload);

    if (allPdfParts.length === 0) continue;

    const attachments = [];
    const skippedAttachments = [];

    for (const part of allPdfParts) {
      const classification = classifyAttachment(part);

      if (classification.action === "skip") {
        skippedAttachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          reason: classification.reason,
        });
        continue;
      }

      const buffer = await downloadPdfPart({
        gmail,
        messageId,
        part,
      });

      if (!buffer) {
        skippedAttachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          reason: "no_attachment_data",
        });
        continue;
      }

      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
        sizeBytes: buffer.length,
        contentSha256: sha256(buffer),
        gmailAttachmentId: part.attachmentId,
        intakeReason: classification.reason,
        data: buffer,
      });
    }

    if (attachments.length === 0) {
      results.push({
        gmailMsgId: message.id,
        threadId: message.threadId,
        receivedAt: message.internalDate
          ? new Date(Number(message.internalDate)).toISOString()
          : null,
        subject,
        ...resolveSenders({ fromHeader, subject, textBody }),
        attachments: [],
        skippedAttachments,
      });

      continue;
    }

    results.push({
      gmailMsgId: message.id,
      threadId: message.threadId,
      receivedAt: message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : null,
      subject,
      ...resolveSenders({ fromHeader, subject, textBody }),
      attachments,
      skippedAttachments,
    });
  }

  return results;
}

export async function logInbox() {
  const emails = await fetchCanonicalReceiptEmails();

  console.log(`Found ${emails.length} email(s) with PDF attachment candidates.\n`);

  for (const email of emails) {
    console.log(`• msg ${email.gmailMsgId} (${email.receivedAt || "no date"})`);
    console.log(`  subject:   ${email.subject || "—"}`);
    console.log(
      `  forwarded: ${email.isForwarded ? "yes" : "no"} by ${
        email.forwardedBy.email || "—"
      }`
    );
    console.log(
      `  original:  ${email.originalSender.name || "—"} <${
        email.originalSender.email || "—"
      }>`
    );

    for (const attachment of email.attachments) {
      console.log(
        `  ingest:    ${attachment.filename} (${attachment.sizeBytes} bytes)`
      );
      console.log(`             sha256: ${attachment.contentSha256}`);
    }

    for (const skipped of email.skippedAttachments) {
      console.log(`  skip:      ${skipped.filename} (${skipped.reason})`);
    }

    console.log("");
  }

  return emails;
}