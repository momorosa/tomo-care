import assert from "node:assert/strict"
import test from "node:test"

import { answerAssistantQuestion } from "../assistant/assistantService.js"
import { buildTrustedContextFromRows } from "../assistant/trustedContext.js"
import { getStableGoogleCalendarEventId } from "../calendar/reminderCalendar.js"
import { summarizeVerifiedCareEvents } from "../dashboard/careSummary.js"
import { buildVerifiedDocumentMaterialization } from "../documents/verifiedDocumentMaterialization.js"
import { classifyAttachment } from "../gmail/gmailInbox.js"
import { ingestGmailReceipts } from "../gmail/ingestGmailReceipts.js"
import { getDocumentProcessingDecision } from "../gmail/documentProcessingDecision.js"
import { buildInsuranceClaimReminderPlan } from "../lib/insuranceClaimReminder.js"
import { buildLibrelaReminderRecommendation } from "../lib/librelaEvidence.js"
import { buildLibrelaReconciliationPlan } from "../lib/librelaReconciliation.js"
import { buildWeightMaterializationRecommendation } from "../lib/verifiedWeight.js"
import { getCompactReminderPresentation } from "../../src/pages/Dashboard/reminderPresentation.js"
import { getPostVerifyRecommendations } from "../../src/pages/VerifyDocs/recommendations.js"
import { getTriageReviewState } from "../../src/pages/VerifyDocs/triageReviewState.js"
import { validateExtracted } from "../../src/pages/VerifyDocs/validation.js"
import {
    AUGUST_3_EXTRACTED,
    AUGUST_3_FIXTURE_IDS as IDS,
    AUGUST_3_RAW_TEXT,
    AUGUST_3_TRIAGE,
    buildAugust3GmailFixture,
} from "./fixtures/august3LibrelaInvoice.js"

const CARE_DATE = "2026-08-12"
const FIXED_NOW = "2026-08-12T18:00:00.000Z"

function clone(value) {
    return structuredClone(value)
}

function createState() {
    return {
        pet: {
            id: IDS.pet,
            name: "Momo",
            weight_value: 15.2,
            weight_unit: "kg",
        },
        documents: [],
        events: [
            {
                id: IDS.priorInjection,
                pet_id: IDS.pet,
                doc_id: IDS.priorDocument,
                event_type: "injection",
                event_date: "2026-06-10",
                status: "verified",
                details_json: {
                    subtype: "Librela",
                    medication: "Librela",
                },
                created_at: "2026-06-10T18:00:00.000Z",
            },
            {
                id: IDS.priorReminder,
                pet_id: IDS.pet,
                doc_id: IDS.priorDocument,
                event_type: "reminder",
                event_date: "2026-07-22",
                status: "planned",
                details_json: {
                    subtype: "Librela",
                    anchor_event_date: "2026-06-10",
                    due_date: "2026-07-29",
                    calendar_sync_status: "not_synced",
                },
                created_at: "2026-06-10T18:00:00.000Z",
            },
        ],
        facts: [
            {
                id: IDS.priorWeight,
                pet_id: IDS.pet,
                doc_id: IDS.priorDocument,
                fact_type: "weight",
                fact_date: "2026-06-10",
                status: "verified",
                value_json: {
                    value: 15.2,
                    unit: "kg",
                    value_kg: 15.2,
                    value_lb: 33.51,
                },
                verified_at: "2026-06-10T18:00:00.000Z",
                verified_by: "rosa",
            },
        ],
        costItems: [],
        storageKeys: new Set(),
        calendarEvents: new Map(),
        calendarCalls: { inserts: 0, updates: 0 },
    }
}

function buildIngestDependencies(state) {
    return {
        async fetchCanonicalReceiptEmails() {
            return [buildAugust3GmailFixture()]
        },
        async findExistingDocument({ contentSha256, storageKey }) {
            return (
                state.documents.find(
                    (document) =>
                        document.external_refs?.content_sha256 ===
                            contentSha256 || document.file_url === storageKey
                ) || null
            )
        },
        async uploadOrReusePdf({ storageKey }) {
            const reusedExistingObject = state.storageKeys.has(storageKey)
            state.storageKeys.add(storageKey)

            return {
                bucket: "tomo-docs",
                storageKey,
                path: storageKey,
                uploaded: !reusedExistingObject,
                reusedExistingObject,
            }
        },
        async createDocumentRow({ petId, email, attachment, storageKey }) {
            const document = {
                id: IDS.document,
                pet_id: petId,
                doc_type: "receipt",
                title: `SoMa Animal Hospital — ${attachment.filename}`,
                doc_date: null,
                source_org: "SoMa Animal Hospital",
                status: "ingested",
                file_url: storageKey,
                raw_text: null,
                text_extracted: null,
                triage_result: null,
                external_refs: {
                    source: "email",
                    gmail_msg_id: email.gmailMsgId,
                    content_sha256: attachment.contentSha256,
                },
                updated_at: FIXED_NOW,
            }

            state.documents.push(document)
            return document
        },
    }
}

