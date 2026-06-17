import "dotenv/config"
import http from "node:http"
import { URL } from "node:url"
import { google } from "googleapis"

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
const PORT = 3000
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`

const clientId = process.env.GCAL_CLIENT_ID || process.env.GMAIL_CLIENT_ID
const clientSecret =
    process.env.GCAL_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET

if (!clientId || !clientSecret) {
    throw new Error(
        "Missing OAuth client. Set GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET or GCAL_CLIENT_ID/GCAL_CLIENT_SECRET in .env."
    )
}

const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
)

const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
})

console.log("\nOpen this URL in your browser:\n")
console.log(authUrl)
console.log("\nWaiting for OAuth callback...\n")

const server = http.createServer(async (req, res) => {
    try {
        const reqUrl = new URL(req.url, REDIRECT_URI)

        if (reqUrl.pathname !== "/oauth2callback") {
            res.writeHead(404)
            res.end("Not found")
            return
        }

        const code = reqUrl.searchParams.get("code")

        if (!code) {
            throw new Error("No authorization code found in callback URL.")
        }

        const { tokens } = await oauth2Client.getToken(code)

        res.writeHead(200, { "Content-Type": "text/plain" })
        res.end("Calendar OAuth complete. You can close this tab.")

        console.log("\nOAuth complete.")
        console.log("\nAdd this to your root .env:\n")
        console.log(`GCAL_CLIENT_ID=${clientId}`)
        console.log(`GCAL_CLIENT_SECRET=${clientSecret}`)
        console.log(`GCAL_REFRESH_TOKEN=${tokens.refresh_token}`)
        console.log("GCAL_CALENDAR_ID=primary")
        console.log("GCAL_TIMEZONE=America/Los_Angeles\n")

        server.close()
    } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" })
        res.end(err.message)

        console.error("\nOAuth failed:", err)
        server.close()
    }
})

server.listen(PORT, () => {
    console.log(`OAuth callback server listening on ${REDIRECT_URI}`)
})