import assert from "node:assert/strict"
import test from "node:test"

import { buildWeightPreviewMessage } from "./weightMaterializationFlow.js"

test("describes the exact weight write and bounded preservation scope", () => {
    const message = buildWeightPreviewMessage(
        {
            measurement: {
                value: 15.1,
                unit: "kg",
                measured_date: "2026-08-03",
                source_label: "Patient metadata weight",
            },
        },
        () => "August 3, 2026"
    )

    assert.match(message, /15\.1 kg/)
    assert.match(message, /August 3, 2026/)
    assert.match(message, /newest verified measurement/)
    assert.match(message, /Events, costs, reminders, and Calendar stay unchanged/)
})
