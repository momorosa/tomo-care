import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import NotificationCard from "../../components/NotificationCard.jsx"
import ReminderCard from "./ReminderCard.jsx"
import AssistantPanel from "./AssistantPanel.jsx"
import CareActionDialog from "./CareActionDialog.jsx"
import LibrelaAppointmentMessageDialog from "./LibrelaAppointmentMessageDialog.jsx"
import {
    approveCareAction,
    cancelCareAction,
    checkInboxForDocuments,
    executeCareAction,
    fetchCareAction,
    fetchCareSummary,
    fetchPendingCareActions,
    fetchPendingReviewDocuments,
    fetchReminders,
    fetchVerifiedDocuments,
    prepareHomeMedicationGiven,
    prepareInsuranceClaimFiled,
    prepareLibrelaAppointmentRequest,
    syncReminderToGoogleCalendar,
} from "./api.js"
import {
    buildRecoveredLibrelaDraft,
    getRecoveredCareActionPhase,
    getOutboundExecutionErrorPhase,
    isLibrelaAppointmentRequest,
} from "./careActionRecovery.js"

const PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"
const CARE_ACTOR = "Rosa"
const ACTIVE_ACTION_STORAGE_KEY = "tomocare.active-care-action-id"
const MARK_HOME_MEDICATION_GIVEN = "mark_home_medication_given"
const MARK_INSURANCE_CLAIM_FILED = "mark_insurance_claim_filed"

function emptyActionFlow() {
    return {
        phase: "idle",
        reminder: null,
        action: null,
        actionType: null,
        selectedDate: getPacificCareDate(),
        execution: null,
        error: null,
    }
}

