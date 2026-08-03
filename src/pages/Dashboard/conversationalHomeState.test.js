import test from "node:test"
import assert from "node:assert/strict"
import {
    appendConversationExchange,
    createConversationalHomeState,
    HOME_SECTIONS,
    reduceConversationalHome,
} from "./conversationalHomeState.js"

test("starts with Voice canvas space beside Momo's open care profile", () => {
    assert.deepEqual(createConversationalHomeState(), {
        activeSection: HOME_SECTIONS.PROFILE,
        navigationCollapsed: false,
        drawerOpen: true,
    })
})

test("collapsing navigation also closes the contextual drawer", () => {
    const state = reduceConversationalHome(
        createConversationalHomeState(),
        { type: "collapse_navigation" }
    )

    assert.equal(state.navigationCollapsed, true)
    assert.equal(state.drawerOpen, false)
})

test("selecting a section opens it without forcing navigation labels open", () => {
    const collapsed = reduceConversationalHome(
        createConversationalHomeState(),
        { type: "collapse_navigation" }
    )
    const reminders = reduceConversationalHome(collapsed, {
        type: "select_section",
        section: HOME_SECTIONS.REMINDERS,
    })

    assert.equal(reminders.navigationCollapsed, true)
    assert.equal(reminders.drawerOpen, true)
    assert.equal(reminders.activeSection, HOME_SECTIONS.REMINDERS)
})

test("conversation exchanges accumulate for the current session", () => {
    const first = appendConversationExchange([], "First question", {
        attention_revision: 1,
        answer: "First answer",
    })
    const second = appendConversationExchange(first, "Second question", {
        attention_revision: 2,
        answer: "Second answer",
    })

    assert.equal(second.length, 4)
    assert.deepEqual(
        second.map((turn) => turn.role),
        ["user", "assistant", "user", "assistant"]
    )
    assert.equal(second[0].text, "First question")
    assert.equal(second[3].answer.answer, "Second answer")
})
