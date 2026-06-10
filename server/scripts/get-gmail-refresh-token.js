import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// This assumes your .env is at the project root: tomo-care/.env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI,
} = process.env;

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REDIRECT_URI) {
  throw new Error(
    "Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REDIRECT_URI in .env"
  );
}

const oauth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI
);

const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: scopes,
});

const redirectUrl = new URL(GMAIL_REDIRECT_URI);
const port = Number(redirectUrl.port || 3000);

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, GMAIL_REDIRECT_URI);
    const code = reqUrl.searchParams.get("code");

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing OAuth code.");
      return;
    }

    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OAuth complete. You can close this tab.");

    console.log("\nAdd this to your .env:");
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);

    server.close();
  } catch (error) {
    console.error("OAuth failed:", error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("OAuth failed. Check terminal.");
    server.close();
  }
});

server.listen(port, () => {
  console.log(`\nListening on ${GMAIL_REDIRECT_URI}`);
  console.log("\nOpen this URL in your browser:\n");
  console.log(authUrl);
});