function emptyAppointmentMessageFlow() {
    return {
        phase: "idle",
        draft: null,
        action: null,
        execution: null,
        error: null,
    }
}

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
                    <p className="tomo-section-label mb-2">Latest inbox check</p>

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
    onRecordGiven,
    onMarkFiled,
    onSyncCalendar,
    calendarSyncByReminder,
}) {
    return (
        <section className="rounded-2xl border border-tomo-border bg-white/[0.035] p-6 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.7)]">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="tomo-section-label mb-2">Momo’s reminders</p>

                    <h2 className="text-lg font-semibold text-tomo-text-h">
                        What needs attention next
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-tomo-text">
                        Approved reminders live here after TomoCare prepares them.
                        Add home-medication reminders to Google Calendar whenever
                        you’re ready.
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
                            onRecordGiven={onRecordGiven}
                            onMarkFiled={onMarkFiled}
                            onSyncCalendar={onSyncCalendar}
                            calendarSync={
                                calendarSyncByReminder[reminder.id] || null
                            }
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
    const [verifiedDocuments, setVerifiedDocuments] = useState([])
    const [careSummary, setCareSummary] = useState({})
    const [pendingActionCount, setPendingActionCount] = useState(0)
    const [actionFlow, setActionFlow] = useState(emptyActionFlow)
    const [appointmentMessageFlow, setAppointmentMessageFlow] = useState(
        emptyAppointmentMessageFlow
    )

    const [result, setResult] = useState(null)
    const [checkingInbox, setCheckingInbox] = useState(false)

    const [error, setError] = useState("")
    const [remindersError, setRemindersError] = useState("")

    const [loadingReminders, setLoadingReminders] = useState(false)
    const [refreshingReminders, setRefreshingReminders] = useState(false)
    const [calendarSyncByReminder, setCalendarSyncByReminder] = useState({})

    const loadPendingReviewDocs = useCallback(async () => {
        try {
            const documents = await fetchPendingReviewDocuments(PET_ID)
            setPendingReviewDocs(documents)
        } catch (err) {
            console.error("[dashboard] pending review load failed:", err)
        }
    }, [])

    const loadVerifiedDocuments = useCallback(async () => {
        try {
            const documents = await fetchVerifiedDocuments(PET_ID)
            setVerifiedDocuments(documents)
        } catch (err) {
            console.error("[dashboard] verified documents load failed:", err)
        }
    }, [])

    const loadCareSummary = useCallback(async () => {
        try {
            const summary = await fetchCareSummary(PET_ID)
            setCareSummary(summary)
        } catch (err) {
            console.error("[dashboard] care summary load failed:", err)
        }
    }, [])

    const loadPendingCareActions = useCallback(async () => {
        try {
            const result = await fetchPendingCareActions(PET_ID)
            setPendingActionCount(result.count)
        } catch (err) {
            console.error("[dashboard] pending action load failed:", err)
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
        loadVerifiedDocuments()
        loadCareSummary()
        loadPendingCareActions()
        loadReminders()
    }, [
        loadPendingReviewDocs,
        loadVerifiedDocuments,
        loadCareSummary,
        loadPendingCareActions,
        loadReminders,
    ])

    useEffect(() => {
        const actionId = window.sessionStorage.getItem(ACTIVE_ACTION_STORAGE_KEY)
        if (!actionId) return

        let active = true

        setActionFlow((current) => ({
            ...current,
            phase: "recovering",
            error: null,
        }))

        fetchCareAction(actionId)
            .then((data) => {
                if (!active) return

                const action = data.care_action
                const nextPhase = getRecoveredCareActionPhase(action)

                if (nextPhase === "idle") {
                    clearStoredAction()
                    setActionFlow(emptyActionFlow())
                    setAppointmentMessageFlow(emptyAppointmentMessageFlow())
                    return
                }

                if (isLibrelaAppointmentRequest(action)) {
                    setActionFlow(emptyActionFlow())
                    setAppointmentMessageFlow({
                        phase: nextPhase,
                        draft: buildRecoveredLibrelaDraft(action),
                        action,
                        execution:
                            action.status === "succeeded"
                                ? { result: action.result_json }
                                : null,
                        error: getRecoveredOutboundError(action),
                    })
                    return
                }

                setActionFlow((current) => ({
                    ...current,
                    phase: nextPhase,
                    action,
                    actionType: action.action_type,
                    reminder: buildRecoveredReminder(action),
                    selectedDate:
                        getActionDate(action) || current.selectedDate,
                    execution:
                        action?.status === "succeeded"
                            ? { result: action.result_json }
                            : null,
                    error:
                        nextPhase === "recovery_error"
                            ? new Error(
                                  "TomoCare could not confirm a final action state yet."
                              )
                            : null,
                }))
            })
            .catch((error) => {
                if (!active) return

                if (error.status === 404) {
                    clearStoredAction()
                    setActionFlow(emptyActionFlow())
                    setAppointmentMessageFlow(emptyAppointmentMessageFlow())
                    return
                }

                setActionFlow((current) => ({
                    ...current,
                    phase: "recovery_error",
                    error,
                }))
            })

        return () => {
            active = false
        }
    }, [])

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

            await loadVerifiedDocuments()
            await loadCareSummary()
            await loadReminders({ silent: true })
        } catch (err) {
            setError(err.message)
        } finally {
            setCheckingInbox(false)
        }
    }

    async function syncReminderCalendar(reminder) {
        setCalendarSyncByReminder((current) => ({
            ...current,
            [reminder.id]: {
                phase: "syncing",
            },
        }))

        try {
            await syncReminderToGoogleCalendar(reminder.id)
            await loadReminders({ silent: true })

            setCalendarSyncByReminder((current) => ({
                ...current,
                [reminder.id]: {
                    phase: "synced",
                },
            }))
        } catch (error) {
            console.error("[dashboard] calendar sync failed:", error)

            setCalendarSyncByReminder((current) => ({
                ...current,
                [reminder.id]: {
                    phase:
                        error.recovery === "reauthorize_google_calendar"
                            ? "reauthorization_required"
                            : "error",
                },
            }))
        }
    }

    function beginCareAction(reminder, actionType) {
        if (
            actionFlow.action &&
            actionFlow.action.source_event_id === reminder.id &&
            actionFlow.action.action_type === actionType &&
            ["proposed", "approved", "succeeded"].includes(
                actionFlow.action.status
            )
        ) {
            setActionFlow((current) => ({
                ...current,
                phase: getRecoveredCareActionPhase(current.action),
                error: null,
            }))
            return
        }

        setActionFlow({
            ...emptyActionFlow(),
            phase: "choosing",
            reminder,
            actionType,
        })
    }

    function reviewAssistantAction(action) {
        storeActiveAction(action.id)
        void loadPendingCareActions()

        if (isLibrelaAppointmentRequest(action)) {
            setActionFlow(emptyActionFlow())
            setAppointmentMessageFlow({
                phase: getRecoveredCareActionPhase(action),
                draft: buildRecoveredLibrelaDraft(action),
                action,
                execution:
                    action.status === "succeeded"
                        ? { result: action.result_json }
                        : null,
                error: getRecoveredOutboundError(action),
            })
            return
        }

        setActionFlow({
            ...emptyActionFlow(),
            phase: getRecoveredCareActionPhase(action),
            reminder: buildRecoveredReminder(action),
            action,
            actionType: action.action_type,
            selectedDate: getActionDate(action) || getPacificCareDate(),
            execution:
                action.status === "succeeded"
                    ? { result: action.result_json }
                    : null,
        })
    }

    function reviewAppointmentMessageDraft(draft) {
        setAppointmentMessageFlow({
            ...emptyAppointmentMessageFlow(),
            phase: "drafting",
            draft,
        })
    }

    async function prepareAndSendAppointmentRequest(messageBody) {
        const draft = appointmentMessageFlow.draft
        const reminderId = draft?.evidence?.reminder_event_id
        const injectionId = draft?.evidence?.injection_event_id

        if (!draft || !reminderId || !injectionId) {
            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "drafting",
                error: new Error(
                    "The draft is missing its trusted Librela evidence. Ask TomoCare to prepare a new request."
                ),
            }))
            return
        }

        setAppointmentMessageFlow((current) => ({
            ...current,
            phase: "preparing",
            error: null,
        }))

        let action

        try {
            const preparation = await prepareLibrelaAppointmentRequest({
                petId: PET_ID,
                reminderId,
                injectionId,
                messageBody,
                requestedBy: CARE_ACTOR,
            })
            action = preparation.proposed_action

            storeActiveAction(action.id)
            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: getRecoveredCareActionPhase(action),
                draft: buildRecoveredLibrelaDraft(action),
                action,
                execution:
                    action.status === "succeeded"
                        ? { result: action.result_json }
                        : null,
                error: getRecoveredOutboundError(action),
            }))
            await loadPendingCareActions()
        } catch (error) {
            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "drafting",
                error,
            }))
            return
        }

        await continueAppointmentRequest(action)
    }

    async function continueAppointmentRequest(action) {
        const phase = getRecoveredCareActionPhase(action)

        if (phase === "reviewing") {
            await approveAppointmentRequest(action)
            return
        }

        if (phase === "approved") {
            await executeAppointmentRequest(action)
        }
    }

    async function approveAppointmentRequest(
        proposedAction = appointmentMessageFlow.action
    ) {
        if (!proposedAction?.id) return

        setAppointmentMessageFlow((current) => ({
            ...current,
            phase: "approving",
            error: null,
        }))

        let approvedAction

        try {
            const approval = await approveCareAction(
                proposedAction.id,
                CARE_ACTOR
            )
            approvedAction = approval.approved_action

            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "executing",
                draft: buildRecoveredLibrelaDraft(approvedAction),
                action: approvedAction,
                error: null,
            }))
        } catch (error) {
            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "reviewing",
                action: proposedAction,
                error,
            }))
            return
        }

        await executeAppointmentRequest(approvedAction, {
            phaseAlreadySet: true,
        })
    }

    async function executeAppointmentRequest(
        approvedAction = appointmentMessageFlow.action,
        { phaseAlreadySet = false } = {}
    ) {
        if (!approvedAction?.id) return

        if (!phaseAlreadySet) {
            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "executing",
                error: null,
            }))
        }

        try {
            const result = await executeCareAction(approvedAction.id)
            const succeededAction = {
                ...approvedAction,
                status: "succeeded",
                result_json: result.execution.result,
            }

            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "succeeded",
                draft: buildRecoveredLibrelaDraft(succeededAction),
                action: succeededAction,
                execution: result.execution,
                error: null,
            }))
            await loadPendingCareActions()
        } catch (error) {
            await recoverAppointmentExecution({
                actionId: approvedAction.id,
                fallbackAction: approvedAction,
                executionError: error,
            })
        }
    }

    async function recoverAppointmentExecution({
        actionId,
        fallbackAction,
        executionError,
    }) {
        let action = fallbackAction
        let phase = getOutboundExecutionErrorPhase(executionError)

        try {
            const data = await fetchCareAction(actionId)
            action = data.care_action
            phase = getRecoveredCareActionPhase(action)
        } catch {
            // Preserve the execution error. An unknown provider outcome must
            // remain locked even if the follow-up status check also fails.
        }

        setAppointmentMessageFlow((current) => ({
            ...current,
            phase,
            draft: buildRecoveredLibrelaDraft(action) || current.draft,
            action,
            execution:
                action?.status === "succeeded"
                    ? { result: action.result_json }
                    : null,
            error: executionError,
        }))
        await loadPendingCareActions()
    }

    async function editAppointmentMessage() {
        const action = appointmentMessageFlow.action

        if (!action?.id || action.status !== "proposed") return

        setAppointmentMessageFlow((current) => ({
            ...current,
            phase: "cancelling",
            error: null,
        }))

        try {
            await cancelCareAction(action.id)
            clearStoredAction()
            await loadPendingCareActions()

            setAppointmentMessageFlow((current) => ({
                ...emptyAppointmentMessageFlow(),
                phase: "drafting",
                draft: current.draft,
            }))
        } catch (error) {
            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "reviewing",
                error,
            }))
        }
    }

    async function recoverAppointmentRequest() {
        const actionId =
            appointmentMessageFlow.action?.id ||
            window.sessionStorage.getItem(ACTIVE_ACTION_STORAGE_KEY)

        if (!actionId) {
            setAppointmentMessageFlow(emptyAppointmentMessageFlow())
            return
        }

        setAppointmentMessageFlow((current) => ({
            ...current,
            phase: "recovering",
            error: null,
        }))

        try {
            const data = await fetchCareAction(actionId)
            const action = data.care_action

            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: getRecoveredCareActionPhase(action),
                draft: buildRecoveredLibrelaDraft(action) || current.draft,
                action,
                execution:
                    action.status === "succeeded"
                        ? { result: action.result_json }
                        : null,
                error: getRecoveredOutboundError(action),
            }))
        } catch (error) {
            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "recovery_error",
                error,
            }))
        }
    }

    async function dismissAppointmentMessage() {
        const action = appointmentMessageFlow.action

        if (action?.status === "proposed") {
            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "cancelling",
                error: null,
            }))

            try {
                await cancelCareAction(action.id)
                await loadPendingCareActions()
            } catch (error) {
                setAppointmentMessageFlow((current) => ({
                    ...current,
                    phase: "reviewing",
                    error,
                }))
                return
            }
        }

        clearStoredAction()
        setAppointmentMessageFlow(emptyAppointmentMessageFlow())
    }

    async function prepareAction(event) {
        event.preventDefault()

        setActionFlow((current) => ({
            ...current,
            phase: "preparing",
            error: null,
        }))

        try {
            const data =
                actionFlow.actionType === MARK_INSURANCE_CLAIM_FILED
                    ? await prepareInsuranceClaimFiled({
                          petId: PET_ID,
                          reminderId: actionFlow.reminder.id,
                          filedDate: actionFlow.selectedDate,
                          requestedBy: CARE_ACTOR,
                      })
                    : await prepareHomeMedicationGiven({
                          petId: PET_ID,
                          reminderId: actionFlow.reminder.id,
                          administeredDate: actionFlow.selectedDate,
                          requestedBy: CARE_ACTOR,
                      })
            const action = data.proposed_action

            storeActiveAction(action.id)

            setActionFlow((current) => ({
                ...current,
                phase: getRecoveredCareActionPhase(action),
                action,
                actionType: action.action_type,
                execution:
                    action.status === "succeeded"
                        ? { result: action.result_json }
                        : null,
                error: null,
            }))
            await loadPendingCareActions()
        } catch (error) {
            setActionFlow((current) => ({
                ...current,
                phase: "choosing",
                error,
            }))
        }
    }

    async function cancelProposal({ returnToDate = false } = {}) {
        const actionId = actionFlow.action?.id

        if (!actionId) {
            setActionFlow((current) => ({
                ...emptyActionFlow(),
                phase: returnToDate ? "choosing" : "idle",
                reminder: returnToDate ? current.reminder : null,
                actionType: returnToDate ? current.actionType : null,
                selectedDate: current.selectedDate,
            }))
            return
        }

        setActionFlow((current) => ({
            ...current,
            phase: returnToDate ? "cancelling" : "dismissing",
            error: null,
        }))

        try {
            await cancelCareAction(actionId)
            clearStoredAction()
            await loadPendingCareActions()

            setActionFlow((current) => ({
                ...emptyActionFlow(),
                phase: returnToDate ? "choosing" : "idle",
                reminder: returnToDate ? current.reminder : null,
                actionType: returnToDate ? current.actionType : null,
                selectedDate: current.selectedDate,
            }))
        } catch (error) {
            setActionFlow((current) => ({
                ...current,
                phase: getRecoveredCareActionPhase(current.action),
                error,
            }))
        }
    }

    async function approveAndExecuteAction() {
        const actionId = actionFlow.action?.id
        if (!actionId) return

        setActionFlow((current) => ({
            ...current,
            phase: "approving",
            error: null,
        }))

        let approvedAction

        try {
            const approval = await approveCareAction(actionId, CARE_ACTOR)
            approvedAction = approval.approved_action
            setActionFlow((current) => ({
                ...current,
                phase: "executing",
                action: approvedAction,
            }))
        } catch (error) {
            setActionFlow((current) => ({
                ...current,
                phase: "reviewing",
                error,
            }))
            return
        }

        await runApprovedAction(approvedAction)
    }

    async function executeApprovedAction() {
        if (!actionFlow.action?.id) return

        setActionFlow((current) => ({
            ...current,
            phase: "executing",
            error: null,
        }))

        await runApprovedAction(actionFlow.action)
    }

    async function runApprovedAction(approvedAction) {
        try {
            const executionResult = await executeCareAction(approvedAction.id)

            setActionFlow((current) => ({
                ...current,
                phase: "succeeded",
                action: {
                    ...approvedAction,
                    status: "succeeded",
                    result_json: executionResult.execution.result,
                },
                execution: executionResult.execution,
                error: null,
            }))

            await Promise.all([
                loadReminders({ silent: true }),
                loadCareSummary(),
                loadPendingCareActions(),
            ])
        } catch (error) {
            setActionFlow((current) => ({
                ...current,
                phase: error.outcomeUnknown ? "recovery_error" : "approved",
                action: approvedAction,
                error,
            }))
        }
    }

    async function recoverAction() {
        const actionId = actionFlow.action?.id ||
            window.sessionStorage.getItem(ACTIVE_ACTION_STORAGE_KEY)

        if (!actionId) {
            setActionFlow(emptyActionFlow())
            return
        }

        setActionFlow((current) => ({
            ...current,
            phase: "recovering",
            error: null,
        }))

        try {
            const data = await fetchCareAction(actionId)
            const action = data.care_action

            setActionFlow((current) => ({
                ...current,
                phase: getRecoveredCareActionPhase(action),
                action,
                actionType: action.action_type,
                reminder: current.reminder || buildRecoveredReminder(action),
                selectedDate:
                    getActionDate(action) || current.selectedDate,
                execution:
                    action.status === "succeeded"
                        ? { result: action.result_json }
                        : null,
                error: null,
            }))

            if (action.status === "succeeded") {
                await Promise.all([
                    loadReminders({ silent: true }),
                    loadCareSummary(),
                ])
            }
        } catch (error) {
            setActionFlow((current) => ({
                ...current,
                phase: "recovery_error",
                error,
            }))
        }
    }

    async function dismissActionDialog() {
        if (actionFlow.action?.status === "proposed") {
            await cancelProposal()
            return
        }

        if (!actionFlow.action) {
            clearStoredAction()
        }

        setActionFlow((current) => ({
            ...current,
            phase: "idle",
            error: null,
        }))
    }

    function finishActionFlow() {
        clearStoredAction()
        setActionFlow(emptyActionFlow())
    }

    return (
        <main className="min-h-[calc(100svh-73px)] bg-tomo-bg text-tomo-text">
            <div className="mx-auto max-w-[1440px] px-6 py-8 md:px-8 md:py-10">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="min-w-0">
                        <section className="pb-8">
                            <p className="tomo-section-label mb-4">
                                Momo’s care desk
                            </p>

                            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-tomo-text-h md:text-5xl">
                                        Hi Rosa,
                                    </h1>

                                    <p className="text-4xl font-semibold leading-tight tracking-tight text-tomo-text-h md:text-5xl">
                                        Momo’s care is on track today.
                                    </p>

                                    <p className="mt-6 max-w-2xl text-base leading-7 text-tomo-text">
                                        I watch the inbox for new vet PDFs, prepare each
                                        record, and bring anything new to you before it
                                        joins Momo’s trusted history.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="tomo-btn tomo-btn-primary shrink-0 gap-2 px-6 py-2"
                                    onClick={checkInbox}
                                    disabled={checkingInbox}
                                >
                                    {checkingInbox && (
                                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    )}
                                    {checkingInbox ? "Checking inbox…" : "Check inbox"}
                                </button>
                            </div>

                            {checkingInbox && (
                                <p className="mt-3 text-[11px] text-tomo-text">
                                    This can take up to ~30s.
                                </p>
                            )}

                            <div className="mt-8 grid overflow-hidden rounded-2xl border border-tomo-border bg-white/[0.025] md:grid-cols-4">
                                <StatusTile
                                    tone="success"
                                    label="Inbox"
                                    value={checkingInbox ? "Checking" : "Ready"}
                                />

                                <StatusTile
                                    tone="success"
                                    label="Review"
                                    value={
                                        hasPendingReview
                                            ? `${reviewDocuments.length} waiting`
                                            : "Clear"
                                    }
                                />

                                <StatusTile
                                    tone="warning"
                                    label="Reminders"
                                    value={
                                        reminders.length > 0
                                            ? `${reminders.length} active`
                                            : "Clear"
                                    }
                                />

                                <StatusTile
                                    tone="brand"
                                    label="Actions"
                                    value={
                                        pendingActionCount > 0
                                            ? `${pendingActionCount} pending`
                                            : actionFlow.phase === "idle"
                                              ? "Gated"
                                              : "In review"
                                    }
                                />
                            </div>

                            <div className="mt-8">
                                <AssistantPanel
                                    petId={PET_ID}
                                    onActionPrepared={reviewAssistantAction}
                                    onMessageDraftPrepared={
                                        reviewAppointmentMessageDraft
                                    }
                                />
                            </div>
                        </section>

                        <div className="space-y-5">
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

                            <CheckResultSummary result={result} />

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

                            <RemindersSection
                                reminders={reminders}
                                loading={loadingReminders}
                                error={remindersError}
                                refreshing={refreshingReminders}
                                onRefresh={() => loadReminders({ silent: true })}
                                onRecordGiven={(reminder) =>
                                    beginCareAction(
                                        reminder,
                                        MARK_HOME_MEDICATION_GIVEN
                                    )
                                }
                                onMarkFiled={(reminder) =>
                                    beginCareAction(
                                        reminder,
                                        MARK_INSURANCE_CLAIM_FILED
                                    )
                                }
                                onSyncCalendar={syncReminderCalendar}
                                calendarSyncByReminder={
                                    calendarSyncByReminder
                                }
                            />
                        </div>
                    </div>

                    <CareRail
                        reminders={reminders}
                        verifiedDocuments={verifiedDocuments}
                        careSummary={careSummary}
                    />
                </div>
            </div>

            <CareActionDialog
                {...actionFlow}
                maxDate={getPacificCareDate()}
                minDate={
                    actionFlow.actionType === MARK_INSURANCE_CLAIM_FILED
                        ? actionFlow.reminder?.details_json?.treatment_date
                        : undefined
                }
                onDateChange={(selectedDate) =>
                    setActionFlow((current) => ({
                        ...current,
                        selectedDate,
                        error: null,
                    }))
                }
                onPrepare={prepareAction}
                onDismiss={dismissActionDialog}
                onChangeDate={() => cancelProposal({ returnToDate: true })}
                onCancelProposal={() => cancelProposal()}
                onApproveAndExecute={approveAndExecuteAction}
                onExecute={executeApprovedAction}
                onRetryRecovery={recoverAction}
                onDone={finishActionFlow}
            />

            {appointmentMessageFlow.draft && (
                <LibrelaAppointmentMessageDialog
                    key={appointmentMessageFlow.action?.id || "librela-draft"}
                    {...appointmentMessageFlow}
                    onApproveAndSend={prepareAndSendAppointmentRequest}
                    onApprove={() => approveAppointmentRequest()}
                    onExecute={() => executeAppointmentRequest()}
                    onEditMessage={editAppointmentMessage}
                    onRetryRecovery={recoverAppointmentRequest}
                    onDismiss={dismissAppointmentMessage}
                />
            )}
        </main>
    )
}

