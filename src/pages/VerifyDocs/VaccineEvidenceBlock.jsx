import { formatDisplayDate } from "../../lib/displayDate.js"
import {
    buildVaccineEvidencePresentation,
    updateVaccineAssertion,
} from "./vaccineEvidencePresentation.js"

const OUTCOME_LABEL = {
    consistent_pattern: "Consistent",
    new_or_limited_history: "Source supported",
    conflict_or_uncertainty: "Check this",
    manual_review: "Manual review",
}

export default function VaccineEvidenceBlock({
    candidates = [],
    editMode = false,
    isVerified = false,
    triageMap = {},
    errors = {},
    onUpdate,
    onAdd,
    onRemove,
    acceptedPaths = new Set(),
    onAcceptField,
}) {
    if (!candidates.length && !editMode) return null

    return (
        <section>
            <div className="flex items-center justify-between mb-2">
                <div>
                    <p className="text-xs text-tomo-text">Vaccine evidence</p>
                    <p className="text-[11px] text-tomo-text">
                        Rabies pilot · source facts stay separate
                    </p>
                </div>
                {editMode && !candidates.length && (
                    <button
                        type="button"
                        className="text-xs px-2 py-1 rounded-md border border-tomo-border text-tomo-text hover:text-tomo-text-h"
                        onClick={onAdd}
                    >
                        + Add Rabies evidence
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {candidates.map((candidate, index) => (
                    <EvidenceCard
                        key={`${candidate.care_item || "rabies"}-${index}`}
                        candidate={candidate}
                        index={index}
                        editMode={editMode}
                        isVerified={isVerified}
                        triage={triageMap[`checks.vaccine_evidence[${index}]`]}
                        errors={errors}
                        onUpdate={(next) => onUpdate?.(index, next)}
                        onRemove={() => onRemove?.(index)}
                        accepted={
                            isVerified ||
                            acceptedPaths.has(
                                `checks.vaccine_evidence[${index}]`
                            )
                        }
                        onAccept={() =>
                            onAcceptField?.(
                                `checks.vaccine_evidence[${index}]`
                            )
                        }
                    />
                ))}
            </div>
        </section>
    )
}

function EvidenceCard({
    candidate,
    index,
    editMode,
    isVerified,
    triage,
    errors,
    onUpdate,
    onRemove,
    accepted,
    onAccept,
}) {
    const view = buildVaccineEvidencePresentation(candidate)
    const base = `vaccine_evidence.${index}`

    if (!editMode) {
        return (
            <div className="p-3 rounded-lg border border-tomo-border space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-sm font-medium text-tomo-text-h">
                            Rabies
                        </p>
                        <p className="text-[11px] text-tomo-text">
                            {sourceLabel(view.sourceType)}
                        </p>
                    </div>
                    {triage && (
                        <span className="tomo-badge tomo-badge--neutral">
                            {isVerified
                                ? "Verified"
                                : OUTCOME_LABEL[triage.outcome] || "Review"}
                        </span>
                    )}
                </div>

                <EvidenceRow
                    label="Verified administration"
                    value={formatDisplayDate(view.administration?.date)}
                    empty="Not asserted by this source"
                />
                <EvidenceRow
                    label="Clinic-reported next due"
                    value={formatDisplayDate(view.nextDue?.date)}
                    empty="Not reported by this source"
                />
                <EvidenceRow
                    label="Clinic-reported status"
                    value={view.clinicStatus?.status}
                    empty="Not reported by this source"
                />
                <EvidenceRow
                    label="Product/vial expiration"
                    value={formatDisplayDate(
                        view.product.product_expiration_date
                    )}
                    empty="Not reported by this source"
                    note="Product metadata — not Momo’s vaccine due date"
                />

                {triage?.reason && (
                    <p className="text-[11px] leading-relaxed text-tomo-text">
                        {triage.reason}
                    </p>
                )}
                {triage?.blocks_approval && !accepted && (
                    <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded-full border border-[color:var(--tomo-success-border)] text-tomo-success"
                        onClick={onAccept}
                    >
                        Accept after source review
                    </button>
                )}
            </div>
        )
    }

    const setAssertion = (type, patch) =>
        onUpdate(updateVaccineAssertion(candidate, type, patch))
    const updateProduct = (patch) =>
        onUpdate({
            ...candidate,
            product_details: {
                ...(candidate.product_details || {}),
                ...patch,
            },
        })

    return (
        <div className="p-3 rounded-lg border border-tomo-border space-y-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-tomo-text-h">
                    Rabies evidence
                </p>
                <button
                    type="button"
                    className="text-xs text-tomo-text hover:text-red-200"
                    onClick={onRemove}
                >
                    Remove
                </button>
            </div>

            <label className="block text-xs text-tomo-text">
                Source type
                <select
                    className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h"
                    value={candidate.source_record_type || ""}
                    onChange={(event) =>
                        onUpdate({
                            ...candidate,
                            source_record_type: event.target.value,
                        })
                    }
                >
                    <option value="vaccination_certificate">
                        Official vaccination certificate
                    </option>
                    <option value="receipt">Receipt / clinic reminder</option>
                </select>
            </label>

            <DateAssertionEditor
                label="Administration date"
                assertion={view.administration}
                disabled={candidate.source_record_type !== "vaccination_certificate"}
                error={findAssertionError(errors, base, candidate, "administration")}
                onChange={(date) =>
                    setAssertion("administration", {
                        date,
                        date_meaning: "administered_on",
                    })
                }
                onRemove={() => setAssertion("administration", null)}
            />
            <DateAssertionEditor
                label="Clinic-reported next due"
                assertion={view.nextDue}
                error={findAssertionError(errors, base, candidate, "next_due")}
                onChange={(date) =>
                    setAssertion("next_due", {
                        date,
                        date_meaning: "clinic_reported_next_due",
                    })
                }
                onRemove={() => setAssertion("next_due", null)}
            />

            <TextInput
                label="Product name"
                value={view.product.product_name || ""}
                onChange={(product_name) => updateProduct({ product_name })}
            />
            <TextInput
                label="Manufacturer"
                value={view.product.manufacturer || ""}
                onChange={(manufacturer) => updateProduct({ manufacturer })}
            />
            <TextInput
                label="Batch number"
                value={view.product.batch_number || ""}
                onChange={(batch_number) => updateProduct({ batch_number })}
            />
            <TextInput
                label="Product/vial expiration"
                value={view.product.product_expiration_date || ""}
                placeholder="YYYY-MM-DD"
                note="This is product metadata, never Momo’s vaccine due date."
                error={errors[`${base}.product_expiration_date`]}
                onChange={(product_expiration_date) =>
                    updateProduct({ product_expiration_date })
                }
            />
            {errors[`${base}.assertions`] && (
                <p className="text-xs text-red-200">
                    {errors[`${base}.assertions`]}
                </p>
            )}
        </div>
    )
}

function EvidenceRow({ label, value, empty, note }) {
    return (
        <div>
            <p className="text-[11px] text-tomo-text">{label}</p>
            <p className="text-sm text-tomo-text-h">{value || empty}</p>
            {note && <p className="text-[10px] text-tomo-text">{note}</p>}
        </div>
    )
}

function DateAssertionEditor({
    label,
    assertion,
    disabled = false,
    error,
    onChange,
    onRemove,
}) {
    return (
        <div>
            <div className="flex items-center justify-between">
                <label className="text-xs text-tomo-text">{label}</label>
                {assertion && (
                    <button
                        type="button"
                        className="text-[11px] text-tomo-text"
                        onClick={onRemove}
                    >
                        Clear
                    </button>
                )}
            </div>
            <input
                className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h disabled:opacity-50"
                value={assertion?.date || ""}
                placeholder={disabled ? "Certificate required" : "YYYY-MM-DD"}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
            />
            {error && <p className="text-xs text-red-200 mt-1">{error}</p>}
        </div>
    )
}

function TextInput({ label, value, onChange, placeholder, note, error }) {
    return (
        <label className="block text-xs text-tomo-text">
            {label}
            <input
                className="mt-1 w-full rounded-lg border border-tomo-border bg-transparent px-3 py-2 text-sm text-tomo-text-h"
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
            />
            {note && <span className="block mt-1 text-[10px]">{note}</span>}
            {error && <span className="block mt-1 text-xs text-red-200">{error}</span>}
        </label>
    )
}

function findAssertionError(errors, base, candidate, type) {
    const index = (candidate.assertions || []).findIndex(
        (assertion) => assertion.assertion_type === type
    )
    return index >= 0 ? errors[`${base}.assertions.${index}.date`] : null
}

function sourceLabel(type) {
    if (type === "vaccination_certificate") {
        return "Official vaccination certificate"
    }
    if (type === "receipt") return "Receipt / clinic reminder"
    return "Source type not set"
}
