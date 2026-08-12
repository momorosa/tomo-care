import { useMemo, useState } from "react"
import * as api from "../api.js"
import { formatDisplayDate } from "../utils.js"
import {
    buildLibrelaRepairPreviewMessage,
    getLibrelaActionIntent,
} from "../librelaReconciliationFlow.js"
import { buildSavedOnlyCalendarStatus } from "../postVerifyCalendarRecovery.js"
import { buildWeightPreviewMessage } from "../weightMaterializationFlow.js"

const INITIAL_ACTION_STATUS = {
    weight: {
        phase: "idle",
        message: "",
        previewToken: null,
        buttonLabel: null,
    },
    librela: {
        phase: "idle",
        message: "",
        calendarUrl: null,
        reminderId: null,
        previewToken: null,
        calendarRetryAllowed: false,
        calendarSyncAttempted: false,
        recovery: null,
    },
    insurance: {
        phase: "idle",
        message: "",
        calendarUrl: null,
        reminderId: null,
        calendarRetryAllowed: false,
        calendarSyncAttempted: false,
        recovery: null,
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
    if (isWorking(statusMap.weight)) return "weight"
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

    async function syncSavedReminder({
        actionKey,
        reminderId,
        successToast,
    }) {
        try {
            setActionStatus(actionKey, {
                phase: "syncing",
                message: "Adding to Google Calendar…",
                reminderId,
                calendarRetryAllowed: false,
                recovery: null,
            })

            const syncResult = await api.syncReminderToGoogleCalendar(
                reminderId
            )

            if (syncResult.blocked) {
                setActionStatus(
                    actionKey,
                    buildSavedOnlyCalendarStatus({
                        reminderId,
                        blockedMessage:
                            syncResult.error ||
                            "Reminder saved in TomoCare, but it was not eligible for Google Calendar sync.",
                    })
                )

                showToast("Reminder saved in TomoCare, but not synced to Calendar")
                return
            }

            const calendarUrl =
                syncResult.google_calendar?.html_link || null

            setActionStatus(actionKey, {
                phase: "synced",
                message: "Added to Google Calendar.",
                calendarUrl,
                reminderId,
                calendarRetryAllowed: false,
                calendarSyncAttempted: true,
                recovery: null,
            })

            showToast(successToast(syncResult))
        } catch (e) {
            setActionStatus(
                actionKey,
                buildSavedOnlyCalendarStatus({
                    reminderId,
                    error: e,
                })
            )

            showToast(
                e.recovery === "reauthorize_google_calendar"
                    ? "Reminder saved. Reconnect Google Calendar."
                    : "Reminder saved, but Calendar was not updated"
            )
        }
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
            calendarRetryAllowed: false,
            calendarSyncAttempted: false,
            recovery: null,
        })

        let createResult

        try {
            createResult = await createReminder()
        } catch (e) {
            setError(e.message)
            setActionStatus(actionKey, {
                phase: "error",
                message: e.message,
                calendarUrl: null,
                reminderId: null,
                calendarRetryAllowed: false,
            })
            showToast("Could not create reminder")
            return
        }

        const reminderId = createResult.reminder?.id

        if (!reminderId) {
            const error = new Error(
                "Reminder saved, but TomoCare could not identify it for Calendar sync."
            )
            setError(error.message)
            setActionStatus(actionKey, {
                phase: "error",
                message: error.message,
                reminderId: null,
                calendarRetryAllowed: false,
            })
            return
        }

        await syncSavedReminder({
            actionKey,
            reminderId,
            successToast: (syncResult) =>
                createdToast(syncResult, createResult),
        })
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

    async function previewWeightMaterialization() {
        if (!selectedId || actionInFlight) return

        setError("")
        setActionStatus("weight", {
            phase: "previewing",
            message: "Checking the verified measurement…",
            previewToken: null,
            buttonLabel: null,
        })

        try {
            const result = await api.previewWeightMaterialization(selectedId)

            setActionStatus("weight", {
                phase: "repair_ready",
                message: buildWeightPreviewMessage(
                    result.preview,
                    formatDisplayDate
                ),
                previewToken: result.preview.preview_token,
                buttonLabel: "Save verified weight",
            })
        } catch (e) {
            setError(e.message)
            setActionStatus("weight", {
                phase: "error",
                message: e.message,
                previewToken: null,
                buttonLabel: "Review again",
            })
            showToast("Could not review the weight")
        }
    }

    async function applyWeightMaterialization() {
        const previewToken = postVerifyActionStatus.weight.previewToken

        if (!previewToken) {
            await previewWeightMaterialization()
            return
        }

        setError("")
        setActionStatus("weight", {
            phase: "repairing",
            message: "Saving the verified weight…",
            buttonLabel: null,
        })

        try {
            const result = await api.applyWeightMaterialization(selectedId, {
                previewToken,
            })

            setActionStatus("weight", {
                phase: "synced",
                message:
                    result.disposition === "existing"
                        ? "This verified weight was already saved."
                        : "Verified weight added to Momo’s trusted history.",
                previewToken: null,
                buttonLabel: null,
            })

            showToast("Verified weight saved")

            if (onReconciled) {
                try {
                    await onReconciled()
                } catch {
                    setError(
                        "The weight was saved, but this page could not refresh. Refresh the browser to load the trusted record."
                    )
                }
            }
        } catch (e) {
            setError(e.message)
            setActionStatus("weight", {
                phase: "error",
                message: e.message,
                previewToken: null,
                buttonLabel: "Review again",
            })
            showToast("Could not save the verified weight")
        }
    }

    async function handleWeightMaterialization() {
        if (!selectedId || actionInFlight) return

        if (postVerifyActionStatus.weight.phase === "repair_ready") {
            await applyWeightMaterialization()
            return
        }

        await previewWeightMaterialization()
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
                ...buildSavedOnlyCalendarStatus({
                    reminderId: result.reminder?.id || null,
                    calendarSyncAttempted: false,
                }),
                message:
                    "Care history repaired. The next Librela reminder is saved in TomoCare and ready for Google Calendar.",
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

    async function handleRetryCalendar(actionKey) {
        if (actionInFlight) return

        const status = postVerifyActionStatus[actionKey]
        if (!status?.calendarRetryAllowed || !status?.reminderId) return

        setError("")

        await syncSavedReminder({
            actionKey,
            reminderId: status.reminderId,
            successToast: () => "Reminder added to Google Calendar",
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
        handleWeightMaterialization,
        handleCreateInsuranceClaimReminder,
        handleRetryLibrelaCalendar: () => handleRetryCalendar("librela"),
        handleRetryInsuranceCalendar: () =>
            handleRetryCalendar("insurance"),
    }
}
