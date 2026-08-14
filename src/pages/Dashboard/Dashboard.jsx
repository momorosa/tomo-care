import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { useNavigate } from "react-router-dom"
import AssistantPanel from "./AssistantPanel.jsx"
import { CareContextDrawer, CareNavigation } from "./CareSidebar.jsx"
import CareActionDialog from "./CareActionDialog.jsx"
import LibrelaAppointmentMessageDialog from "./LibrelaAppointmentMessageDialog.jsx"
import {
    createConversationalHomeState,
    HOME_SECTIONS,
    reduceConversationalHome,
} from "./conversationalHomeState.js"
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
    prepareAppleMessagesHandoff,
    prepareLibrelaAppointmentRequest,
    resolveAppleMessagesHandoff,
    syncReminderToGoogleCalendar,
} from "./api.js"
import {
    buildRecoveredLibrelaDraft,
    getRecoveredCareActionPhase,
    isLibrelaAppointmentRequest,
} from "./careActionRecovery.js"
import { requestAppleMessagesDraft } from "./appleMessagesHandoff.js"
import { getAttentionNavigationEffect } from "./attentionNavigation.js"

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
        handoff: null,
        error: null,
    }
}

function normalizeReviewDocuments(result) {
    if (!result?.reviewDocuments || !Array.isArray(result.reviewDocuments)) {
        return []
    }

    return result.reviewDocuments.filter((doc) => doc?.id)
}

