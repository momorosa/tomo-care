import test from "node:test"
import assert from "node:assert/strict"
import { enrichCitations, eventCitation } from "./citations.js"

test("labels approved owner confirmation as the source of a trusted event", () => {
    const event = {
        id: "event-1",
        doc_id: null,
        event_type: "medication_administration",
        event_date: "2026-07-20",
        status: "verified",
        details_json: {
            care_item: "Simparica Trio",
            source: "owner_confirmation",
            care_action_id: "action-1",
        },
    }

    const [citation] = enrichCitations(
        [eventCitation(event, "Simparica Trio administration")],
        { verifiedEvents: [event] }
    )

    assert.equal(
        citation.source_title,
        "Owner confirmation through an approved TomoCare action"
    )
    assert.match(citation.evidence_note, /approved action/i)
    assert.equal(citation.source_pdf_available, false)
})

test("does not call a documentless trusted event a source document", () => {
    const event = {
        id: "event-2",
        doc_id: null,
        event_type: "care_note",
        event_date: "2026-07-19",
        status: "verified",
        details_json: {},
    }

    const [citation] = enrichCitations(
        [eventCitation(event)],
        { verifiedEvents: [event] }
    )

    assert.equal(citation.source_title, "Trusted TomoCare record")
})
