import assert from "node:assert/strict"
import test from "node:test"

import {
    buildLibrelaRepairPreviewMessage,
    getLibrelaActionIntent,
} from "./librelaReconciliationFlow.js"

test("requires a preview before applying a repair", () => {
    assert.equal(
        getLibrelaActionIntent({
            recommendationState: "repair_required",
            phase: "idle",
        }),
        "preview_repair"
    )
    assert.equal(
        getLibrelaActionIntent({
            recommendationState: "repair_required",
            phase: "repair_ready",
        }),
        "apply_repair"
    )
    assert.equal(
        getLibrelaActionIntent({
            recommendationState: "eligible",
            phase: "idle",
        }),
        "create_and_sync"
    )
})

test("describes the exact bounded repair in user-facing language", () => {
    const message = buildLibrelaRepairPreviewMessage(
        {
            anchor_date: "2026-08-03",
            reminder_date: "2026-09-14",
            due_date: "2026-09-21",
            canonical_event_action: "create",
            prior_reminders_to_complete: 1,
            next_reminder_action: "create",
        },
        (value) => value
    )

    assert.match(message, /add the missing verified Librela injection on 2026-08-03/)
    assert.match(message, /complete 1 earlier Librela reminder/)
    assert.match(message, /next reminder for 2026-09-14 \(due 2026-09-21\)/)
    assert.match(message, /Appointments and non-Librela reminders will stay unchanged/)
})
