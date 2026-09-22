import process from "node:process"
import {
    DemoCalendarError,
    getDemoCalendarContract,
    cleanupDemoCalendar,
} from "./demoCalendar.js"
import { getDemoGoogleCalendarService } from "../googleCalendar.js"
import { DEMO_PET_ID, DEMO_INTAKE_DOCUMENT_ID } from "./scenarioManifest.js"

export async function prepareDemoCalendarReset({
    client,
    env = process.env,
    createCalendar = getDemoGoogleCalendarService,
}) {
    const { data, error } = await client
        .from("events")
        .select("details_json")
        .eq("pet_id", DEMO_PET_ID)
        .eq("doc_id", DEMO_INTAKE_DOCUMENT_ID)
    if (error)
        throw new DemoCalendarError(
            "Reset stopped: demo calendar references could not be checked."
        )
    const refs = (data || [])
        .map((row) => row.details_json?.external_refs)
        .filter((ref) => ref?.google_calendar_event_id)
    if (!env.DEMO_GCAL_CALENDAR_ID && refs.length === 0) return 0
    const contract = getDemoCalendarContract(env)
    if (
        refs.some(
            (ref) => ref.google_calendar_calendar_id !== contract.calendarId
        )
    )
        throw new DemoCalendarError(
            "Reset stopped: a saved calendar reference does not match the configured demo calendar."
        )
    return cleanupDemoCalendar({ calendar: createCalendar(env), contract })
}
