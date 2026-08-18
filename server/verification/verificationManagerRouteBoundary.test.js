import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const triageRouteUrl = new URL("../routes/triage.js", import.meta.url)
const handoffUrl = new URL(
    "../orchestration/verificationIntelligenceHandoff.js",
    import.meta.url
)
const managerUrl = new URL("../orchestration/tomoManager.js", import.meta.url)

test("the triage route delegates to Tomo instead of owning specialist logic", async () => {
    const route = await readFile(triageRouteUrl, "utf8")

    assert.match(route, /coordinateVerificationIntelligenceReview/)
    assert.match(route, /orchestration_trace/)
    assert.doesNotMatch(route, /sbAdmin/)
    assert.doesNotMatch(route, /ANTHROPIC_API_KEY/)
    assert.doesNotMatch(route, /buildVerificationAssessment/)
    assert.doesNotMatch(route, /loadComparableVerificationHistory/)
})

test("manager persistence keeps source text and hidden reasoning out of the trace", async () => {
    const [handoff, manager] = await Promise.all([
        readFile(handoffUrl, "utf8"),
        readFile(managerUrl, "utf8"),
    ])

    const specialistInputStart = handoff.indexOf("const specialistInput = {")
    const specialistInputEnd = handoff.indexOf("let coordinated =", specialistInputStart)
    const specialistInput = handoff.slice(specialistInputStart, specialistInputEnd)
    const persistedResultStart = manager.indexOf("result_json: {")
    const persistedResultEnd = manager.indexOf("completed_at:", persistedResultStart)
    const persistedResult = manager.slice(persistedResultStart, persistedResultEnd)

    assert.ok(specialistInputStart >= 0)
    assert.doesNotMatch(specialistInput, /raw_text/)
    assert.doesNotMatch(specialistInput, /text_extracted/)
    assert.doesNotMatch(persistedResult, /raw_text/)
    assert.doesNotMatch(persistedResult, /prompt/i)
    assert.doesNotMatch(persistedResult, /assessment\.fields/)
})