function StatusTile({ label, value, tone = "neutral" }) {
    const dotClass =
        tone === "success"
            ? "bg-tomo-success"
            : tone === "warning"
              ? "bg-tomo-warning"
              : tone === "brand"
                ? "bg-tomo-accent"
                : "bg-tomo-text"

    return (
        <div className="border-b border-tomo-border px-5 py-4 md:border-b-0 md:border-r last:border-r-0">
            <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                <p className="text-[11px] uppercase tracking-[0.18em] text-tomo-text">
                    {label}
                </p>
            </div>

            <p className="mt-2 text-lg font-semibold text-tomo-text-h">
                {value}
            </p>
        </div>
    )
}

function CareRail({ reminders, verifiedDocuments = [], careSummary = {} }) {
    const activeReminderCount = reminders?.length || 0

    return (
        <aside className="hidden border-l border-tomo-border pl-8 lg:block">
            <div className="sticky top-8 flex min-h-[calc(100svh-140px)] flex-col">
                <section className="rounded-2xl border border-tomo-border bg-white/[0.025] p-5">
                    <div className="flex items-center gap-4">
                        <img
                            src="/assets/momoPic.png"
                            alt=""
                            className="h-14 w-14 rounded-full"
                        />

                        <div>
                            <h2 className="text-2xl font-semibold text-tomo-text-h">
                                Momo
                            </h2>
                            <p className="text-sm font-medium text-tomo-text">
                                American Eskimo · 11 yrs
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 overflow-hidden rounded-xl border border-tomo-border">
                        <CareContextRow
                            label="Latest verified care"
                            value={formatCompactDate(
                                careSummary.latest_verified_care?.event_date
                            )}
                        />
                        <CareContextRow
                            label="Last Librela"
                            value={formatCompactDate(
                                careSummary.last_librela?.event_date
                            )}
                        />
                        <CareContextRow
                            label="Active reminders"
                            value={activeReminderCount}
                        />
                        <CareContextRow label="Primary vet" value="SoMa" />
                    </div>
                </section>

                <section className="mt-8">
                    <div className="flex items-center justify-between">
                        <p className="tomo-section-label">Recently verified</p>
                        <p className="text-sm font-semibold text-tomo-success">
                            {verifiedDocuments.length}
                        </p>
                    </div>

                    <div className="mt-5 space-y-2">
                        {verifiedDocuments.length > 0 ? (
                            verifiedDocuments.slice(0, 5).map((doc) => (
                                <RecentRecord
                                    key={doc.id}
                                    id={doc.id}
                                    title={doc.title || "Verified document"}
                                    sourceOrg={doc.source_org}
                                    date={doc.doc_date}
                                />
                            ))
                        ) : (
                            <p className="text-sm text-tomo-text">
                                No verified records yet.
                            </p>
                        )}
                    </div>
                </section>

                <div className="mt-auto rounded-2xl border border-tomo-accent/40 bg-tomo-accent/10 p-5">
                    <p className="tomo-section-label text-tomo-accent">
                        Approval-gated
                    </p>
                    <p className="mt-3 text-sm leading-6 text-tomo-text">
                        Nothing reaches Momo’s record or your calendar until you
                        approve it.
                    </p>
                </div>
            </div>
        </aside>
    )
}

