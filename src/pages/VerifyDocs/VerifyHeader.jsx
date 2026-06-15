export default function VerifyHeader({
  statusPill,
  approving,
  canApprove,
  onApprove,
  unreviewedCount = 0,
  triageLoading = false,
}) {
  const showHint = !canApprove && unreviewedCount > 0 && !triageLoading

  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-tomo-text-h">
          Verify & Save
        </h1>
        <p className="text-tomo-text mt-2">
          Review what Tomo found in your document, make quick edits if needed,
          then save it as trusted records.
        </p>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
          {statusPill}

          <button
            className="px-4 py-2 rounded-lg tomo-accent-surface text-tomo-accent font-medium disabled:opacity-40
              hover:text-purple-300
              hover:cursor-pointer disabled:hover:cursor-not-allowed transition-opacity"
            onClick={onApprove}
            disabled={!canApprove || approving}
          >
            {approving ? "Approving…" : "Approve"}
          </button>
        </div>

        {showHint && (
          <p className="text-[11px] text-amber-300/80">
            Review {unreviewedCount} flagged field
            {unreviewedCount > 1 ? "s" : ""} to approve
          </p>
        )}

        {triageLoading && (
          <p className="text-[11px] text-tomo-text">
            AI reviewer running…
          </p>
        )}
      </div>
    </div>
  )
}