export default function VerifyHeader({
  statusPill,
  approving,
  canApprove,
  onApprove,
  isVerified = false,
  unreviewedCount = 0,
  flaggedTotal = 0,
  flaggedResolved = 0,
  triageLoading = false,
}) {
  const showHint = !canApprove && unreviewedCount > 0 && !triageLoading
  const showCounter = flaggedTotal > 0 && !triageLoading

  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-tomo-text-h">
          Verify & Save
        </h1>
        <p className="text-tomo-text mt-2">
          Review what Tomo found in this document, edit if needed, then save it
          to Momo&rsquo;s trusted records.
        </p>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-3 px-3 py-2">
          {statusPill}

          {showCounter && (
            <span
              className={`text-xs tabular-nums ${
                flaggedResolved >= flaggedTotal
                  ? "text-tomo-success"
                  : "text-tomo-text"
              }`}
            >
              {flaggedResolved} / {flaggedTotal} flags resolved
            </span>
          )}

          <button
            className="tomo-btn tomo-btn-primary disabled:opacity-40 disabled:hover:cursor-not-allowed"
            onClick={onApprove}
            disabled={!canApprove || approving}
          >
            {approving
              ? "Saving…"
              : isVerified
                ? "Saved to records"
                : "Approve & save record"}
          </button>
        </div>

        {showHint && (
          <p className="text-[11px] text-tomo-warning">
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