import {
    DemoCalendarError,
    getDemoCalendarContract,
    syncDemoCalendarEvent,
} from "./demoCalendar.js"
import { DEMO_PET_ID, DEMO_INTAKE_DOCUMENT_ID } from "./scenarioManifest.js"
import { toGoogleCalendarErrorResponse } from "../calendar/googleCalendarError.js"

export function createDemoCalendarHandler({ client, createCalendar, env }) {
    return async (req, res) => {
        try {
            const contract = getDemoCalendarContract(env)
            const { data: event, error } = await client
                .from("events")
                .select(
                    "id, pet_id, doc_id, event_type, event_date, status, details_json, updated_at"
                )
                .eq("id", req.params.eventId)
                .eq("pet_id", DEMO_PET_ID)
                .single()
            if (error || !event)
                throw new DemoCalendarError(
                    "This demo reminder could not be loaded. No calendar entry was changed."
                )
            const { data: document, error: docError } = await client
                .from("documents")
                .select(
                    "id, pet_id, title, doc_type, file_url, status, external_refs, text_extracted, doc_date"
                )
                .eq("id", DEMO_INTAKE_DOCUMENT_ID)
                .eq("pet_id", DEMO_PET_ID)
                .single()
            if (docError)
                throw new DemoCalendarError(
                    "The verified demo source could not be checked. No calendar entry was changed."
                )
            const { action, calendarEvent, payload } =
                await syncDemoCalendarEvent({
                    calendar: createCalendar(env),
                    contract,
                    event,
                    document,
                })
            const details = {
                ...event.details_json,
                calendar_sync_status: "synced",
                external_refs: {
                    ...event.details_json.external_refs,
                    google_calendar_calendar_id: contract.calendarId,
                    google_calendar_event_id: calendarEvent.id,
                    google_calendar_html_link: calendarEvent.htmlLink,
                    google_calendar_last_synced_at: new Date().toISOString(),
                    google_calendar_start_date_time: payload.start.dateTime,
                    google_calendar_end_date_time: payload.end.dateTime,
                },
            }
            const { error: saveError } = await client
                .from("events")
                .update({ details_json: details })
                .eq("id", event.id)
                .eq("pet_id", DEMO_PET_ID)
                .eq("updated_at", event.updated_at)
                .select("id")
                .single()
            if (saveError) {
                return res.status(503).json({
                    ok: false,
                    error: "The demo entry was added, but TomoCare could not save its link. Refresh reminders, then try again to reconnect the same entry; it will not create a duplicate.",
                    retryable: true,
                })
            }
            return res.json({
                ok: true,
                action,
                message:
                    "Added to TomoCare Demo — Synthetic Data. No alerts or appointment booking.",
                google_calendar: { html_link: calendarEvent.htmlLink },
            })
        } catch (error) {
            if (error instanceof DemoCalendarError)
                return res
                    .status(409)
                    .json({
                        ok: false,
                        reason: error.reason,
                        error: error.message,
                    })
            const response = toGoogleCalendarErrorResponse(error)
            // Avoid exposing provider request/configuration details in product copy.
            if (response.status !== 401)
                response.body.error =
                    "Couldn’t update the demo calendar. Your TomoCare reminder is saved; try again."
            return res.status(response.status).json(response.body)
        }
    }
}
