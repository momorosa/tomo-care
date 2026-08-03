import test from "node:test"
import assert from "node:assert/strict"
import {
    getVoiceStageTurns,
    VOICE_STAGE_TURN_LIMIT,
} from "./voiceStageTranscript.js"

function makeTurn(id, role = "user") {
    return {
        id,
        role,
        ...(role === "user"
            ? { text: `Question ${id}` }
            : { answer: { answer: `Answer ${id}` } }),
    }
}

test("keeps the current exchange and only a little recent voice context", () => {
    const turns = [
        makeTurn("1"),
        makeTurn("2", "assistant"),
        makeTurn("3"),
        makeTurn("4", "assistant"),
        makeTurn("5"),
        makeTurn("6", "assistant"),
    ]

    const visible = getVoiceStageTurns(turns)

    assert.equal(visible.length, VOICE_STAGE_TURN_LIMIT)
    assert.deepEqual(
        visible.map((turn) => turn.id),
        ["3", "4", "5", "6"]
    )
    assert.deepEqual(
        visible.map((turn) => turn.receding),
        [true, true, false, false]
    )
    assert.equal(visible.at(-1).latest, true)
})

test("does not mutate the shared session transcript", () => {
    const turns = [makeTurn("1"), makeTurn("2", "assistant")]
    const visible = getVoiceStageTurns(turns)

    assert.notEqual(visible[0], turns[0])
    assert.equal("receding" in turns[0], false)
    assert.equal("latest" in turns[1], false)
})

test("falls back to the calm default window for an invalid limit", () => {
    const turns = Array.from({ length: 6 }, (_, index) => makeTurn(`${index + 1}`))

    assert.equal(getVoiceStageTurns(turns, 0).length, VOICE_STAGE_TURN_LIMIT)
})
