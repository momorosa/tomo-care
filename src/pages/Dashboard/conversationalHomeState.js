export const HOME_SECTIONS = Object.freeze({
    PROFILE: "profile",
    REMINDERS: "reminders",
    INBOX: "inbox",
    VERIFIED: "verified",
})

export const CONVERSATION_MODES = Object.freeze({
    VOICE: "voice",
    CHAT: "chat",
})

export function createConversationalHomeState() {
    return {
        activeSection: HOME_SECTIONS.PROFILE,
        navigationCollapsed: false,
        drawerOpen: true,
    }
}

export function reduceConversationalHome(state, action) {
    switch (action.type) {
        case "select_section":
            if (!Object.values(HOME_SECTIONS).includes(action.section)) {
                return state
            }

            return {
                ...state,
                activeSection: action.section,
                drawerOpen: true,
            }
        case "collapse_navigation":
            return {
                ...state,
                navigationCollapsed: true,
                drawerOpen: false,
            }
        case "expand_navigation":
            return {
                ...state,
                navigationCollapsed: false,
            }
        case "close_drawer":
            return {
                ...state,
                drawerOpen: false,
            }
        case "open_drawer":
            return {
                ...state,
                drawerOpen: true,
            }
        default:
            return state
    }
}

export function appendConversationExchange(turns, question, answer) {
    const revision = answer?.attention_revision || `${turns.length + 1}`

    return [
        ...turns,
        {
            id: `you-${revision}`,
            role: "user",
            text: question,
        },
        {
            id: `tomo-${revision}`,
            role: "assistant",
            answer,
        },
    ]
}
