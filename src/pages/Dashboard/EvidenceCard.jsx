import { useState } from "react"
import { formatDisplayDate } from "../../lib/displayDate.js"
import { fetchDocumentSourceUrl } from "./api.js"
import { getCompactReminderPresentation } from "./reminderPresentation.js"

export default function EvidenceCard({ citation, reminder = null }) {
    const [openingPdf, setOpeningPdf] = useState(false)
    const [error, setError] = useState("")

    async function handleOpenSourcePdf() {
        if (!citation.doc_id) return

        setOpeningPdf(true)
        setError("")

        const pdfWindow = window.open("about:blank", "_blank")

        try {
            const data = await fetchDocumentSourceUrl(citation.doc_id)

            if (!data?.url) {
                throw new Error("No source PDF URL was returned.")
            }

            if (pdfWindow) {
                pdfWindow.opener = null
                pdfWindow.location.href = data.url
            } else {
                window.open(data.url, "_blank", "noopener,noreferrer")
            }
        } catch (err) {
            if (pdfWindow) {
                pdfWindow.close()
            }

            setError(err?.message || "Could not open source PDF.")
        } finally {
            setOpeningPdf(false)
        }
    }

    const reminderMeta = reminder
        ? getCompactReminderPresentation(reminder)
        : null

    return (
        <div
            className={`tomo-evidence-card ${reminderMeta ? `tomo-evidence-card--reminder tomo-compact-reminder--${reminderMeta.kind}` : ""}`}
        >
            {reminderMeta ? (
                <ReminderEvidenceHeader meta={reminderMeta} />
            ) : (
                <div className="flex flex-col gap-1 px-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="font-medium text-tomo-text-h">
                            {citation.display_title || citation.label || "Evidence"}
                        </p>

                        {citation.display_value && (
                            <p className="mt-1 text-sm text-tomo-text">
                                {citation.display_value}
                                {!displayValueAlreadyContainsDate(citation) &&
                                citation.display_date
                                    ? ` · ${formatDisplayDate(citation.display_date)}`
                                    : ""}
                            </p>
                        )}
                    </div>

                    {citation.verification_status && (
                        <span className="tomo-badge tomo-badge--success shrink-0">
                            {citation.verification_status}
                        </span>
                    )}
                </div>
            )}

            <p className="mt-3 px-4 text-xs leading-5 text-tomo-text">
                Source: {citation.source_title || "Source document"}
            </p>

            {citation.verified_by && (
                <p className="mt-1 px-4 text-xs leading-5 text-tomo-text">
                    Verified by {citation.verified_by}
                </p>
            )}

            {citation.evidence_note && (
                <p className="mt-2 px-4 text-xs leading-5 text-tomo-text">
                    {citation.evidence_note}
                </p>
            )}

            {error && (
                <p className="mt-2 px-4 text-xs text-tomo-danger">
                    {error}
                </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 px-4 pb-3">
                {citation.source_pdf_available && citation.doc_id && (
                    <button
                        type="button"
                        onClick={handleOpenSourcePdf}
                        disabled={openingPdf}
                        className="tomo-btn tomo-btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {openingPdf ? "Opening…" : "View source PDF"}
                    </button>
                )}

                {citation.verification_url && (
                    <a
                        href={citation.verification_url}
                        className="tomo-btn tomo-btn-secondary px-3 py-1.5 text-xs"
                    >
                        Open verification record
                    </a>
                )}
            </div>

            {reminderMeta && (
                <a
                    href={reminderMeta.calendarUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="tomo-calendar-footer"
                    aria-label={`Open ${reminderMeta.title} in Google Calendar`}
                >
                    <span
                        className="material-symbols-outlined text-lg"
                        aria-hidden="true"
                    >
                        calendar_month
                    </span>
                    Calendar
                </a>
            )}
        </div>
    )
}

function ReminderEvidenceHeader({ meta }) {
    return (
        <div className="tomo-evidence-reminder__summary">
            <div className="tomo-compact-reminder__icon" aria-hidden="true">
                <span className="material-symbols-outlined">{meta.icon}</span>
            </div>
            <div className="min-w-0">
                <p className="tomo-compact-reminder__eyebrow">{meta.eyebrow}</p>
                <p className="tomo-compact-reminder__title">{meta.title}</p>
                <p className="mt-1 text-xs tabular-nums text-tomo-text">
                    {meta.dateLabel}
                </p>
            </div>
            <span className={`tomo-badge self-start ${meta.badgeClass}`}>
                {meta.statusLabel}
            </span>
        </div>
    )
}

function displayValueAlreadyContainsDate(citation) {
    if (!citation.display_value || !citation.display_date) return false
    if (["events", "documents"].includes(citation.table)) return true

    const isoDate = String(citation.display_date).slice(0, 10)
    const displayDate = formatDisplayDate(citation.display_date)
    const value = String(citation.display_value)

    return value.includes(isoDate) || value.includes(displayDate)
}
