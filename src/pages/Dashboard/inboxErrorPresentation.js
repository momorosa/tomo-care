const INBOX_ERROR_PRESENTATIONS = {
    gmail_reauthorization_required: {
        title: "Tomo’s inbox key stopped working.",
        message: "Reconnect Gmail, then try the inbox again.",
    },
    gmail_configuration_required: {
        title: "Tomo can’t find the inbox key.",
        message: "Connect Gmail, then try the inbox again.",
    },
    demo_gmail_configuration_required: {
        title: "The demo inbox needs its allowlist.",
        message: "Add the demo sender and recipient locally, then restart TomoCare.",
    },
    demo_gmail_account_mismatch: {
        title: "This isn’t the approved demo inbox.",
        message: "Review the local demo Gmail connection before trying again.",
    },
    demo_gmail_runtime_mismatch: {
        title: "Demo inbox access stayed blocked.",
        message: "Restart TomoCare with the validated demo configuration.",
    },
}

const DEFAULT_INBOX_ERROR = {
    title: "The inbox is playing hard to fetch.",
    message: "Give it a moment, then try again.",
}

export function getInboxErrorPresentation(error) {
    return INBOX_ERROR_PRESENTATIONS[error?.reason] || DEFAULT_INBOX_ERROR
}
