import assert from "node:assert/strict"
import test from "node:test"

import {
    getRecentVerifiedSources,
    getVerifiedSourcesLabel,
    MAX_VISIBLE_VERIFIED_SOURCES,
} from "./citationPresentation.js"

function citation(id, date) {
    return {
        type: "trusted_fact",
        id,
        display_date: date,
    }
}

test("shows verified sources newest first without mutating the answer", () => {
    const citations = [
        citation("oldest", "2025-02-17"),
        citation("latest", "2026-08-03"),
        citation("middle", "2026-06-10"),
    ]
    const original = structuredClone(citations)

    const visible = getRecentVerifiedSources(citations)

    assert.deepEqual(
        visible.map((item) => item.id),
        ["latest", "middle", "oldest"]
    )
    assert.deepEqual(citations, original)
})

test("caps the evidence drawer at ten while retaining the ten newest", () => {
    const citations = Array.from({ length: 14 }, (_, index) =>
        citation(
            `weight-${index + 1}`,
            new Date(Date.UTC(2025, index, 1)).toISOString().slice(0, 10)
        )
    )

    const visible = getRecentVerifiedSources(citations)

    assert.equal(visible.length, MAX_VISIBLE_VERIFIED_SOURCES)
    assert.equal(visible[0].id, "weight-14")
    assert.equal(visible.at(-1).id, "weight-5")
})

test("keeps undated sources after dated sources and preserves tie order", () => {
    const visible = getRecentVerifiedSources([
        citation("undated-a", null),
        citation("same-a", "2026-08-03"),
        citation("undated-b", null),
        citation("same-b", "2026-08-03"),
    ])

    assert.deepEqual(
        visible.map((item) => item.id),
        ["same-a", "same-b", "undated-a", "undated-b"]
    )
})

test("labels a capped list as recent and an uncapped list normally", () => {
    assert.equal(
        getVerifiedSourcesLabel({ visibleCount: 10, totalCount: 14 }),
        "View 10 recent verified sources"
    )
    assert.equal(
        getVerifiedSourcesLabel({ visibleCount: 1, totalCount: 1 }),
        "View 1 verified source"
    )
})
