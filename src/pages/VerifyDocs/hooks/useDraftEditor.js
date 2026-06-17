import { useState } from "react"
import { validateExtracted } from "../validation.js"

// Owns the editable draft of a document's extracted fields: the working copy,
// dirty/validation flags, and every field mutator. Orchestration of *saving*
// the draft (network + status transitions) stays in the page, since that has
// to coordinate with the document/triage state.
export function useDraftEditor(detail, isVerified) {
    const [editMode, setEditMode] = useState(false)
    const [draftExtracted, setDraftExtracted] = useState(null)
    const [dirty, setDirty] = useState(false)
    const [validationErrors, setValidationErrors] = useState({})

    function markDirty() {
        setDirty(true)
        setValidationErrors((prev) => (Object.keys(prev).length ? {} : prev))
    }

    function reset() {
        setEditMode(false)
        setDraftExtracted(null)
        setDirty(false)
        setValidationErrors({})
    }

    function startEdit() {
        if (isVerified) return

        setDraftExtracted(structuredClone(detail?.text_extracted || {}))
        setValidationErrors({})
        setDirty(false)
        setEditMode(true)
    }

    function validate() {
        const errs = validateExtracted(draftExtracted)
        setValidationErrors(errs)
        return errs
    }

    // ── Generic list helpers (events, cost_items share the same shape) ──

    function updateListItem(key, index, patch) {
        setDraftExtracted((prev) => {
            const next = structuredClone(prev || {})
            next[key] = Array.isArray(next[key]) ? next[key] : []
            next[key][index] = { ...(next[key][index] || {}), ...patch }
            return next
        })
        markDirty()
    }

    function addListItem(key, item) {
        setDraftExtracted((prev) => {
            const next = structuredClone(prev || {})
            next[key] = Array.isArray(next[key]) ? next[key] : []
            next[key].push(item(next))
            return next
        })
        markDirty()
    }

    function removeListItem(key, index) {
        setDraftExtracted((prev) => {
            const next = structuredClone(prev || {})
            next[key] = (next[key] || []).filter((_, i) => i !== index)
            return next
        })
        markDirty()
    }

    function onUpdateInvoiceId(value) {
        setDraftExtracted((prev) => ({ ...(prev || {}), invoice_id: value }))
        markDirty()
    }

    const onUpdateEvent = (index, patch) => updateListItem("events", index, patch)
    const onRemoveEvent = (index) => removeListItem("events", index)
    const onAddEvent = () =>
        addListItem("events", (next) => ({
            status: "completed",
            event_type: "injection",
            event_date: next.doc_date || detail?.doc_date || "",
            details_json: { description: "" },
        }))

    const onUpdateCostItem = (index, patch) =>
        updateListItem("cost_items", index, patch)
    const onRemoveCostItem = (index) => removeListItem("cost_items", index)
    const onAddCostItem = () =>
        addListItem("cost_items", (next) => ({
            label: "",
            notes: null,
            amount: 0,
            category: "other",
            currency: "USD",
            service_date: next.doc_date || detail?.doc_date || "",
        }))

    return {
        editMode,
        draftExtracted,
        dirty,
        validationErrors,
        startEdit,
        cancelEdit: reset,
        reset,
        validate,
        setDirty,
        onUpdateInvoiceId,
        onUpdateEvent,
        onAddEvent,
        onRemoveEvent,
        onUpdateCostItem,
        onAddCostItem,
        onRemoveCostItem,
    }
}