function materializeVerifiedFixture(state, document) {
    const materialization = buildVerifiedDocumentMaterialization({
        document,
        extracted: document.text_extracted,
        verifiedBy: "rosa",
        verifiedAt: FIXED_NOW,
    })

    Object.assign(document, materialization.documentUpdate, {
        updated_at: FIXED_NOW,
    })

    const injection = materialization.events[0]
    state.events.push({
        ...injection,
        id: IDS.augustInjection,
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW,
    })

    materialization.costItems.forEach((item, index) => {
        state.costItems.push({
            ...item,
            id: `50000000-0000-4000-8000-00000000080${index}`,
        })
    })

    const measurement = materialization.weightMeasurement
    state.facts.push({
        id: IDS.augustWeight,
        pet_id: document.pet_id,
        doc_id: document.id,
        fact_type: "weight",
        fact_date: measurement.measured_date,
        status: "verified",
        value_json: clone(measurement),
        confidence: 1,
        verified_at: FIXED_NOW,
        verified_by: "rosa",
    })
    state.pet.weight_value = measurement.value_kg
    state.pet.weight_unit = "kg"

    return materialization
}

function upsertLibrelaReminder(state, document) {
    const documentEvents = state.events.filter(
        (event) => event.doc_id === document.id
    )
    const plan = buildLibrelaReconciliationPlan({
        document,
        documentEvents,
        petEvents: state.events,
    })
    const injection = plan.injection

    for (const reminder of plan.prior_reminders) {
        reminder.status = "completed"
        reminder.details_json = {
            ...reminder.details_json,
            completion_reason:
                "superseded_by_verified_librela_injection",
            completion_event_id: injection.id,
        }
    }

    let reminder = plan.target_reminder
    if (!reminder) {
        reminder = {
            id: IDS.librelaReminder,
            pet_id: document.pet_id,
            doc_id: document.id,
            event_type: "reminder",
            event_date: plan.expected.reminder_date,
            status: "planned",
            details_json: {
                subtype: "Librela",
                action_type: "create_librela_reminder",
                rule_version: plan.expected.rule_version,
                anchor_event_id: injection.id,
                anchor_event_date: plan.expected.anchor_date,
                due_date: plan.expected.due_date,
                source_document_id: document.id,
                source_document_title: document.title,
                source_org: document.source_org,
                timing_state: "upcoming",
                calendar_sync_status: "not_synced",
                reconciliation_key: `librela_v1:${document.id}:${plan.expected.anchor_date}`,
            },
            created_at: FIXED_NOW,
            updated_at: FIXED_NOW,
        }
        state.events.push(reminder)
    }

    return { plan, reminder }
}

function upsertInsuranceReminder(state, document) {
    const plan = buildInsuranceClaimReminderPlan({
        document,
        careDate: CARE_DATE,
        requestedBy: "rosa",
        insuranceProvider: "Nationwide",
        requestedAt: FIXED_NOW,
    })

    assert.equal(plan.actionable, true)

    let reminder = state.events.find(
        (event) =>
            event.doc_id === document.id &&
            event.event_type === "reminder" &&
            event.status === "planned" &&
            event.details_json?.subtype === "Insurance claim"
    )

    if (reminder) {
        Object.assign(reminder, clone(plan.payload))
    } else {
        reminder = {
            ...clone(plan.payload),
            id: IDS.insuranceReminder,
            created_at: FIXED_NOW,
            updated_at: FIXED_NOW,
        }
        state.events.push(reminder)
    }

    return { plan, reminder }
}

function syncCalendar(state, reminder) {
    const details = reminder.details_json || {}
    const externalRefs = details.external_refs || {}
    const existingId = externalRefs.google_calendar_event_id || null
    const stableId = getStableGoogleCalendarEventId(reminder.id)
    const calendarId = existingId || stableId
    const action = state.calendarEvents.has(calendarId) ? "updated" : "created"

    if (action === "created") state.calendarCalls.inserts += 1
    else state.calendarCalls.updates += 1

    const calendarEvent = {
        id: calendarId,
        htmlLink: `https://calendar.example.invalid/event/${calendarId}`,
        event_date: reminder.event_date,
        subtype: details.subtype,
    }
    state.calendarEvents.set(calendarId, calendarEvent)
    reminder.details_json = {
        ...details,
        calendar_sync_status: "synced",
        external_refs: {
            ...externalRefs,
            google_calendar_calendar_id: "fixture-calendar",
            google_calendar_event_id: calendarId,
            google_calendar_html_link: calendarEvent.htmlLink,
            google_calendar_last_synced_at: FIXED_NOW,
        },
    }

    return { action, calendarEvent }
}

