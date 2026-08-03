const INBOX_ERROR_PRESENTATIONS = {
    gmail_reauthorization_required: {
        title: "Tomo’s inbox key stopped working.",
        message: "Reconnect Gmail, then try the inbox again.",
    },
    gmail_configuration_required: {
        title: "Tomo can’t find the inbox key.",
        message: "Connect Gmail, then try the inbox again.",
    },
}

const DEFAULT_INBOX_ERROR = {
    title: "The inbox is playing hard to fetch.",
    message: "Give it a moment, then try again.",
}

export function getInboxErrorPresentation(error) {
    return INBOX_ERROR_PRESENTATIONS[error?.reason] || DEFAULT_INBOX_ERROR
}
