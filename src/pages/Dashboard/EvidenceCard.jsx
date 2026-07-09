import { useState } from "react"
import { fetchDocumentSourceUrl } from "./api.js"

export default function EvidenceCard({ citation }) {
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

    return (
        <div className="rounded-xl border border-tomo-border bg-white/[0.025] px-4 py-3 text-sm">
            <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="font-medium text-tomo-text-h">
                        {citation.display_title || citation.label || "Evidence"}
                    </p>

                    {citation.display_value && (
                        <p className="mt-1 text-sm text-tomo-text">
                            {citation.display_value}
                            {citation.display_date ? ` · ${citation.display_date}` : ""}
                        </p>
                    )}
                </div>

                {citation.verification_status && (
                    <span className="tomo-badge tomo-badge--success shrink-0">
                        {citation.verification_status}
                    </span>
                )}
            </div>

            <p className="mt-3 text-xs leading-5 text-tomo-text">
                Source: {citation.source_title || "Source document"}
            </p>

            {citation.verified_by && (
                <p className="mt-1 text-xs leading-5 text-tomo-text">
                    Verified by {citation.verified_by}
                </p>
            )}

            {citation.evidence_note && (
                <p className="mt-2 text-xs leading-5 text-tomo-text">
                    {citation.evidence_note}
                </p>
            )}

            {error && (
                <p className="mt-2 text-xs text-tomo-danger">
                    {error}
                </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
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
        </div>
    )
}