function buildContext(state) {
    return buildTrustedContextFromRows({
        petId: IDS.pet,
        events: state.events,
        costItems: state.costItems,
        documents: state.documents,
        facts: state.facts,
    })
}

async function askTomo(state, question) {
    return answerAssistantQuestion({
        petId: IDS.pet,
        question,
        dependencies: {
            semanticProvider: null,
            currentCareDate: CARE_DATE,
            buildContext: async () => buildContext(state),
            personalizeAnswer: ({ response }) => response,
        },
    })
}

function snapshotTrustedOutputs(state) {
    const currentDocument = state.documents.find(
        (document) => document.id === IDS.document
    )

    return clone({
        document: currentDocument,
        events: state.events
            .filter(
                (event) =>
                    event.id === IDS.priorReminder ||
                    event.doc_id === IDS.document
            )
            .sort((a, b) => a.id.localeCompare(b.id)),
        facts: state.facts
            .filter((fact) => fact.doc_id === IDS.document)
            .sort((a, b) => a.id.localeCompare(b.id)),
        costItems: state.costItems
            .filter((item) => item.doc_id === IDS.document)
            .sort((a, b) => a.id.localeCompare(b.id)),
        petWeight: {
            value: state.pet.weight_value,
            unit: state.pet.weight_unit,
        },
        calendarEvents: [...state.calendarEvents.values()].sort((a, b) =>
            a.id.localeCompare(b.id)
        ),
    })
}

