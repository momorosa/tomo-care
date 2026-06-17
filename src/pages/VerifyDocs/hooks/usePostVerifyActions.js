import { useState } from "react"
import * as api from "../api.js"
import { formatDisplayDate } from "../utils.js"

// Owns the post-verification action modal: whether it's open and which action
// is currently in flight. Reminder creation is delegated to the API module;
// results are surfaced through the page's toast / error setters.
export function usePostVerifyActions({ selectedId, showToast, setError }) {
    const [showPostVerifyActions, setShowPostVerifyActions] = useState(false)
    const [postVerifyActionLoading, setPostVerifyActionLoading] = useState(null)

    const actionInFlight = Boolean(postVerifyActionLoading)

    function openPostVerifyActions() {
        setShowPostVerifyActions(true)
    }

    function closePostVerifyActions() {
        if (actionInFlight) return
        setShowPostVerifyActions(false)
    }

    async function handleCreateLibrelaReminder() {
        if (!selectedId || actionInFlight) return

        setPostVerifyActionLoading("librela")
        setError("")

        try {
            const j = await api.createLibrelaReminder(selectedId)

            const reminderDate = formatDisplayDate(j.reminder?.event_date)
            const dueDate = formatDisplayDate(j.reminder?.due_date)

            showToast(
                `Librela reminder ${j.action} · remind ${reminderDate} · due ${dueDate}`
            )

            setShowPostVerifyActions(false)
        } catch (e) {
            setError(e.message)
            showToast("Could not create Librela reminder")
        } finally {
            setPostVerifyActionLoading(null)
        }
    }

    async function handleCreateInsuranceClaimReminder() {
        if (!selectedId || actionInFlight) return

        setPostVerifyActionLoading("insurance")
        setError("")

        try {
            const j = await api.createInsuranceClaimReminder(selectedId)

            const reminderDate = formatDisplayDate(j.reminder?.event_date)
            const deadlineDate = formatDisplayDate(
                j.reminder?.claim_deadline_date
            )

            showToast(
                `Insurance reminder ${j.action} · file ${reminderDate} · deadline ${deadlineDate}`
            )

            setShowPostVerifyActions(false)
        } catch (e) {
            setError(e.message)
            showToast("Could not create insurance claim reminder")
        } finally {
            setPostVerifyActionLoading(null)
        }
    }

    return {
        showPostVerifyActions,
        setShowPostVerifyActions, // keep for now if VerifyDocs still calls it directly
        openPostVerifyActions,
        closePostVerifyActions,
        postVerifyActionLoading,
        actionInFlight,
        handleCreateLibrelaReminder,
        handleCreateInsuranceClaimReminder,
    }
}