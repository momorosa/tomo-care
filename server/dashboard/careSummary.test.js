import test from "node:test"
import assert from "node:assert/strict"
import { summarizeVerifiedCareEvents } from "./careSummary.js"

test("returns the latest verified care date and latest Librela injection", () => {
    const result = summarizeVerifiedCareEvents([
        {
            id: "librela",
            event_type: "injection",
            event_date: "2026-06-10",
            status: "verified",
            details_json: { medication: "Librela" },
        },
        {
            id: "simparica",
            event_type: "medication_administration",
            event_date: "2026-07-20",
            status: "verified",
            details_json: {
                care_item: "Simparica Trio",
                source: "owner_confirmation",
            },
        },
        {
            id: "planned",
            event_type: "reminder",
            event_date: "2026-08-16",
            status: "planned",
            details_json: { care_item: "Simparica Trio" },
        },
    ])

    assert.equal(result.latest_verified_care.event_date, "2026-07-20")
    assert.equal(result.latest_verified_care.care_item, "Simparica Trio")
    assert.equal(result.last_librela.event_date, "2026-06-10")
})

test("returns null summary items when no verified events exist", () => {
    assert.deepEqual(
        summarizeVerifiedCareEvents([
            {
                event_type: "reminder",
                event_date: "2026-08-16",
                status: "planned",
            },
        ]),
        {
            latest_verified_care: null,
            last_librela: null,
        }
    )
})