test("runs the deterministic August 3 Librela lifecycle twice without duplicates", async () => {
    const state = createState()
    const gmail = buildAugust3GmailFixture()

    assert.deepEqual(classifyAttachment(gmail.attachments[0]), {
        action: "ingest",
        reason: "canonical_receipt_pdf",
    })

    const firstIngest = await ingestGmailReceipts({
        petId: IDS.pet,
        dependencies: buildIngestDependencies(state),
    })

    assert.equal(firstIngest.documentsCreated, 1)
    assert.equal(firstIngest.skippedDuplicates, 0)
    assert.equal(firstIngest.uploadedObjects, 1)

    const document = state.documents[0]
    assert.equal(getDocumentProcessingDecision(document).allowed, true)

    Object.assign(document, {
        raw_text: AUGUST_3_RAW_TEXT,
        text_extracted: clone(AUGUST_3_EXTRACTED),
        triage_result: clone(AUGUST_3_TRIAGE),
        status: "needs_review",
    })

    const beforeReview = getTriageReviewState({
        triageResult: document.triage_result,
        acceptedPaths: new Set(),
    })
    assert.equal(beforeReview.flaggedTotal, 15)
    assert.equal(beforeReview.flaggedResolved, 0)
    assert.equal(beforeReview.blocksApprove, true)

    const acceptedPaths = new Set(
        document.triage_result.fields.map((field) => field.path)
    )
    const afterReview = getTriageReviewState({
        triageResult: document.triage_result,
        acceptedPaths,
    })
    assert.equal(afterReview.flaggedResolved, 15)
    assert.equal(afterReview.unreviewedCount, 0)
    assert.equal(afterReview.blocksApprove, false)
    assert.deepEqual(validateExtracted(document.text_extracted), {})

    const materialization = materializeVerifiedFixture(state, document)
    assert.equal(materialization.canonicalization.derived, true)
    assert.equal(materialization.events.length, 1)
    assert.equal(materialization.costItems.length, 4)
    assert.equal(materialization.weightMeasurement.value_kg, 15.1)
    assert.equal(
        state.costItems.reduce((total, item) => total + item.amount, 0),
        160.4
    )

    const serverRecommendations = {
        librelaReminder: buildLibrelaReminderRecommendation({
            document,
            materializedEvents: state.events.filter(
                (event) => event.doc_id === document.id
            ),
        }),
        weightMaterialization: buildWeightMaterializationRecommendation({
            document,
            facts: state.facts.filter((fact) => fact.doc_id === document.id),
            pet: state.pet,
        }),
    }
    const recommendations = getPostVerifyRecommendations({
        ...document,
        action_recommendations: serverRecommendations,
    })
    assert.equal(recommendations.librelaReminder.state, "eligible")
    assert.equal(recommendations.weightMaterialization.state, "materialized")
    assert.equal(recommendations.insuranceClaimReminder.recommended, true)

    const librela = upsertLibrelaReminder(state, document)
    const insurance = upsertInsuranceReminder(state, document)

    assert.equal(librela.plan.expected.reminder_date, "2026-09-14")
    assert.equal(librela.plan.expected.due_date, "2026-09-21")
    assert.equal(insurance.plan.target_submit_date, "2026-09-02")
    assert.equal(insurance.plan.claim_deadline_date, "2027-01-30")
    assert.equal(
        state.events.find((event) => event.id === IDS.priorReminder).status,
        "completed"
    )

    assert.equal(syncCalendar(state, librela.reminder).action, "created")
    assert.equal(syncCalendar(state, insurance.reminder).action, "created")
    assert.equal(state.calendarEvents.size, 2)

    const dashboardReminders = state.events
        .filter(
            (event) =>
                event.event_type === "reminder" && event.status === "planned"
        )
        .map((event) => ({
            ...event,
            google_calendar_url:
                event.details_json?.external_refs?.google_calendar_html_link,
            timing_state: event.details_json?.timing_state,
        }))
    const presentations = dashboardReminders.map((reminder) =>
        getCompactReminderPresentation(reminder, {
            lastLibrelaDate: "2026-08-03",
        })
    )
    assert.deepEqual(
        presentations.map((presentation) => presentation.kind).sort(),
        ["insurance", "librela"]
    )
    assert.ok(
        presentations.every(
            (presentation) => presentation.calendarIsSpecificEvent
        )
    )

    const careSummary = summarizeVerifiedCareEvents(state.events)
    assert.equal(careSummary.last_librela.id, IDS.augustInjection)
    assert.equal(careSummary.last_librela.event_date, "2026-08-03")

    const lastLibrela = await askTomo(
        state,
        "When was Momo’s last Librela shot?"
    )
    const latestWeight = await askTomo(
        state,
        "What is Momo’s latest verified weight?"
    )
    const visitTotal = await askTomo(
        state,
        "How much was Momo’s latest Librela visit?"
    )
    const activeReminders = await askTomo(
        state,
        "What reminders are active?"
    )

    assert.match(lastLibrela.answer, /August 3, 2026/)
    assert.equal(lastLibrela.citations[0].id, IDS.augustInjection)
    assert.match(latestWeight.answer, /15\.1 kg/)
    assert.match(latestWeight.answer, /August 3, 2026/)
    assert.equal(latestWeight.citations[0].id, IDS.augustWeight)
    assert.match(visitTotal.answer, /\$160\.40/)
    assert.equal(visitTotal.citations.length, 4)
    assert.match(activeReminders.answer, /Librela on September 14, 2026/)
    assert.match(
        activeReminders.answer,
        /Insurance claim on September 2, 2026/
    )

    const firstSnapshot = snapshotTrustedOutputs(state)

    const secondIngest = await ingestGmailReceipts({
        petId: IDS.pet,
        dependencies: buildIngestDependencies(state),
    })
    assert.equal(secondIngest.documentsCreated, 0)
    assert.equal(secondIngest.skippedDuplicates, 1)
    assert.equal(state.documents.length, 1)

    const verifiedDecision = getDocumentProcessingDecision(document, {
        force: true,
    })
    assert.equal(verifiedDecision.allowed, false)
    assert.match(verifiedDecision.reason, /explicit repair workflow/)

    const retriedLibrela = upsertLibrelaReminder(state, document)
    const retriedInsurance = upsertInsuranceReminder(state, document)
    assert.equal(retriedLibrela.plan.state, "already_reconciled")
    assert.equal(retriedLibrela.reminder.id, IDS.librelaReminder)
    assert.equal(retriedInsurance.reminder.id, IDS.insuranceReminder)
    assert.equal(syncCalendar(state, retriedLibrela.reminder).action, "updated")
    assert.equal(
        syncCalendar(state, retriedInsurance.reminder).action,
        "updated"
    )

    assert.equal(state.calendarCalls.inserts, 2)
    assert.equal(state.calendarCalls.updates, 2)
    assert.equal(state.calendarEvents.size, 2)
    assert.deepEqual(snapshotTrustedOutputs(state), firstSnapshot)

    assert.equal(
        state.events.filter(
            (event) =>
                event.doc_id === document.id &&
                event.event_type === "injection" &&
                event.status === "verified"
        ).length,
        1
    )
    assert.equal(
        state.facts.filter((fact) => fact.doc_id === document.id).length,
        1
    )
    assert.equal(
        state.costItems.filter((item) => item.doc_id === document.id).length,
        4
    )
    assert.equal(
        state.events.filter(
            (event) =>
                event.doc_id === document.id &&
                event.event_type === "reminder" &&
                event.status === "planned"
        ).length,
        2
    )
})
