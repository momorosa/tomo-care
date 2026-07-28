import { google } from "googleapis"
import "dotenv/config"
import { getAppTimeZone } from "./lib/careDates.js"

export const GOOGLE_CALENDAR_SCOPE =
    "https://www.googleapis.com/auth/calendar.events"

export function getGoogleCalendarConfig() {
    const clientId = process.env.GCAL_CLIENT_ID
    const clientSecret = process.env.GCAL_CLIENT_SECRET
    const refreshToken = process.env.GCAL_REFRESH_TOKEN

    const calendarId = process.env.GCAL_CALENDAR_ID || "primary"
    const timezone = process.env.GCAL_TIMEZONE || getAppTimeZone()

    if (!clientId) {
        throw new Error("Missing GCAL_CLIENT_ID in .env.")
    }

    if (!clientSecret) {
        throw new Error("Missing GCAL_CLIENT_SECRET in .env.")
    }

    if (!refreshToken) {
        throw new Error("Missing GCAL_REFRESH_TOKEN in .env.")
    }

    return {
        clientId,
        clientSecret,
        refreshToken,
        calendarId,
        timezone,
    }
}

export function getGoogleCalendarService() {
    const { clientId, clientSecret, refreshToken } =
        getGoogleCalendarConfig()

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)

    oauth2Client.setCredentials({
        refresh_token: refreshToken,
    })

    return google.calendar({
        version: "v3",
        auth: oauth2Client,
    })
}

export async function verifyGoogleCalendarConnection() {
    const calendar = getGoogleCalendarService()
    const { calendarId, timezone } = getGoogleCalendarConfig()

    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const response = await calendar.events.list({
        calendarId,
        timeMin: now.toISOString(),
        timeMax: tomorrow.toISOString(),
        maxResults: 1,
        singleEvents: true,
        orderBy: "startTime",
    })

    return {
        ok: true,
        calendar_id: calendarId,
        timezone,
        event_scope_check: "passed",
        events_checked: response.data?.items?.length || 0,
    }
}