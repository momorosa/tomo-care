export default function PostVerifyActionsModal({
    open,
    onClose,
    documentTitle,
    isLibrela = false,
    recommendations = null,
    librelaLoading = false,
    insuranceClaimLoading = false,
    onCreateLibrelaReminder,
    onCreateInsuranceClaimReminder,
}) {
    if (!open) return null

    const actionInFlight = librelaLoading || insuranceClaimLoading

    const librelaRecommendation = recommendations?.librelaReminder || {
        show: true,
        disabled: !isLibrela,
        badge: isLibrela ? "Recommended" : null,
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-[560px] rounded-3xl border border-tomo-border bg-tomo-bg p-6 shadow-2xl">
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
                        <p className="mt-3 rounded-xl border border-tomo-border bg-white/[0.03] px-3 py-2 text-xs text-tomo-text">
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
                        body={
                            librelaRecommendation.disabled
                                ? "Available when the verified document includes a Librela injection."
                                : "Calculate Momo’s next expected dose and create a reminder before it is due."
                        }
                        hidden={!librelaRecommendation.show}
                        disabled={librelaRecommendation.disabled}
                        loading={librelaLoading}
                        loadingLabel="Creating…"
                        onClick={onCreateLibrelaReminder}
                    />

                    <ActionButton
                        title="Remind me to file insurance claim"
                        badge={insuranceClaimRecommendation.badge}
                        body="Create a reminder to file the Nationwide claim. Target: within 30 days of treatment. Final eligibility window: 180 days."
                        hidden={!insuranceClaimRecommendation.show}
                        disabled={insuranceClaimRecommendation.disabled}
                        loading={insuranceClaimLoading}
                        loadingLabel="Creating…"
                        onClick={onCreateInsuranceClaimReminder}
                    />

                    <ActionButton
                        title="Draft next appointment request"
                        badge={appointmentDraftRecommendation.badge}
                        body="Coming next: TomoCare will draft a message for SoMa Animal Hospital."
                        hidden={!appointmentDraftRecommendation.show}
                        disabled
                    />
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        className="tomo-btn tomo-btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={onClose}
                        disabled={actionInFlight}
                    >
                        Not now
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
    hidden = false,
    disabled = false,
    loading = false,
    loadingLabel = "Working…",
    onClick,
}) {
    if (hidden) return null

    const isDisabled = disabled || loading

    return (
        <button
            type="button"
            className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                isDisabled
                    ? "cursor-not-allowed border-tomo-border bg-white/[0.02] opacity-50"
                    : "border-tomo-border bg-white/[0.03] hover:border-purple-300/40 hover:bg-white/[0.05]"
            }`}
            disabled={isDisabled}
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-tomo-text-h">
                            {title}
                        </p>

                        {badge && (
                            <span className="rounded-full border border-purple-300/30 bg-purple-300/10 px-2 py-0.5 text-[10px] font-medium text-purple-200">
                                {badge}
                            </span>
                        )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-tomo-text">
                        {body}
                    </p>
                </div>

                <span className="shrink-0 rounded-full border border-tomo-border px-3 py-1 text-xs text-tomo-text">
                    {loading ? loadingLabel : disabled ? "Soon" : "Choose"}
                </span>
            </div>
        </button>
    )
}