import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"
import {
    getDemoCalendarContract,
    DEMO_CALENDAR_NAME,
    demoCalendarEventId,
    buildDemoCalendarPayload,
    syncDemoCalendarEvent,
    cleanupDemoCalendar,
} from "./demoCalendar.js"
import { createDemoCalendarHandler } from "./demoCalendarRoute.js"
import { prepareDemoCalendarReset } from "./demoCalendarReset.js"
import {
    buildDemoScenario,
    DEMO_PET_ID,
    DEMO_PROJECT_URL,
    DEMO_INTAKE_FIXTURE as source,
} from "./scenarioManifest.js"
import { resetDemoEnvironment } from "../scripts/resetDemoEnvironment.js"
import { getRuntimeBoundaryDecision } from "../middleware/runtimeBoundary.js"
import { getDemoReminderCalendarControl } from "../../src/pages/Dashboard/calendarRecovery.js"

beforeEach((t) =>
    t.mock.timers.enable({
        apis: ["Date"],
        now: new Date("2026-09-22T12:00:00Z"),
    })
)
const env = {
    TOMOCARE_RUNTIME_MODE: "demo",
    SUPABASE_URL: DEMO_PROJECT_URL,
    TOMO_PET_ID: DEMO_PET_ID,
    DEMO_GCAL_CALENDAR_ID: "demoonly123@group.calendar.google.com",
    GCAL_CALENDAR_ID: "primary",
    GCAL_TIMEZONE: "America/Los_Angeles",
}
const contract = getDemoCalendarContract(env)
function event() {
    return {
        id: "reminder-1",
        updated_at: "2026-09-22T12:00:00Z",
        pet_id: DEMO_PET_ID,
        doc_id: source.documentId,
        event_type: "reminder",
        status: "planned",
        event_date: "2026-10-19",
        details_json: {
            subtype: "Librela",
            source_document_id: source.documentId,
            anchor_event_date: "2026-09-07",
            due_date: "2026-10-26",
        },
    }
}
function document() {
    return {
        id: source.documentId,
        pet_id: DEMO_PET_ID,
        title: source.title,
        doc_type: "receipt",
        file_url: source.storageKey,
        status: "verified",
        external_refs: {
            demo_owned: true,
            scenario_id: "tomocare-demo-v1",
            fixture_kind: source.fixtureKind,
            content_sha256: source.contentSha256,
        },
        text_extracted: {
            events: [
                {
                    event_type: "injection",
                    event_date: "2026-09-07",
                    details_json: { subtype: "Librela" },
                },
            ],
        },
    }
}
function provider() {
    const rows = new Map(),
        calls = []
    const record = (method, args, options) =>
        calls.push({ method, args, options })
    return {
        rows,
        calls,
        events: {
            async list(args) {
                record("list", args)
                return {
                    data: args.fields
                        ? { summary: DEMO_CALENDAR_NAME }
                        : { items: [...rows.values()] },
                }
            },
            async get(args) {
                record("get", args)
                if (!rows.has(args.eventId)) throw { code: 404 }
                return { data: rows.get(args.eventId) }
            },
            async insert(args) {
                record("insert", args)
                if (rows.has(args.requestBody.id)) throw { code: 409 }
                const data = {
                    ...args.requestBody,
                    etag: "v1",
                    htmlLink:
                        "https://calendar.google.com/calendar/event?eid=demo",
                }
                rows.set(data.id, data)
                return { data }
            },
            async update(args, options) {
                record("update", args, options)
                const data = {
                    ...args.requestBody,
                    id: args.eventId,
                    etag: "v2",
                    htmlLink:
                        "https://calendar.google.com/calendar/event?eid=demo",
                }
                rows.set(data.id, data)
                return { data }
            },
            async delete(args, options) {
                record("delete", args, options)
                rows.delete(args.eventId)
                return {}
            },
        },
    }
}
function sync(calendar, overrides = {}) {
    return syncDemoCalendarEvent({
        calendar,
        contract,
        event: event(),
        document: document(),
        ...overrides,
    })
}
function db({
    saveError = null,
    doc = document(),
    reminder = event(),
    readError = null,
} = {}) {
    const writes = []
    return {
        writes,
        from(table) {
            let update
            const q = {
                select() {
                    return q
                },
                eq() {
                    return q
                },
                update(value) {
                    update = value
                    return q
                },
                single: async () => {
                    if (update) writes.push(update)
                    return {
                        data: update
                            ? { id: reminder.id }
                            : table === "events"
                              ? reminder
                              : doc,
                        error: update ? saveError : readError,
                    }
                },
                then(resolve) {
                    if (update) writes.push(update)
                    return Promise.resolve({
                        data: update
                            ? null
                            : [{ details_json: reminder.details_json }],
                        error: update ? saveError : readError,
                    }).then(resolve)
                },
            }
            return q
        },
    }
}
async function route(client, calendar, settings = env) {
    const response = {
        statusCode: 200,
        status(code) {
            this.statusCode = code
            return this
        },
        json(body) {
            this.body = body
            return this
        },
    }
    await createDemoCalendarHandler({
        client,
        createCalendar: () => calendar,
        env: settings,
    })({ params: { eventId: "reminder-1" } }, response)
    return response
}

