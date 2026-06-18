import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import NotificationCard from "../../components/NotificationCard.jsx"
import ReminderCard from "./ReminderCard.jsx"
import {
    checkInboxForDocuments,
    fetchPendingReviewDocuments,
    fetchReminders,
} from "./api.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"

function normalizeReviewDocuments(result) {
    if (!result?.reviewDocuments || !Array.isArray(result.reviewDocuments)) {
        return []
    }

    return result.reviewDocuments.filter((doc) => doc?.id)
}

function CheckResultSummary({ result }) {
    if (!result) return null

    const reviewDocuments = normalizeReviewDocuments(result)

    const emailsFound = result.emailsFound ?? 0
    const documentsCreated = result.documentsCreated ?? 0
    const processedToReview = result.processedToReview ?? reviewDocuments.length

    const skippedDuplicates =
        result.skippedDuplicates ??
        result.result?.ingestSummary?.skippedDuplicates ??
        0

    const failures =
        result.failedDocuments || result.failures || result.errors || []

    const hasNewReview = processedToReview > 0
    const safeSkip =
        emailsFound > 0 &&
        skippedDuplicates > 0 &&
        processedToReview === 0 &&
        documentsCreated === 0

    return (
        <section className="tomo-surface rounded-2xl p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="tomo-section-label mb-2">Inbox check</p>

                    <h2 className="text-lg font-semibold text-tomo-text-h">
                        {hasNewReview
                            ? "I found something for you to review."
                            : safeSkip
                              ? "I found that one already."
                              : "I did not find anything new."}
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-tomo-text">
                        {hasNewReview
                            ? "I processed the source PDF and prepared it for verification. Nothing has been added to Momo’s trusted care record yet."
                            : safeSkip
                              ? "The matching document already exists, so I skipped it safely and left verified records untouched."
                              : "No new canonical vet PDFs were ready to process this time."}
                    </p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
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
                                    : failure?.message ||
                                      failure?.error ||
                                      JSON.stringify(failure)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
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

function RemindersSection({
    reminders,
    loading,
    error,
    onRefresh,
    refreshing,
}) {
    return (
        <section className="tomo-surface rounded-2xl p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="tomo-section-label mb-2">Momo’s reminders</p>

                    <h2 className="text-lg font-semibold text-tomo-text-h">
                        What needs attention next
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-tomo-text">
                        Approved reminders live here after TomoCare prepares them.
                        Calendar links appear only after you approve the sync.
                    </p>
                </div>

                <button
                    type="button"
                    className="tomo-btn tomo-btn-secondary shrink-0 gap-2"
                    onClick={onRefresh}
                    disabled={refreshing}
                >
                    {refreshing && (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    Refresh
                </button>
            </div>

            {loading && (
                <p className="text-sm text-tomo-text">Loading reminders…</p>
            )}

            {error && (
                <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3">
                    <p className="text-sm font-medium text-red-200">
                        Could not load reminders
                    </p>
                    <p className="mt-1 text-sm text-red-100/80">{error}</p>
                </div>
            )}

            {!loading && !error && reminders.length === 0 && (
                <div className="rounded-2xl border border-tomo-border bg-white/[0.03] p-4">
                    <p className="text-sm font-medium text-tomo-text-h">
                        No planned reminders yet.
                    </p>
                    <p className="mt-1 text-sm leading-6 text-tomo-text">
                        Once you approve a document and create a reminder, it will
                        appear here.
                    </p>
                </div>
            )}

            {!loading && !error && reminders.length > 0 && (
                <div className="space-y-3">
                    {reminders.map((reminder) => (
                        <ReminderCard
                            key={reminder.id}
                            reminder={reminder}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}

export default function Dashboard() {
    const navigate = useNavigate()

    const [pendingReviewDocs, setPendingReviewDocs] = useState([])
    const [reminders, setReminders] = useState([])

    const [result, setResult] = useState(null)
    const [checkingInbox, setCheckingInbox] = useState(false)

    const [error, setError] = useState("")
    const [remindersError, setRemindersError] = useState("")

    const [loadingReminders, setLoadingReminders] = useState(false)
    const [refreshingReminders, setRefreshingReminders] = useState(false)

    const loadPendingReviewDocs = useCallback(async () => {
        try {
            const documents = await fetchPendingReviewDocuments(PET_ID)
            setPendingReviewDocs(documents)
        } catch (err) {
            console.error("[dashboard] pending review load failed:", err)
        }
    }, [])

    const loadReminders = useCallback(async ({ silent = false } = {}) => {
        if (silent) {
            setRefreshingReminders(true)
        } else {
            setLoadingReminders(true)
        }

        setRemindersError("")

        try {
            const items = await fetchReminders(PET_ID)
            setReminders(items)
        } catch (err) {
            setRemindersError(err.message)
        } finally {
            setLoadingReminders(false)
            setRefreshingReminders(false)
        }
    }, [])

    useEffect(() => {
        loadPendingReviewDocs()
        loadReminders()
    }, [loadPendingReviewDocs, loadReminders])

    const latestReviewDocuments = useMemo(
        () => normalizeReviewDocuments(result),
        [result]
    )

    const reviewDocuments =
        latestReviewDocuments.length > 0
            ? latestReviewDocuments
            : pendingReviewDocs

    const firstReviewDocument = reviewDocuments[0] || null
    const cardIsFromInboxCheck = latestReviewDocuments.length > 0
    const hasPendingReview = reviewDocuments.length > 0

    async function checkInbox() {
        setCheckingInbox(true)
        setError("")
        setResult(null)

        try {
            const data = await checkInboxForDocuments()

            setResult(data)

            if (data.reviewDocuments?.length > 0) {
                setPendingReviewDocs(data.reviewDocuments)
            } else {
                await loadPendingReviewDocs()
            }

            await loadReminders({ silent: true })
        } catch (err) {
            setError(err.message)
        } finally {
            setCheckingInbox(false)
        }
    }

    return (
        <main className="min-h-[calc(100svh-64px)] bg-tomo-bg text-tomo-text">
            <div className="mx-auto max-w-[1120px] px-6 py-8 md:px-8 md:py-10">
                <section className="relative overflow-hidden rounded-3xl border border-tomo-border bg-white/[0.03] p-6 md:p-8">
                    <div className="pointer-events-none absolute right-[-120px] top-[-120px] h-72 w-72 rounded-full bg-tomo-accent/10 blur-3xl" />

                    <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="tomo-section-label mb-3">
                                Momo’s care desk
                            </p>

                            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-tomo-text-h md:text-4xl">
                                Hi Rosa, I’m here to help keep Momo’s care on track.
                            </h1>

                            <p className="mt-4 max-w-2xl text-sm leading-6 text-tomo-text">
                                I can check the inbox for vet PDFs, prepare the record,
                                and bring anything new to you before it becomes part of
                                Momo’s trusted care history.
                            </p>

                            <div className="mt-5 flex flex-wrap gap-2">
                                <StatusChip
                                    label="Inbox"
                                    value={checkingInbox ? "Checking now" : "Ready"}
                                />

                                <StatusChip
                                    label="Review queue"
                                    value={
                                        hasPendingReview
                                            ? `${reviewDocuments.length} waiting`
                                            : "Clear"
                                    }
                                />

                                <StatusChip
                                    label="Reminders"
                                    value={
                                        reminders.length > 0
                                            ? `${reminders.length} active`
                                            : "Clear"
                                    }
                                />

                                <StatusChip
                                    label="Actions"
                                    value="Approval-gated"
                                />
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                            <button
                                type="button"
                                className="tomo-btn tomo-btn-primary gap-2"
                                onClick={checkInbox}
                                disabled={checkingInbox}
                            >
                                {checkingInbox && (
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                )}
                                {checkingInbox ? "Checking inbox…" : "Check inbox"}
                            </button>

                            {checkingInbox && (
                                <p className="text-[11px] text-tomo-text">
                                    This can take up to ~30s.
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                <div className="mt-5 space-y-5">
                    <RemindersSection
                        reminders={reminders}
                        loading={loadingReminders}
                        error={remindersError}
                        refreshing={refreshingReminders}
                        onRefresh={() => loadReminders({ silent: true })}
                    />

                    {error && (
                        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4">
                            <p className="text-sm font-medium text-red-200">
                                Inbox check failed
                            </p>
                            <p className="mt-1 text-sm text-red-100/80">
                                {error}
                            </p>
                        </div>
                    )}

                    {firstReviewDocument && (
                        <NotificationCard
                            eyebrow="Needs your review"
                            title="New document ready for review"
                            body={
                                cardIsFromInboxCheck
                                    ? "I found and processed a new document. Please review it before I add it to Momo’s trusted care record."
                                    : "A document is waiting in the verification queue. Please review it before I add it to Momo’s trusted care record."
                            }
                            meta={[
                                firstReviewDocument.title,
                                firstReviewDocument.source_org,
                                firstReviewDocument.doc_type,
                                reviewDocuments.length > 1
                                    ? `${reviewDocuments.length} documents ready`
                                    : null,
                            ]}
                            actionLabel="Review now"
                            onAction={() =>
                                navigate(`/review/${firstReviewDocument.id}`)
                            }
                        />
                    )}

                    <CheckResultSummary result={result} />
                </div>
            </div>
        </main>
    )
}

function StatusChip({ label, value }) {
    return (
        <div className="rounded-full border border-tomo-border bg-white/[0.03] px-3 py-1.5">
            <span className="text-[11px] uppercase tracking-[0.18em] text-tomo-text">
                {label}
            </span>

            <span className="ml-2 text-xs font-medium text-tomo-text-h">
                {value}
            </span>
        </div>
    )
}