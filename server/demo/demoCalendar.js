import process from "node:process"
import { createHash } from "node:crypto"
import { getServerRuntimeContext } from "../config/runtimeContext.js"
import { getAppTimeZone } from "../lib/careDates.js"
import { classifyLibrelaAdministrationEvidence } from "../lib/librelaEvidence.js"
import { resolveReminderTimingState } from "../reminders/reminderTiming.js"
import { isManifestOwnedDemoInvoice } from "./demoInvoiceReviewContract.js"
import {
    DEMO_PROJECT_REF,
    DEMO_PET_ID,
    DEMO_SCENARIO_ID,
    DEMO_INTAKE_DOCUMENT_ID,
} from "./scenarioManifest.js"

export const DEMO_CALENDAR_NAME = "TomoCare Demo — Synthetic Data"
const OWNER = Object.freeze({
    tomocare: "demo-calendar-v1",
    project: DEMO_PROJECT_REF,
    scenario: DEMO_SCENARIO_ID,
    source: DEMO_INTAKE_DOCUMENT_ID,
})

export class DemoCalendarError extends Error {
    constructor(message) {
        super(message)
        this.name = "DemoCalendarError"
        this.reason = "demo_calendar_not_available"
    }
}

export function getDemoCalendarContract(env = process.env) {
    const runtime = getServerRuntimeContext(env)
    const calendarId = String(env.DEMO_GCAL_CALENDAR_ID || "").trim()
    if (
        runtime.mode !== "demo" ||
        runtime.projectRef !== DEMO_PROJECT_REF ||
        runtime.petId !== DEMO_PET_ID ||
        !/^[a-z0-9]+@group\.calendar\.google\.com$/.test(calendarId) ||
        calendarId === env.GCAL_CALENDAR_ID
    ) {
        throw new DemoCalendarError(
            "The separate demo calendar is not configured. Your TomoCare reminder is unchanged."
        )
    }
    return Object.freeze({
        calendarId,
        timezone: env.GCAL_TIMEZONE || getAppTimeZone(env),
    })
}

export function isDemoCalendarReminder(event) {
    const d = event?.details_json || {}
    return Boolean(
        event?.id &&
            event.pet_id === DEMO_PET_ID &&
            event.doc_id === DEMO_INTAKE_DOCUMENT_ID &&
            event.event_type === "reminder" &&
            event.status === "planned" &&
            d.subtype === "Librela" &&
            d.source_document_id === DEMO_INTAKE_DOCUMENT_ID &&
            d.anchor_event_date === "2026-09-07" &&
            event.event_date === "2026-10-19" &&
            d.due_date === "2026-10-26"
    )
}

export function demoCalendarAvailable(event, env = process.env) {
    try {
        getDemoCalendarContract(env)
        return isDemoCalendarReminder(event)
    } catch {
        return false
    }
}

export function demoCalendarEventId(reminderId) {
    return (
        "demo" +
        createHash("sha256")
            .update(
                `${DEMO_SCENARIO_ID}:${DEMO_INTAKE_DOCUMENT_ID}:${reminderId}`
            )
            .digest("hex")
    )
}

export function buildDemoCalendarPayload(
    event,
    document,
    contract,
    { currentCareDate } = {}
) {
    const assessment = classifyLibrelaAdministrationEvidence({ document })
    if (
        !isDemoCalendarReminder(event) ||
        !isManifestOwnedDemoInvoice(document) ||
        document.status !== "verified" ||
        assessment.state !== "eligible" ||
        assessment.event_date !== "2026-09-07" ||
        !["upcoming", "due_now"].includes(
            resolveReminderTimingState(event, { currentCareDate })
        )
    ) {
        throw new DemoCalendarError(
            "Only the verified September demo invoice’s upcoming Librela reminder can be added to the demo calendar."
        )
    }
    const refs = event.details_json.external_refs || {}
    const id = demoCalendarEventId(event.id)
    if (
        (refs.google_calendar_calendar_id &&
            refs.google_calendar_calendar_id !== contract.calendarId) ||
        (refs.google_calendar_event_id && refs.google_calendar_event_id !== id)
    ) {
        throw new DemoCalendarError(
            "The saved calendar reference does not belong to this demo reminder. No calendar entry was changed."
        )
    }
    return {
        id,
        summary: "[DEMO] Momo — Librela reminder",
        description:
            "SAMPLE — SYNTHETIC DATA ONLY. Not a real appointment or medical instruction.\nFictional September 7, 2026 Harborlight invoice: reminder October 19; next Librela due around October 26.\nCreated after explicit approval in TomoCare Demo. No clinic was contacted and no appointment was booked.",
        start: {
            dateTime: `${event.event_date}T09:00:00`,
            timeZone: contract.timezone,
        },
        end: {
            dateTime: `${event.event_date}T09:30:00`,
            timeZone: contract.timezone,
        },
        transparency: "transparent",
        visibility: "private",
        reminders: { useDefault: false, overrides: [] },
        attendees: [],
        extendedProperties: { private: { ...OWNER, reminder: event.id } },
    }
}

