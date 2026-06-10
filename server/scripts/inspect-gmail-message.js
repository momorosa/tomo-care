import path from "node:path";
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

function getHeader(headers, name) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function collectParts(part, results = []) {
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
      collectParts(child, results);
    }
  }

  return results;
}

const messageId = process.argv[2];

if (!messageId) {
  throw new Error("Pass a Gmail message ID. Example: node server/scripts/inspect-gmail-message.mjs 19eaea7633a7df96");
}

const res = await gmail.users.messages.get({
  userId: "me",
  id: messageId,
  format: "full",
});

const message = res.data;
const headers = message.payload.headers || [];
const attachments = collectParts(message.payload);

console.log({
  id: message.id,
  threadId: message.threadId,
  subject: getHeader(headers, "Subject"),
  from: getHeader(headers, "From"),
  date: getHeader(headers, "Date"),
  snippet: message.snippet,
  attachments,
});