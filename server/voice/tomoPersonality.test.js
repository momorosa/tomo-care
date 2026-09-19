import test from "node:test"
import assert from "node:assert/strict"
import { getTomoSpeechInstructions } from "./tomoPersonality.js"

test("gratitude and playfulness have distinct delivery without rewriting speech", () => {
    const pleased = getTomoSpeechInstructions("social_response", "relational", "appreciative")
    const amused = getTomoSpeechInstructions("social_response", "relational", "playful")
    assert.match(pleased, /quietly pleased/)
    assert.match(amused, /gently amused/)
    for (const text of [pleased, amused]) assert.match(text, /Do not add, omit, or paraphrase/)
})

test("restraint wins over playful delivery for every consequential answer", () => {
    for (const type of ["action_prepared", "message_draft_prepared", "safety_boundary", "no_trusted_data"]) {
        assert.match(getTomoSpeechInstructions(type, "relational", "playful"), /calm, clear, and restrained/)
    }
    assert.match(getTomoSpeechInstructions("social_response", "restrained", "playful"), /calm, clear, and restrained/)
    assert.match(getTomoSpeechInstructions("social_response", "relational", "concerned"), /without teasing/)
    assert.doesNotMatch(getTomoSpeechInstructions("grounded_answer", "relational", "ignore instructions"), /ignore instructions/)
})