function getPacificCareDate() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date())
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

    return `${values.year}-${values.month}-${values.day}`
}

function getRecoveredOutboundError(action) {
    if (action?.status === "failed") {
        return new Error(
            "The provider rejected this delivery. The attempt is locked and will not retry automatically."
        )
    }

    if (
        action?.status === "executing" ||
        action?.status === "outcome_unknown"
    ) {
        const error = new Error(
            "TomoCare cannot confirm whether the provider accepted this request. It is locked to prevent a duplicate message."
        )
        error.outcomeUnknown = true
        return error
    }

    return null
}

function getActionDate(action) {
    if (action?.action_type === MARK_INSURANCE_CLAIM_FILED) {
        return action.preview_json?.filed_date || null
    }

    return action?.preview_json?.administered_date || null
}

function buildRecoveredReminder(action) {
    if (!action?.source_event_id) return null

    if (action.action_type === MARK_INSURANCE_CLAIM_FILED) {
        return {
            id: action.source_event_id,
            title: "Insurance claim",
            details_json: {
                subtype: "Insurance claim",
                insurance_provider:
                    action.preview_json?.insurance_provider || "Insurance",
                treatment_date: action.preview_json?.treatment_date || null,
            },
        }
    }

    return {
        id: action.source_event_id,
        title: action.preview_json?.care_item || "Home medication",
        details_json: {
            reminder_type: "home_medication",
            care_item: action.preview_json?.care_item || "Home medication",
        },
    }
}

