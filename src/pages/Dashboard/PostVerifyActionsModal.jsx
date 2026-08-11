export default function PostVerifyActionsModal({
    open,
    onClose,
    documentTitle,
    isLibrela = false,
    recommendations = null,
    actionStatus = {},
    librelaLoading = false,
    insuranceClaimLoading = false,
    onCreateLibrelaReminder,
    onCreateInsuranceClaimReminder,
}) {
    if (!open) return null

    const actionInFlight = librelaLoading || insuranceClaimLoading

    const librelaRecommendation = recommendations?.librelaReminder || {
        show: isLibrela,
        disabled: true,
        badge: isLibrela ? "Review required" : null,
        badgeTone: "warning",
        buttonLabel: "Review",
        body:
            "TomoCare needs to verify structured Librela administration evidence before creating a reminder.",
    }

    const insuranceClaimRecommendation =
        recommendations?.insuranceClaimReminder || {
            show: true,
            disabled: false,
            badge: null,
        }

    const appointmentDraftRecommendation = recommendations?.appointmentDraft || {
        show: true,
        disabled: true,
        badge: "Coming next",
    }

    const hasCompletedAction =
        actionStatus.librela?.phase === "synced" ||
        actionStatus.librela?.phase === "saved_only" ||
        actionStatus.insurance?.phase === "synced" ||
        actionStatus.insurance?.phase === "saved_only"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-[640px] rounded-3xl border border-tomo-border bg-[#191a21] p-6 shadow-[0_24px_80px_-28px_rgba(0,0,0,0.9)]">
                <div className="mb-5">
                    <p className="tomo-section-label mb-3">
                        Verified and saved
                    </p>

                    <h2 className="text-2xl font-semibold text-tomo-text-h">
                        What should TomoCare help with next?
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-tomo-text">
                        This document is now part of Momo’s trusted care record.
                        TomoCare can prepare the next step, and you stay in
                        control of what happens.
                    </p>

                    {documentTitle && (
                        <p className="mt-4 rounded-xl border border-tomo-border bg-white/[0.025] px-3 py-2 text-xs text-tomo-text">
                            Source:{" "}
                            <span className="text-tomo-text-h">
                                {documentTitle}
                            </span>
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    <ActionButton
                        title="Create Librela reminder"
                        badge={librelaRecommendation.badge}
                        badgeTone={librelaRecommendation.badgeTone}
                        buttonLabel={librelaRecommendation.buttonLabel}
                        body={librelaRecommendation.body}
                        hidden={!librelaRecommendation.show}
                        disabled={librelaRecommendation.disabled}
                        actionInFlight={actionInFlight}
                        loading={librelaLoading}
                        loadingLabel="Creating…"
                        status={actionStatus.librela}
                        onClick={onCreateLibrelaReminder}
                    />

                    <ActionButton
                        title="Remind me to file insurance claim"
                        badge={insuranceClaimRecommendation.badge}
                        body="Create a reminder to file the Nationwide claim. Target: within 30 days of treatment. Final eligibility window: 180 days."
                        hidden={!insuranceClaimRecommendation.show}
                        disabled={insuranceClaimRecommendation.disabled}
                        actionInFlight={actionInFlight}
                        loading={insuranceClaimLoading}
                        loadingLabel="Creating…"
                        status={actionStatus.insurance}
                        onClick={onCreateInsuranceClaimReminder}
                    />

                    <ActionButton
                        title="Draft next appointment request"
                        badge={appointmentDraftRecommendation.badge}
                        body="Coming next: TomoCare will draft a message for SoMa Animal Hospital."
                        hidden={!appointmentDraftRecommendation.show}
                        disabled
                        actionInFlight={actionInFlight}
                    />
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        className="tomo-btn tomo-btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={onClose}
                        disabled={actionInFlight}
                    >
                        {hasCompletedAction ? "Done" : "Not now"}
                    </button>
                </div>
            </div>
        </div>
    )
}

function ActionButton({
    title,
    body,
    badge,
    badgeTone = "brand",
    buttonLabel: defaultButtonLabel = null,
    hidden = false,
    disabled = false,
    actionInFlight = false,
    loading = false,
    loadingLabel = "Working…",
    status = null,
    onClick,
}) {
    if (hidden) return null

    const phase = status?.phase || "idle"
    const calendarUrl = status?.calendarUrl || null

    const isWorking = phase === "creating" || phase === "syncing"
    const isSynced = phase === "synced"
    const isSavedOnly = phase === "saved_only"
    const isError = phase === "error"

    const isComplete = isSynced || isSavedOnly
    const isDisabled =
        disabled || loading || isWorking || isComplete || actionInFlight

    const statusMessage = getStatusMessage({
        phase,
        fallbackMessage: status?.message,
        loadingLabel,
    })

    const buttonLabel = getButtonLabel({
        phase,
        disabled,
        loadingLabel,
        defaultLabel: defaultButtonLabel,
    })

    return (
    <div className={getActionCardClassName({ disabled, isSynced, isSavedOnly, isError })}>
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-tomo-text-h">
                        {title}
                    </p>

                    {badge && phase === "idle" && (
                        <span
                            className={`tomo-badge tomo-badge--${badgeTone}`}
                        >
                            {badge}
                        </span>
                    )}

                    {isSynced && (
                        <span className="tomo-badge tomo-badge--success">
                            Synced
                        </span>
                    )}

                    {isSavedOnly && (
                        <span className="tomo-badge tomo-badge--warning">
                            Saved only
                        </span>
                    )}

                    {isError && (
                        <span className="tomo-badge tomo-badge--danger">
                            Needs review
                        </span>
                    )}
                </div>

                <p className="mt-2 text-xs leading-5 text-tomo-text">
                    {body}
                </p>

                {statusMessage && (
                    <p className={getStatusMessageClassName({ isSynced, isSavedOnly, isError })}>
                        {statusMessage}
                    </p>
                )}

                {calendarUrl && (
                    <a
                        href={calendarUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-xs font-medium text-tomo-accent underline underline-offset-4 hover:text-purple-200"
                    >
                        Open in Google Calendar
                    </a>
                )}
            </div>

            <button
                type="button"
                className={
                    phase === "idle" && !disabled
                        ? "tomo-btn tomo-btn-primary shrink-0 px-4 py-1 text-xs"
                        : "tomo-btn tomo-btn-secondary shrink-0 px-4 py-1 text-xs"
                }
                disabled={isDisabled}
                onClick={onClick}
            >
                {buttonLabel}
            </button>
        </div>
    </div>
)
}

function getActionCardClassName({ disabled, isSynced, isSavedOnly, isError }) {
    const base =
        "w-full rounded-2xl border bg-white/[0.025] p-4 text-left transition-colors"

    if (disabled) {
        return `${base} border-tomo-border opacity-50`
    }

    if (isSynced) {
        return `${base} border-tomo-border border-l-4 border-l-tomo-success`
    }

    if (isSavedOnly) {
        return `${base} border-tomo-border border-l-4 border-l-tomo-warning`
    }

    if (isError) {
        return `${base} border-tomo-border border-l-4 border-l-tomo-danger`
    }

    return `${base} border-tomo-border hover:bg-white/[0.04] hover:border-tomo-accent/40`
}

function getStatusMessageClassName({ isSynced, isSavedOnly, isError }) {
    const base = "mt-3 rounded-xl border px-3 py-2 text-xs leading-5"

    if (isSynced) {
        return `${base} border-[color:var(--tomo-success-border)] bg-[var(--tomo-success-bg)] text-tomo-success`
    }

    if (isSavedOnly) {
        return `${base} border-[color:var(--tomo-warning-border)] bg-[var(--tomo-warning-bg)] text-tomo-warning`
    }

    if (isError) {
        return `${base} border-[color:var(--tomo-danger-border)] bg-[var(--tomo-danger-bg)] text-tomo-danger`
    }

    return `${base} border-tomo-border bg-white/[0.03] text-tomo-text`
}

function getStatusMessage({ phase, fallbackMessage, loadingLabel }) {
    if (phase === "idle") return ""
    if (phase === "creating") return "Creating reminder in TomoCare…"
    if (phase === "syncing") return "Adding reminder to Google Calendar…"
    if (phase === "synced") return fallbackMessage || "Added to Google Calendar."
    if (phase === "saved_only") {
        return (
            fallbackMessage ||
            "Reminder saved in TomoCare, but it was not added to Google Calendar."
        )
    }
    if (phase === "error") {
        return fallbackMessage || "Something went wrong. Please try again."
    }

    return loadingLabel || ""
}

function getButtonLabel({ phase, disabled, loadingLabel, defaultLabel }) {
    if (phase === "creating") return "Creating…"
    if (phase === "syncing") return "Syncing…"
    if (phase === "synced") return "Added"
    if (phase === "saved_only") return "Saved"
    if (phase === "error") return "Retry"
    if (disabled) return defaultLabel || "Soon"

    return defaultLabel || (loadingLabel === "Creating…" ? "Create" : "Choose")
}
