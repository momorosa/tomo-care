import test from "node:test"
import assert from "node:assert/strict"
import {
    summarizePetProfile,
    summarizeVerifiedCareEvents,
} from "./careSummary.js"

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

test("returns the stored pet profile fields needed for a live age", () => {
    assert.deepEqual(
        summarizePetProfile({
            id: "pet-1",
            name: "Momo",
            species: "canine",
            breed: "American Eskimo",
            sex: "female",
            spayed_neutered: true,
            birth_date: "2014-08-22",
            microchip_id: " 900215000000001 ",
            private_note: "do not expose",
        }, "2026-08-14"),
        {
            id: "pet-1",
            name: "Momo",
            species: "canine",
            breed: "American Eskimo",
            birth_date: "2014-08-22",
            age: 11,
            sex: "female",
            reproductive_status: "spayed",
            microchip_id: "900215000000001",
        }
    )
})