function storeActiveAction(actionId) {
    window.sessionStorage.setItem(ACTIVE_ACTION_STORAGE_KEY, actionId)
}

function clearStoredAction() {
    window.sessionStorage.removeItem(ACTIVE_ACTION_STORAGE_KEY)
}

function formatCompactDate(value) {
    if (!value) return "—"

    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(date)
}

function CareContextRow({ label, value }) {
    return (
        <div className="flex items-center justify-between border-b border-tomo-border px-4 py-3 last:border-b-0">
            <p className="text-sm font-medium text-tomo-text">{label}</p>
            <p className="text-sm font-semibold text-tomo-text-h">{value}</p>
        </div>
    )
}

function RecentRecord({ id, title, sourceOrg, date }) {
    return (
        <Link
            to={`/review/${id}`}
            className="
                tomo-quiet-link
                group flex gap-3 rounded-xl px-2 py-2 -mx-2
                transition-colors
                hover:bg-white/[0.035]
            "
        >
            <span className="mt-1.5 h-2.5 w-2.5 rounded-sm bg-tomo-success" />

            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-tomo-text-h transition-colors group-hover:text-white">
                    {title}
                </p>

                <p className="text-sm text-tomo-text">
                    {date || "Unknown date"}
                    {sourceOrg ? ` · ${sourceOrg}` : ""}
                </p>
            </div>
        </Link>
    )
}