export default function VerifyHeader({
    statusPill,
    approving,
    canApprove,
    onApprove,
    onSyncCalendar,
}) {
    return (
        <div className="flex items-start justify-between gap-4 mb-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-tomo-text-h">
                    Verify & Save
                </h1>
                <p className="text-tomo-text mt-2">
                    Review what Tomo found in your document, make quick edits if needed, then save it as trusted records.
                </p>
            </div>

            <div className="flex items-center gap-2">
                {statusPill}

                <button
                    className="px-4 py-2 rounded-lg tomo-accent-surface text-tomo-accent font-medium disabled:opacity-50 
                    hover:text-purple-300
                    hover:cursor-pointer disabled:hover:cursor-not-allowed"
                    onClick={onApprove}
                    disabled={!canApprove || approving}
                >
                    {approving ? "Approving…" : "Approve"}
                </button>

                <button
                    className="px-4 py-2 rounded-lg border border-tomo-border text-tomo-text hover:text-tomo-text-h disabled:opacity-40 
                    hover:cursor-pointer disabled:hover:cursor-not-allowed"
                    onClick={onSyncCalendar}
                    disabled
                    title="Phase 1 action (separate approval): sync reminder to Google Calendar"
                >
                    Sync to calendar
                </button>
            </div>
        </div>
    )
}