test("configuration rejects primary, personal addresses, missing IDs, care destination and wrong identities", () => {
    for (const id of [
        undefined,
        "primary",
        "real@example.com",
        "x@group.v.calendar.google.com",
        "https://calendar.google.com",
    ])
        assert.throws(() =>
            getDemoCalendarContract({ ...env, DEMO_GCAL_CALENDAR_ID: id })
        )
    assert.throws(() =>
        getDemoCalendarContract({
            ...env,
            GCAL_CALENDAR_ID: env.DEMO_GCAL_CALENDAR_ID,
        })
    )
    for (const change of [
        { TOMOCARE_RUNTIME_MODE: "real" },
        { TOMO_PET_ID: "real-pet" },
        { SUPABASE_URL: "https://other.supabase.co" },
    ])
        assert.throws(() => getDemoCalendarContract({ ...env, ...change }))
})
test("payload is fictional, private, free, quiet, guest-free and in the explicit destination timezone", () => {
    const p = buildDemoCalendarPayload(event(), document(), contract)
    assert.match(p.summary, /^\[DEMO\]/)
    assert.match(p.description, /SYNTHETIC DATA ONLY/)
    assert.equal(p.transparency, "transparent")
    assert.equal(p.visibility, "private")
    assert.deepEqual(p.reminders, { useDefault: false, overrides: [] })
    assert.deepEqual(p.attendees, [])
    assert.equal(p.start.timeZone, "America/Los_Angeles")
    assert.equal(p.start.dateTime, "2026-10-19T09:00:00")
    assert.match(p.id, /^[a-v0-9]+$/)
})
test("unverified, tampered or differently dated evidence cannot reach Google", async () => {
    for (const mutate of [
        (d) => (d.status = "needs_review"),
        (d) => (d.external_refs.content_sha256 = "wrong"),
        (d) => (d.pet_id = "care"),
        (d) => (d.text_extracted.events[0].event_date = "2026-07-07"),
        (d) => (d.text_extracted = {}),
    ]) {
        const d = document()
        mutate(d)
        const c = provider()
        await assert.rejects(() => sync(c, { document: d }))
        assert.equal(c.calls.length, 0)
    }
})
test("only the manifest Librela reminder is allowed, and stale timing is rechecked", async () => {
    for (const mutate of [
        (e) => (e.pet_id = "care"),
        (e) => (e.doc_id = "other"),
        (e) => (e.status = "completed"),
        (e) => (e.details_json.subtype = "Insurance claim"),
        (e) => (e.event_date = "2026-10-20"),
        (e) => (e.details_json.due_date = "2026-10-27"),
    ]) {
        const e = event()
        mutate(e)
        const c = provider()
        await assert.rejects(() => sync(c, { event: e }))
        assert.equal(c.calls.length, 0)
    }
    await assert.rejects(() =>
        sync(provider(), { currentCareDate: "2026-10-27" })
    )
})
test("references to a different calendar or event are rejected before network calls", async () => {
    for (const refs of [
        { google_calendar_calendar_id: "primary" },
        { google_calendar_event_id: "other" },
    ]) {
        const e = event()
        e.details_json.external_refs = refs
        const c = provider()
        await assert.rejects(() => sync(c, { event: e }))
        assert.equal(c.calls.length, 0)
    }
})
test("a mismatched calendar name stops before event access or mutation", async () => {
    const c = provider()
    c.events.list = async () => ({ data: { summary: "Real care" } })
    await assert.rejects(() => sync(c))
    assert.equal(c.calls.length, 0)
})
test("retry reconnects exactly one event after a lost response or database save", async () => {
    const c = provider()
    assert.equal((await sync(c)).action, "created")
    assert.equal((await sync(c)).action, "updated")
    assert.equal(c.rows.size, 1)
    assert.equal(c.calls.filter((x) => x.method === "insert").length, 1)
    for (const x of c.calls)
        assert.equal(x.args.calendarId, contract.calendarId)
    const update = c.calls.find((x) => x.method === "update")
    assert.equal(update.args.sendUpdates, "none")
    assert.equal(update.options.headers["If-Match"], "v1")
})
test("concurrent insert conflict rechecks ownership before updating", async () => {
    const c = provider()
    const insert = c.events.insert
    c.events.insert = async (args) => {
        await insert(args)
        throw { code: 409 }
    }
    assert.equal((await sync(c)).action, "updated")
    assert.equal(c.rows.size, 1)
})
test("an unowned collision or modified guest list is never overwritten", async () => {
    for (const mutate of [
        (p) => (p.extendedProperties = {}),
        (p) => (p.attendees = [{ email: "guest@example.com" }]),
        (p) => (p.recurrence = ["RRULE:FREQ=DAILY"]),
        (p) => delete p.etag,
    ]) {
        const c = provider()
        await sync(c)
        const p = c.rows.values().next().value
        mutate(p)
        c.calls.length = 0
        await assert.rejects(() => sync(c))
        assert.ok(!c.calls.some((x) => ["update", "insert"].includes(x.method)))
    }
})
test("Google authentication or transient errors do not trigger write retries", async () => {
    for (const code of [401, 403, 429, 500]) {
        const c = provider()
        c.events.get = async () => {
            throw { code }
        }
        await assert.rejects(() => sync(c))
        assert.ok(!c.calls.some((x) => x.method === "insert"))
    }
})
test("deleted remote entry asks for reset instead of resurrecting it", async () => {
    const c = provider()
    await sync(c)
    c.rows.values().next().value.status = "cancelled"
    await assert.rejects(() => sync(c), /Reset/)
})
test("cleanup finds owned orphans without relying on persisted database refs", async () => {
    const c = provider()
    await sync(c)
    assert.equal(await cleanupDemoCalendar({ calendar: c, contract }), 1)
    assert.equal(c.rows.size, 0)
    const list = c.calls.find((x) => x.args.privateExtendedProperty)
    assert.equal(list.args.privateExtendedProperty.length, 4)
    assert.equal(
        c.calls.find((x) => x.method === "delete").options.headers["If-Match"],
        "v1"
    )
})
test("cleanup validates all candidates before deleting any and handles pagination", async () => {
    const c = provider()
    await sync(c)
    const owned = c.rows.values().next().value
    let page = 0
    c.events.list = async (args) =>
        args.fields
            ? { data: { summary: DEMO_CALENDAR_NAME } }
            : {
                  data:
                      ++page === 1
                          ? { items: [owned], nextPageToken: "next" }
                          : { items: [{ ...owned, id: "foreign" }] },
              }
    await assert.rejects(() => cleanupDemoCalendar({ calendar: c, contract }))
    assert.equal(c.rows.size, 1)
    assert.ok(!c.calls.some((x) => x.method === "delete"))
})
test("reset stops before storage/database changes if calendar cleanup fails", async () => {
    const calls = []
    await assert.rejects(() =>
        resetDemoEnvironment({
            runtime: { mode: "demo" },
            scenario: buildDemoScenario("2026-09-22"),
            repository: {
                removeStorageObjects: async () => calls.push("storage"),
                deleteDemoOwnedRecords: async () => calls.push("db"),
                insertScenario: async () => calls.push("seed"),
            },
            beforeReset: async () => {
                throw Error("calendar unavailable")
            },
        })
    )
    assert.deepEqual(calls, [])
})
test("no configured calendar plus existing calendar refs fails closed during reset", async () => {
    const e = event()
    e.details_json.external_refs = {
        google_calendar_event_id: "some",
        google_calendar_calendar_id: contract.calendarId,
    }
    let contacted = false
    await assert.rejects(() =>
        prepareDemoCalendarReset({
            client: db({ reminder: e }),
            env: { ...env, DEMO_GCAL_CALENDAR_ID: "" },
            createCalendar: () => {
                contacted = true
            },
        })
    )
    assert.equal(contacted, false)
    assert.equal(
        await prepareDemoCalendarReset({
            client: db(),
            env: { ...env, DEMO_GCAL_CALENDAR_ID: "" },
            createCalendar: () => {
                throw Error("must not run")
            },
        }),
        0
    )
})
test("route persists the returned event link only after provider success", async () => {
    const c = provider(),
        client = db()
    const res = await route(client, c)
    assert.equal(res.statusCode, 200)
    assert.equal(client.writes.length, 1)
    assert.equal(
        client.writes[0].details_json.external_refs.google_calendar_calendar_id,
        contract.calendarId
    )
})
test("failed database save explains partial success and retry creates no duplicate", async () => {
    const c = provider()
    const res = await route(db({ saveError: { message: "unavailable" } }), c)
    assert.equal(res.statusCode, 503)
    assert.match(res.body.error, /same entry/)
    assert.equal((await route(db(), c)).statusCode, 200)
    assert.equal(c.rows.size, 1)
})
test("unverified source or read failure cannot sync or mark the reminder synced", async () => {
    const d = document()
    d.status = "needs_review"
    for (const client of [
        db({ doc: d }),
        db({ readError: { message: "database down" } }),
    ]) {
        const c = provider()
        assert.equal((await route(client, c)).statusCode, 409)
        assert.equal(client.writes.length, 0)
        assert.equal(c.calls.length, 0)
    }
})
test("generic Calendar remains blocked in demo while dedicated route has its own guard", () => {
    assert.equal(
        getRuntimeBoundaryDecision({
            method: "POST",
            pathname: "/api/events/x/actions/sync-google-calendar",
            runtime: { mode: "demo" },
        }).type,
        "blocked_demo_side_effect"
    )
    assert.equal(
        getRuntimeBoundaryDecision({
            method: "POST",
            pathname: "/api/events/x/actions/sync-demo-calendar",
            runtime: { mode: "demo" },
        }).capability,
        "demo_calendar"
    )
})
test("UI exposes a clearly labeled action only for approved demo reminder cards", () => {
    const r = {
        id: "r",
        demo_calendar_available: true,
        timing_state: "upcoming",
        details_json: { subtype: "Librela" },
    }
    assert.equal(
        getDemoReminderCalendarControl(r).label,
        "Add to demo calendar"
    )
    assert.equal(
        getDemoReminderCalendarControl({
            ...r,
            demo_calendar_available: false,
        }),
        null
    )
    assert.equal(
        getDemoReminderCalendarControl({ ...r, timing_state: "overdue" }),
        null
    )
    assert.equal(
        getDemoReminderCalendarControl({
            ...r,
            google_calendar_url: "https://calendar.google.com/event",
        }).label,
        "Open demo calendar event"
    )
})
test("a reset cycle gets a fresh ID while retries of the same reminder stay stable", () => {
    assert.equal(demoCalendarEventId("r1"), demoCalendarEventId("r1"))
    assert.notEqual(demoCalendarEventId("r1"), demoCalendarEventId("r2"))
})