export default function Dashboard() {
    const navigate = useNavigate()
    const [homeLayout, dispatchHomeLayout] = useReducer(
        reduceConversationalHome,
        undefined,
        createConversationalHomeState
    )

    const [pendingReviewDocs, setPendingReviewDocs] = useState([])
    const [reminders, setReminders] = useState([])
    const [verifiedDocuments, setVerifiedDocuments] = useState([])
    const [careSummary, setCareSummary] = useState({})
    const [pendingActionCount, setPendingActionCount] = useState(0)
    const [pendingActions, setPendingActions] = useState([])
    const [actionFlow, setActionFlow] = useState(emptyActionFlow)
    const [appointmentMessageFlow, setAppointmentMessageFlow] = useState(
        emptyAppointmentMessageFlow
    )

    const [result, setResult] = useState(null)
    const [checkingInbox, setCheckingInbox] = useState(false)

    const [error, setError] = useState(null)
    const [remindersError, setRemindersError] = useState("")

    const [loadingReminders, setLoadingReminders] = useState(false)
    const [refreshingReminders, setRefreshingReminders] = useState(false)
    const [calendarSyncByReminder, setCalendarSyncByReminder] = useState({})
    const [focusedReminderId, setFocusedReminderId] = useState(null)

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
            setPendingActions(result.actions)
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
                        handoff: action.native_handoff || null,
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

    async function checkInbox() {
        setCheckingInbox(true)
        setError(null)
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
            setError(err)
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
            const result = await syncReminderToGoogleCalendar(reminder.id)
            await loadReminders({ silent: true })

            setCalendarSyncByReminder((current) => ({
                ...current,
                [reminder.id]: {
                    phase: "synced",
                    message:
                        result.message || "Added to Google Calendar.",
                },
            }))
        } catch (error) {
            console.error("[dashboard] calendar sync failed:", error)

            if (error.reason === "timing_state_not_eligible") {
                await loadReminders({ silent: true })
            }

            setCalendarSyncByReminder((current) => ({
                ...current,
                [reminder.id]: {
                    phase:
                        error.recovery === "reauthorize_google_calendar"
                            ? "reauthorization_required"
                            : "error",
                    message: error.message,
                    reason: error.reason,
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
                handoff: action.native_handoff || null,
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

    async function reviewPendingAction(actionId) {
        const data = await fetchCareAction(actionId)
        reviewAssistantAction(data.care_action)
    }

    async function navigateAttentionTarget(target) {
        const effect = getAttentionNavigationEffect(target, { petId: PET_ID })
        if (!effect) return

        if (effect.type === "profile") {
            dispatchHomeLayout({
                type: "select_section",
                section: HOME_SECTIONS.PROFILE,
            })
            return
        }

        if (effect.type === "reminder") {
            setFocusedReminderId(effect.recordId)
            dispatchHomeLayout({
                type: "select_section",
                section: HOME_SECTIONS.REMINDERS,
            })
            return
        }

        if (effect.type === "care_action") {
            await reviewPendingAction(effect.recordId)
            return
        }

        if (effect.type === "review_document") {
            navigate(`/review/${effect.recordId}`)
            return
        }

        window.open(effect.url, "_blank", "noopener,noreferrer")
    }

    function reviewAppointmentMessageDraft(draft) {
        setAppointmentMessageFlow({
            ...emptyAppointmentMessageFlow(),
            phase: "drafting",
            draft,
        })
    }

    async function prepareAndApproveAppointmentRequest(messageBody) {
        const draft = appointmentMessageFlow.draft
        const orchestrationRunId = draft?.workflow_run_id
        const reminderId = draft?.evidence?.reminder_event_id
        const injectionId = draft?.evidence?.injection_event_id

        if (
            !draft ||
            !orchestrationRunId ||
            !reminderId ||
            !injectionId
        ) {
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
                orchestrationRunId,
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

        await continueAppointmentApproval(action)
    }

    async function continueAppointmentApproval(action) {
        const phase = getRecoveredCareActionPhase(action)

        if (phase === "reviewing") {
            await approveAppointmentRequest(action)
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
                phase: "approved",
                draft: buildRecoveredLibrelaDraft(approvedAction),
                action: approvedAction,
                handoff: null,
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
    }

    async function openAppointmentRequestInMessages(
        approvedAction = appointmentMessageFlow.action
    ) {
        if (!approvedAction?.id) return

        setAppointmentMessageFlow((current) => ({
            ...current,
            phase: "handoff_preparing",
            error: null,
        }))

        try {
            const result = await prepareAppleMessagesHandoff(approvedAction.id)
            requestAppleMessagesDraft({ handoff: result.handoff })

            const nativeHandoff = {
                id: result.handoff.id,
                state: result.handoff.state,
                target_app: result.handoff.target_app,
                contract_version: result.handoff.contract_version,
                recipient_display: result.handoff.recipient_display,
                requested_at: result.handoff.issued_at,
            }
            const actionWithHandoff = {
                ...approvedAction,
                native_handoff: nativeHandoff,
            }

            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "messages_handoff_requested",
                draft: buildRecoveredLibrelaDraft(actionWithHandoff),
                action: actionWithHandoff,
                handoff: nativeHandoff,
                error: null,
            }))
        } catch (error) {
            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "approved",
                action: approvedAction,
                error,
            }))
        }
    }

    async function resolveAppointmentMessageHandoff(resolution) {
        const action = appointmentMessageFlow.action

        if (!action?.id) return

        setAppointmentMessageFlow((current) => ({
            ...current,
            phase: "resolving_handoff",
            error: null,
        }))

        try {
            const result = await resolveAppleMessagesHandoff(
                action.id,
                resolution
            )
            const resolvedAction = {
                ...action,
                status: result.resolved_action.status,
                native_handoff: result.handoff,
            }

            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: result.handoff.state,
                draft: buildRecoveredLibrelaDraft(resolvedAction),
                action: resolvedAction,
                handoff: result.handoff,
                error: null,
            }))
            await loadPendingCareActions()
        } catch (error) {
            setAppointmentMessageFlow((current) => ({
                ...current,
                phase: "messages_handoff_requested",
                error,
            }))
        }
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
                handoff: action.native_handoff || null,
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
        <main className="tomo-conversational-home bg-tomo-bg text-tomo-text">
            <div
                className={`tomo-home-grid ${
                    homeLayout.navigationCollapsed
                        ? "tomo-home-grid--nav-collapsed"
                        : ""
                } ${homeLayout.drawerOpen ? "" : "tomo-home-grid--drawer-closed"}`}
            >
                <CareNavigation
                    activeSection={homeLayout.activeSection}
                    collapsed={homeLayout.navigationCollapsed}
                    reminderCount={reminders.length}
                    reviewCount={reviewDocuments.length}
                    onSelect={(section) =>
                        dispatchHomeLayout({ type: "select_section", section })
                    }
                    onCollapse={() =>
                        dispatchHomeLayout({ type: "collapse_navigation" })
                    }
                    onExpand={() =>
                        dispatchHomeLayout({ type: "expand_navigation" })
                    }
                />

                {homeLayout.drawerOpen && (
                    <CareContextDrawer
                        section={homeLayout.activeSection}
                        reminders={reminders}
                        loadingReminders={loadingReminders}
                        remindersError={remindersError}
                        refreshingReminders={refreshingReminders}
                        reviewDocuments={reviewDocuments}
                        verifiedDocuments={verifiedDocuments}
                        careSummary={careSummary}
                        inboxResult={result}
                        inboxError={error}
                        checkingInbox={checkingInbox}
                        calendarSyncByReminder={calendarSyncByReminder}
                        focusedReminderId={focusedReminderId}
                        onClose={() =>
                            dispatchHomeLayout({ type: "close_drawer" })
                        }
                        onCheckInbox={checkInbox}
                        onRefreshReminders={() =>
                            loadReminders({ silent: true })
                        }
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
                    />
                )}

                <AssistantPanel
                    petId={PET_ID}
                    reminders={reminders}
                    pendingActionCount={pendingActionCount}
                    pendingActions={pendingActions}
                    contextDrawerOpen={homeLayout.drawerOpen}
                    onToggleContext={() =>
                        dispatchHomeLayout({
                            type: homeLayout.drawerOpen
                                ? "close_drawer"
                                : "open_drawer",
                        })
                    }
                    onActionPrepared={reviewAssistantAction}
                    onReviewPendingAction={reviewPendingAction}
                    onNavigateAttention={navigateAttentionTarget}
                    onMessageDraftPrepared={reviewAppointmentMessageDraft}
                />
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
                    onApproveMessage={prepareAndApproveAppointmentRequest}
                    onApprove={() => approveAppointmentRequest()}
                    onOpenInMessages={() =>
                        openAppointmentRequestInMessages()
                    }
                    onResolveHandoff={resolveAppointmentMessageHandoff}
                    onEditMessage={editAppointmentMessage}
                    onRetryRecovery={recoverAppointmentRequest}
                    onDismiss={dismissAppointmentMessage}
                />
            )}
        </main>
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