export async function verifyDemoCalendarDestination(calendar, contract) {
    // calendar.events scope can read the destination name without broader calendar-list permissions.
    const { data } = await calendar.events.list({
        calendarId: contract.calendarId,
        maxResults: 1,
        fields: "summary",
    })
    if (data.summary !== DEMO_CALENDAR_NAME)
        throw new DemoCalendarError(
            "The configured calendar is not named TomoCare Demo — Synthetic Data. No entry was changed."
        )
}

function assertOwned(remote, reminderId) {
    const tags = remote?.extendedProperties?.private || {}
    if (
        Object.entries(OWNER).some(([key, value]) => tags[key] !== value) ||
        !tags.reminder ||
        remote.id !== demoCalendarEventId(tags.reminder) ||
        (reminderId && tags.reminder !== reminderId) ||
        !remote.etag ||
        remote.summary !== "[DEMO] Momo — Librela reminder" ||
        remote.attendees?.length ||
        remote.recurrence?.length
    ) {
        throw new DemoCalendarError(
            "The existing calendar entry is not an untouched TomoCare demo entry. No entry was changed."
        )
    }
}

export async function syncDemoCalendarEvent({
    calendar,
    contract,
    event,
    document,
    currentCareDate,
}) {
    const payload = buildDemoCalendarPayload(event, document, contract, {
        currentCareDate,
    })
    await verifyDemoCalendarDestination(calendar, contract)
    const args = { calendarId: contract.calendarId, eventId: payload.id }
    let remote
    try {
        remote = (await calendar.events.get(args)).data
    } catch (error) {
        if (Number(error?.code) !== 404) throw error
    }
    if (!remote) {
        try {
            return {
                action: "created",
                payload,
                calendarEvent: (
                    await calendar.events.insert({
                        calendarId: contract.calendarId,
                        sendUpdates: "none",
                        requestBody: payload,
                    })
                ).data,
            }
        } catch (error) {
            if (Number(error?.code) !== 409) throw error
            remote = (await calendar.events.get(args)).data
        }
    }
    assertOwned(remote, event.id)
    if (remote.status === "cancelled")
        throw new DemoCalendarError(
            "This demo entry was deleted in Google Calendar. Reset the demo before creating a fresh entry."
        )
    const body = { ...payload }
    delete body.id
    const updated = await calendar.events.update(
        { ...args, sendUpdates: "none", requestBody: body },
        { headers: { "If-Match": remote.etag } }
    )
    return { action: "updated", payload, calendarEvent: updated.data }
}

export async function cleanupDemoCalendar({ calendar, contract }) {
    await verifyDemoCalendarDestination(calendar, contract)
    const owned = []
    let pageToken
    do {
        const { data } = await calendar.events.list({
            calendarId: contract.calendarId,
            privateExtendedProperty: Object.entries(OWNER).map(
                ([k, v]) => `${k}=${v}`
            ),
            maxResults: 100,
            pageToken,
            showDeleted: false,
        })
        for (const event of data.items || []) {
            assertOwned(event)
            owned.push(event)
        }
        if (owned.length > 1000)
            throw new DemoCalendarError(
                "Unexpected demo calendar size; reset stopped before deleting anything."
            )
        pageToken = data.nextPageToken
    } while (pageToken)
    // Validate the entire selection before any deletion. Never clear the calendar itself.
    for (const event of owned) {
        await calendar.events.delete(
            {
                calendarId: contract.calendarId,
                eventId: event.id,
                sendUpdates: "none",
            },
            { headers: { "If-Match": event.etag } }
        )
    }
    return owned.length
}