test("receipt preview validates Calendar ownership without deleting the event", async () => {
    const calendar = provider()
    await syncDemoCalendarEvent({
        calendar,
        contract,
        event: event(),
        document: document(),
    })
    const before = structuredClone([...calendar.rows])
    assert.equal(
        await cleanupDemoCalendar({ calendar, contract, preview: true }),
        1
    )
    assert.deepEqual([...calendar.rows], before)
    assert.equal(
        calendar.calls.filter((call) => call.method === "delete").length,
        0
    )
})

test("receipt reset helper forwards read-only preview to Calendar cleanup", async () => {
    const calendar = provider()
    await syncDemoCalendarEvent({
        calendar,
        contract,
        event: event(),
        document: document(),
    })
    const client = {
        from() {
            return {
                select() {
                    return this
                },
                eq() {
                    return this
                },
                then(resolve) {
                    return Promise.resolve({ data: [], error: null }).then(
                        resolve
                    )
                },
            }
        },
    }
    assert.equal(
        await prepareDemoCalendarReset({
            client,
            env,
            createCalendar: () => calendar,
            preview: true,
        }),
        1
    )
    assert.equal(calendar.rows.size, 1)
    assert.equal(
        calendar.calls.filter((call) => call.method === "delete").length,
        0
    )
})
