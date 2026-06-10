import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Assumes .env is at tomo-care/.env
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

const res = await gmail.users.messages.list({
  userId: "me",
  q: "has:attachment filename:pdf newer_than:90d",
  maxResults: 10,
});

console.log("Matching messages:");
console.log(res.data.messages ?? []);