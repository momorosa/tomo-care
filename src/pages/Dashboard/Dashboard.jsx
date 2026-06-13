import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

function normalizeReviewDocuments(result) {
    return (
        result?.reviewDocuments ||
        result?.documentsReadyForReview ||
        result?.processedDocuments ||
        result?.documents ||
        []
    ).filter((doc) => doc?.id)
}

function CheckResultSummary({ result }) {
    if (!result) return null

    const reviewDocuments = normalizeReviewDocuments(result)
    const emailsFound = result.emailsFound ?? 0
    const documentsCreated = result.documentsCreated ?? 0
    const processedToReview = result.processedToReview ?? reviewDocuments.length
    const skippedDuplicates = result.skippedDuplicates ?? 0
    const failures = result.failures || result.errors || []

    return (
        <div className="tomo-surface rounded-2xl p-5">
            <p className="tomo-section-label mb-3">Inbox check result</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryItem label="Emails found" value={emailsFound} />
                <SummaryItem label="Documents created" value={documentsCreated} />
                <SummaryItem label="Ready for review" value={processedToReview} />
                <SummaryItem label="Duplicates skipped" value={skippedDuplicates} />
            </div>

            {failures.length > 0 && (
                <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3">
                    <p className="text-sm font-medium text-red-200">
                        Some documents failed to process.
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-red-100/80">
                        {failures.map((failure, index) => (
                            <li key={index}>
                                {typeof failure === "string"
                                    ? failure
                                    : failure?.message || JSON.stringify(failure)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {emailsFound > 0 &&
                skippedDuplicates > 0 &&
                processedToReview === 0 &&
                documentsCreated === 0 && (
                    <p className="mt-4 text-sm text-tomo-text">
                        TomoCare found an existing document and skipped it safely. No
                        verified records were moved back into review.
                    </p>
                )}

            {emailsFound === 0 && (
                <p className="mt-4 text-sm text-tomo-text">
                    No new PDF attachments were found in the inbox.
                </p>
            )}
        </div>
    )
}

function SummaryItem({ label, value }) {
    return (
        <div className="rounded-xl border border-tomo-border bg-white/[0.03] px-4 py-3">
            <p className="text-2xl font-semibold text-tomo-text-h">{value}</p>
            <p className="mt-1 text-xs text-tomo-text">{label}</p>
        </div>
    )
}

function ReviewNotificationCard({ document, reviewCount }) {
    const navigate = useNavigate()

    if (!document) return null

    return (
        <div className="tomo-accent-surface rounded-2xl p-5 border border-tomo-accent/30">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="tomo-section-label mb-2">Needs your review</p>

                    <h2 className="text-xl font-semibold text-tomo-text-h">
                        New document ready for review
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-tomo-text">
                        TomoCare found and processed a new document. Review it before
                        adding it to Momo’s trusted care record.
                    </p>

                    {reviewCount > 1 && (
                        <p className="mt-2 text-xs text-tomo-text">
                            {reviewCount} documents are ready. This button opens the first
                            one.
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    className="tomo-btn tomo-btn-primary shrink-0"
                    onClick={() => navigate(`/review/${document.id}`)}
                >
                    Review now
                </button>
            </div>
        </div>
    )
}

export default function Dashboard() {
    const [checkingInbox, setCheckingInbox] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState("")

    const reviewDocuments = useMemo(
        () => normalizeReviewDocuments(result),
        [result]
    )

    const firstReviewDocument = reviewDocuments[0] || null

    async function checkInbox() {
        setCheckingInbox(true)
        setError("")
        setResult(null)

        try {
            const response = await fetch("/api/gmail/check-inbox", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            })

            const data = await response.json()

            if (!response.ok || data.error) {
                throw new Error(data.error || "Inbox check failed")
            }

            setResult(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setCheckingInbox(false)
        }
    }

    return (
        <main className="min-h-[calc(100svh-64px)] bg-tomo-bg text-tomo-text">
            <div className="mx-auto max-w-[1120px] px-6 py-8 md:px-8 md:py-10">
                <section className="tomo-surface rounded-3xl p-6 md:p-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="tomo-section-label mb-3">
                                TomoCare dashboard
                            </p>

                            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-tomo-text-h md:text-4xl">
                                Momo’s care record, checked and prepared before anything
                                becomes trusted.
                            </h1>

                            <p className="mt-4 max-w-2xl text-sm leading-6 text-tomo-text">
                                TomoCare can check the inbox, process canonical vet PDFs,
                                and route new candidate records into verification. You stay
                                in control before anything becomes part of Momo’s trusted
                                care history.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="tomo-btn tomo-btn-primary shrink-0"
                            onClick={checkInbox}
                            disabled={checkingInbox}
                        >
                            {checkingInbox ? "Checking inbox..." : "Check inbox"}
                        </button>
                    </div>
                </section>

                <div className="mt-5 space-y-5">
                    {error && (
                        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4">
                            <p className="text-sm font-medium text-red-200">
                                Inbox check failed
                            </p>
                            <p className="mt-1 text-sm text-red-100/80">{error}</p>
                        </div>
                    )}

                    <ReviewNotificationCard
                        document={firstReviewDocument}
                        reviewCount={reviewDocuments.length}
                    />

                    <CheckResultSummary result={result} />

                    <section className="grid gap-4 md:grid-cols-3">
                        <DashboardCard
                            label="Trusted truth"
                            title="Verified records"
                            body="Only approved documents become trusted rows for reminders, timelines, and future actions."
                        />

                        <DashboardCard
                            label="Candidate truth"
                            title="Needs review"
                            body="Newly processed documents wait here until the source and extraction are checked side by side."
                        />

                        <DashboardCard
                            label="Next action"
                            title="Approval gate"
                            body="TomoCare can prepare next steps, but external actions stay approval-gated."
                        />
                    </section>
                </div>
            </div>
        </main>
    )
}

function DashboardCard({ label, title, body }) {
    return (
        <div className="tomo-surface rounded-2xl p-5">
            <p className="tomo-section-label mb-3">{label}</p>
            <h3 className="text-base font-semibold text-tomo-text-h">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-tomo-text">{body}</p>
        </div>
    )
}