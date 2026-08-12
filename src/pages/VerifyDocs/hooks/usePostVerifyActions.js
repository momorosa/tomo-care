import { useMemo, useState } from "react"
import * as api from "../api.js"
import { formatDisplayDate } from "../utils.js"
import {
    buildLibrelaRepairPreviewMessage,
    getLibrelaActionIntent,
} from "../librelaReconciliationFlow.js"

const INITIAL_ACTION_STATUS = {
    librela: {
        phase: "idle",
        message: "",
        calendarUrl: null,
        reminderId: null,
        previewToken: null,
    },
    insurance: {
        phase: "idle",
        message: "",
        calendarUrl: null,
        reminderId: null,
    },
}

function isWorking(status) {
    return (
        status?.phase === "creating" ||
        status?.phase === "syncing" ||
        status?.phase === "previewing" ||
        status?.phase === "repairing"
    )
}

function getWorkingActionKey(statusMap) {
    if (isWorking(statusMap.librela)) return "librela"
    if (isWorking(statusMap.insurance)) return "insurance"
    return null
}

export function usePostVerifyActions({
    selectedId,
    showToast,
    setError,
    onReconciled = null,
}) {
    const [showPostVerifyActions, setShowPostVerifyActions] = useState(false)
    const [postVerifyActionStatus, setPostVerifyActionStatus] =
        useState(INITIAL_ACTION_STATUS)

    const postVerifyActionLoading = useMemo(
        () => getWorkingActionKey(postVerifyActionStatus),
        [postVerifyActionStatus]
    )

    const actionInFlight = Boolean(postVerifyActionLoading)

    function setActionStatus(actionKey, nextStatus) {
        setPostVerifyActionStatus((current) => ({
            ...current,
            [actionKey]: {
                ...current[actionKey],
                ...nextStatus,
            },
        }))
    }

    function openPostVerifyActions() {
        setPostVerifyActionStatus(INITIAL_ACTION_STATUS)
        setShowPostVerifyActions(true)
    }

    function closePostVerifyActions() {
        if (actionInFlight) return
        setShowPostVerifyActions(false)
    }

    async function createAndSyncReminder({
        actionKey,
        createReminder,
        createdToast,
    }) {
        if (!selectedId || actionInFlight) return

        setError("")

        setActionStatus(actionKey, {
            phase: "creating",
            message: "Creating reminder…",
            calendarUrl: null,
            reminderId: null,
        })

        try {
            const createResult = await createReminder()
            const reminder = createResult.reminder

            setActionStatus(actionKey, {
                phase: "syncing",
                message: "Adding to Google Calendar…",
                reminderId: reminder?.id || null,
            })

            const syncResult = await api.syncReminderToGoogleCalendar(
                reminder.id
            )

            if (syncResult.blocked) {
                setActionStatus(actionKey, {
                    phase: "saved_only",
                    message:
                        syncResult.error ||
                        "Reminder saved in TomoCare, but it was not eligible for Google Calendar sync.",
                    calendarUrl: null,
                    reminderId: reminder.id,
                })

                showToast("Reminder saved in TomoCare, but not synced to Calendar")
                return
            }

            const calendarUrl =
                syncResult.google_calendar?.html_link || null

            setActionStatus(actionKey, {
                phase: "synced",
                message: "Added to Google Calendar.",
                calendarUrl,
                reminderId: reminder.id,
            })

            showToast(createdToast(syncResult, createResult))
        } catch (e) {
            setError(e.message)

            setActionStatus(actionKey, {
                phase: "error",
                message: e.message,
                calendarUrl: null,
            })

            showToast("Could not complete reminder action")
        }
    }

    async function previewLibrelaRepair() {
        setError("")
        setActionStatus("librela", {
            phase: "previewing",
            message: "Checking the repair plan…",
            previewToken: null,
        })

        try {
            const result = await api.previewLibrelaReconciliation(selectedId)

            setActionStatus("librela", {
                phase: "repair_ready",
                message: buildLibrelaRepairPreviewMessage(
                    result.preview,
                    formatDisplayDate
                ),
                previewToken: result.preview.preview_token,
            })
        } catch (e) {
            setError(e.message)
            setActionStatus("librela", {
                phase: "error",
                message: e.message,
                previewToken: null,
            })
            showToast("Could not review the Librela repair")
        }
    }

    async function applyLibrelaRepair() {
        const previewToken = postVerifyActionStatus.librela.previewToken

        if (!previewToken) {
            await previewLibrelaRepair()
            return
        }

        setError("")
        setActionStatus("librela", {
            phase: "repairing",
            message: "Repairing the care record…",
        })

        try {
            const result = await api.applyLibrelaReconciliation(selectedId, {
                previewToken,
            })

            setActionStatus("librela", {
                phase: "saved_only",
                message:
                    "Care history repaired. The September 14 Librela reminder is saved in TomoCare; Calendar sync remains a separate step.",
                reminderId: result.reminder?.id || null,
                previewToken: null,
            })

            showToast("Librela care history repaired")

            if (onReconciled) {
                try {
                    await onReconciled()
                } catch {
                    setError(
                        "The repair was saved, but this page could not refresh. Refresh the browser to load the reconciled record."
                    )
                }
            }
        } catch (e) {
            setError(e.message)
            setActionStatus("librela", {
                phase: "error",
                message: e.message,
                previewToken: null,
            })
            showToast("Could not apply the Librela repair")
        }
    }

    async function handleCreateLibrelaReminder(
        recommendationState = "eligible"
    ) {
        if (!selectedId || actionInFlight) return

        const intent = getLibrelaActionIntent({
            recommendationState,
            phase: postVerifyActionStatus.librela.phase,
        })

        if (intent === "preview_repair") {
            await previewLibrelaRepair()
            return
        }

        if (intent === "apply_repair") {
            await applyLibrelaRepair()
            return
        }

        await createAndSyncReminder({
            actionKey: "librela",
            createReminder: () => api.createLibrelaReminder(selectedId),
            createdToast: (syncResult, createResult) => {
                const reminderDate = formatDisplayDate(
                    createResult.reminder?.event_date
                )
                const dueDate = formatDisplayDate(
                    createResult.reminder?.due_date
                )

                return `Librela reminder synced · remind ${reminderDate} · due ${dueDate}`
            },
        })
    }

    async function handleCreateInsuranceClaimReminder() {
        await createAndSyncReminder({
            actionKey: "insurance",
            createReminder: () =>
                api.createInsuranceClaimReminder(selectedId),
            createdToast: (syncResult, createResult) => {
                const reminderDate = formatDisplayDate(
                    createResult.reminder?.event_date
                )
                const deadlineDate = formatDisplayDate(
                    createResult.reminder?.claim_deadline_date
                )

                return `Insurance reminder synced · file ${reminderDate} · deadline ${deadlineDate}`
            },
        })
    }

    return {
        showPostVerifyActions,
        setShowPostVerifyActions,

        openPostVerifyActions,
        closePostVerifyActions,

        postVerifyActionLoading,
        postVerifyActionStatus,
        actionInFlight,

        handleCreateLibrelaReminder,
        handleCreateInsuranceClaimReminder,
    }
}
