import { useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import momoPortrait from "../../../assets/momoPic.png"
import { formatDisplayDate } from "../../lib/displayDate.js"
import { formatAgeValue } from "../../lib/petAge.js"
import { HOME_SECTIONS } from "./conversationalHomeState.js"
import { getInboxErrorPresentation } from "./inboxErrorPresentation.js"
import { getCompactReminderPresentation } from "./reminderPresentation.js"
import {
    getCalendarStatusMessage,
    getReminderCalendarControl,
} from "./calendarRecovery.js"

const NAV_ITEMS = [
    { section: HOME_SECTIONS.PROFILE, label: "Momo", icon: "pets" },
    {
        section: HOME_SECTIONS.REMINDERS,
        label: "Reminders",
        icon: "notifications",
    },
    { section: HOME_SECTIONS.INBOX, label: "Inbox", icon: "inbox" },
    {
        section: HOME_SECTIONS.VERIFIED,
        label: "Recently verified",
        icon: "fact_check",
    },
]

export function CareNavigation({
    activeSection,
    collapsed,
    reminderCount,
    reviewCount,
    onSelect,
    onCollapse,
    onExpand,
}) {
    return (
        <nav
            className={`tomo-care-nav ${collapsed ? "tomo-care-nav--collapsed" : ""}`}
            aria-label="Momo care navigation"
        >
            <div className="tomo-care-nav__header">
                {!collapsed && (
                    <p className="tomo-section-label whitespace-nowrap">
                        Momo’s care
                    </p>
                )}
                <button
                    type="button"
                    className="tomo-icon-button ml-auto"
                    onClick={collapsed ? onExpand : onCollapse}
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    <span className="material-symbols-outlined" aria-hidden="true">
                        {collapsed ? "menu" : "menu_open"}
                    </span>
                </button>
            </div>

            <div className="tomo-care-nav__items">
                {NAV_ITEMS.map((item) => {
                    const selected = activeSection === item.section
                    const count =
                        item.section === HOME_SECTIONS.REMINDERS
                            ? reminderCount
                            : item.section === HOME_SECTIONS.INBOX
                              ? reviewCount
                              : 0

                    return (
                        <button
                            key={item.section}
                            type="button"
                            className={`tomo-care-nav__item ${selected ? "tomo-care-nav__item--active" : ""}`}
                            onClick={() => onSelect(item.section)}
                            aria-current={selected ? "page" : undefined}
                            title={collapsed ? item.label : undefined}
                        >
                            <span
                                className="material-symbols-outlined shrink-0"
                                aria-hidden="true"
                            >
                                {item.icon}
                            </span>
                            {!collapsed && (
                                <>
                                    <span className="min-w-0 flex-1 truncate text-left">
                                        {item.label}
                                    </span>
                                    {count > 0 && (
                                        <span className="tomo-nav-count">{count}</span>
                                    )}
                                </>
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="tomo-care-nav__footer">
                <div className="flex items-center gap-2 text-xs leading-5 text-tomo-text">
                    <span
                        className="material-symbols-outlined text-base text-tomo-success"
                        aria-hidden="true"
                    >
                        verified_user
                    </span>
                    {!collapsed && <span>Approval-gated</span>}
                </div>
            </div>
        </nav>
    )
}

export function CareContextDrawer({
    section,
    reminders,
    loadingReminders,
    remindersError,
    refreshingReminders,
    reviewDocuments,
    verifiedDocuments,
    careSummary,
    inboxResult,
    inboxError,
    checkingInbox,
    calendarSyncByReminder,
    focusedReminderId,
    onClose,
    onCheckInbox,
    onRefreshReminders,
    onRecordGiven,
    onMarkFiled,
    onSyncCalendar,
}) {
    return (
        <aside className="tomo-context-drawer" aria-label="Selected care section">
            <div className="tomo-context-drawer__header">
                <ContextHeading section={section} />
                <button
                    type="button"
                    className="tomo-icon-button shrink-0"
                    onClick={onClose}
                    aria-label="Close care details"
                    title="Close care details"
                >
                    <span className="material-symbols-outlined" aria-hidden="true">
                        close
                    </span>
                </button>
            </div>

            <div className="tomo-context-drawer__body">
                {section === HOME_SECTIONS.PROFILE && (
                    <ProfileContext
                        careSummary={careSummary}
                        reminderCount={reminders.length}
                    />
                )}

                {section === HOME_SECTIONS.REMINDERS && (
                    <ReminderContext
                        reminders={reminders}
                        careSummary={careSummary}
                        loading={loadingReminders}
                        error={remindersError}
                        refreshing={refreshingReminders}
                        calendarSyncByReminder={calendarSyncByReminder}
                        focusedReminderId={focusedReminderId}
                        onRefresh={onRefreshReminders}
                        onRecordGiven={onRecordGiven}
                        onMarkFiled={onMarkFiled}
                        onSyncCalendar={onSyncCalendar}
                    />
                )}

                {section === HOME_SECTIONS.INBOX && (
                    <InboxContext
                        documents={reviewDocuments}
                        result={inboxResult}
                        error={inboxError}
                        checking={checkingInbox}
                        onCheck={onCheckInbox}
                    />
                )}

                {section === HOME_SECTIONS.VERIFIED && (
                    <VerifiedContext documents={verifiedDocuments} />
                )}
            </div>
        </aside>
    )
}

function ContextHeading({ section }) {
    const content = {
        [HOME_SECTIONS.PROFILE]: ["Momo", "Momo Care Profile"],
        [HOME_SECTIONS.REMINDERS]: ["Needs attention", "Reminders"],
        [HOME_SECTIONS.INBOX]: ["Document intake", "Inbox"],
        [HOME_SECTIONS.VERIFIED]: ["Trusted records", "Recently verified"],
    }[section]

    return (
        <div className="tomo-context-heading">
            <p className="tomo-section-label">{content[0]}</p>
            <h2 className="tomo-context-heading__title">
                {content[1]}
            </h2>
        </div>
    )
}

function ProfileContext({ careSummary, reminderCount }) {
    const profile = careSummary.pet_profile || {}
    const name = profile.name || "Momo"
    const species = profile.species
        ? profile.species.charAt(0).toUpperCase() + profile.species.slice(1)
        : "Species not set"
    const breed = profile.breed || "Breed not set"
    const sex = profile.sex
        ? profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1)
        : "Sex not set"
    const reproductiveStatus = profile.reproductive_status
        ? profile.reproductive_status
              .replaceAll("_", " ")
              .replace(/^./, (character) => character.toUpperCase())
        : "Status not set"

    return (
        <div className="tomo-profile-context">
            <div className="tomo-profile-summary">
                <img
                    src={momoPortrait}
                    alt={name}
                    className="tomo-profile-summary__portrait"
                />
                <div className="min-w-0">
                    <p className="text-lg font-semibold text-tomo-text-h">{name}</p>
                    <p className="mt-1 text-sm text-tomo-text">
                        {species} · {breed} · {formatAgeValue(profile.age)}
                    </p>
                    <p className="text-sm text-tomo-text">
                        {sex} · {reproductiveStatus}
                    </p>
                </div>
            </div>

            <dl className="tomo-profile-facts">
                <ContextFact
                    label="Latest verified care"
                    value={formatDisplayDate(
                        careSummary.latest_verified_care?.event_date
                    )}
                />
                <ContextFact
                    label="Last Librela"
                    value={formatDisplayDate(careSummary.last_librela?.event_date)}
                />
                <ContextFact label="Active reminders" value={reminderCount} />
                <ContextFact label="Primary clinic" value="SoMa AH" />
                <ContextFact label="Insurance" value="Nationwide" />
            </dl>
        </div>
    )
}

function ContextFact({ label, value }) {
    return (
        <div className="tomo-context-fact">
            <dt className="text-tomo-text">{label}</dt>
            <dd className="min-w-0 text-right font-medium text-tomo-text-h">
                {value}
            </dd>
        </div>
    )
}

function ReminderContext({
    reminders,
    careSummary,
    loading,
    error,
    refreshing,
    calendarSyncByReminder,
    focusedReminderId,
    onRefresh,
    onRecordGiven,
    onMarkFiled,
    onSyncCalendar,
}) {
    const reminderRefs = useRef(new Map())

    useEffect(() => {
        if (!focusedReminderId) return

        const reminderElement = reminderRefs.current.get(focusedReminderId)
        if (!reminderElement) return

        reminderElement.open = true
        reminderElement.scrollIntoView({ block: "nearest" })
        reminderElement.focus({ preventScroll: true })
    }, [focusedReminderId, reminders])

    return (
        <div>
            <button
                type="button"
                className="tomo-btn tomo-btn-secondary w-full gap-2 text-sm"
                onClick={onRefresh}
                disabled={refreshing}
            >
                <span
                    className={`material-symbols-outlined text-lg ${refreshing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                >
                    refresh
                </span>
                {refreshing ? "Refreshing…" : "Refresh reminders"}
            </button>

            {loading && <p className="mt-5 text-sm text-tomo-text">Loading reminders…</p>}
            {error && <ContextError>{error}</ContextError>}
            {!loading && !error && reminders.length === 0 && (
                <p className="mt-5 text-sm leading-6 text-tomo-text">
                    No active reminders right now.
                </p>
            )}

            <div className="mt-4 space-y-2">
                {reminders.map((reminder) => {
                    const meta = getCompactReminderPresentation(reminder, {
                        lastLibrelaDate:
                            careSummary.last_librela?.event_date || null,
                    })
                    const calendarState = calendarSyncByReminder[reminder.id]
                    const calendarMessage =
                        getCalendarStatusMessage(calendarState)

                    return (
                        <details
                            key={reminder.id}
                            id={`reminder-${reminder.id}`}
                            ref={(element) => {
                                if (element) {
                                    reminderRefs.current.set(reminder.id, element)
                                } else {
                                    reminderRefs.current.delete(reminder.id)
                                }
                            }}
                            tabIndex={-1}
                            className={`tomo-compact-reminder tomo-compact-reminder--${meta.kind} group`}
                        >
                            <summary className="list-none cursor-pointer">
                                <div className="tomo-compact-reminder__summary">
                                    <div
                                        className="tomo-compact-reminder__icon"
                                        aria-hidden="true"
                                    >
                                        <span className="material-symbols-outlined">
                                            {meta.icon}
                                        </span>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="tomo-compact-reminder__eyebrow">
                                            {meta.eyebrow}
                                        </p>
                                        <p className="tomo-compact-reminder__title">
                                            {meta.title}
                                        </p>
                                        <p className="mt-1 text-xs tabular-nums text-tomo-text">
                                            {meta.dateLabel}
                                        </p>
                                    </div>

                                    <div className="tomo-compact-reminder__status">
                                        <span className={`tomo-badge ${meta.badgeClass}`}>
                                            {meta.statusLabel}
                                        </span>
                                    </div>
                                </div>

                                <CalendarControl
                                    reminder={reminder}
                                    meta={meta}
                                    transientState={calendarState}
                                    className="tomo-calendar-footer tomo-calendar-footer--collapsed"
                                    onSync={onSyncCalendar}
                                    onClick={(event) => event.stopPropagation()}
                                />
                            </summary>

                            <div className="tomo-compact-reminder__details">
                                {meta.details.length > 0 && (
                                    <dl className="space-y-1.5">
                                        {meta.details.map((row) => (
                                            <div
                                                key={`${row.label || "detail"}-${row.value}`}
                                                className="tomo-compact-reminder__detail-row"
                                            >
                                                {row.label && <dt>{row.label}</dt>}
                                                <dd className={!row.label ? "col-span-2" : ""}>
                                                    {row.value}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}

                                {meta.note && (
                                    <p className="mt-3 text-xs leading-5 text-tomo-text">
                                        {meta.note}
                                    </p>
                                )}

                                <div className="mt-3 flex flex-wrap gap-2">
                                    {isRecordableHomeMedication(reminder) && (
                                        <button
                                            type="button"
                                            className="tomo-btn tomo-btn-primary px-3 py-1 text-xs"
                                            onClick={() => onRecordGiven(reminder)}
                                        >
                                            Record given
                                        </button>
                                    )}
                                    {isFileableInsuranceClaim(reminder) && (
                                        <button
                                            type="button"
                                            className="tomo-btn tomo-btn-primary px-3 py-1 text-xs"
                                            onClick={() => onMarkFiled(reminder)}
                                        >
                                            Mark filed
                                        </button>
                                    )}
                                </div>
                                {calendarMessage && (
                                    <p
                                        className={`mt-3 text-xs leading-5 ${
                                            calendarMessage.tone === "success"
                                                ? "text-tomo-success"
                                                : calendarMessage.tone === "warning"
                                                  ? "text-tomo-warning"
                                                  : "text-tomo-danger"
                                        }`}
                                        role="status"
                                    >
                                        {calendarMessage.text}
                                    </p>
                                )}
                                {calendarState?.phase ===
                                    "reauthorization_required" && (
                                    <CalendarReconnectGuidance />
                                )}
                            </div>

                            <CalendarControl
                                reminder={reminder}
                                meta={meta}
                                transientState={calendarState}
                                className="tomo-calendar-footer tomo-calendar-footer--expanded"
                                onSync={onSyncCalendar}
                            />
                        </details>
                    )
                })}
            </div>
        </div>
    )
}

function CalendarControl({
    reminder,
    meta,
    transientState,
    className,
    onSync,
    onClick,
}) {
    const control = getReminderCalendarControl(reminder, transientState)
    const content = (
        <>
            <span
                className="material-symbols-outlined text-lg"
                aria-hidden="true"
            >
                calendar_month
            </span>
            {control.label}
        </>
    )

    if (control.kind === "sync") {
        return (
            <button
                type="button"
                className={className}
                disabled={control.disabled}
                aria-label={`${control.label}: ${meta.title}`}
                onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onClick?.(event)
                    onSync?.(reminder)
                }}
            >
                {content}
            </button>
        )
    }

    return (
        <a
            href={control.href}
            target="_blank"
            rel="noreferrer"
            className={className}
            aria-label={`${control.label}: ${meta.title}`}
            title={control.label}
            onClick={onClick}
        >
            {content}
        </a>
    )
}

function CalendarReconnectGuidance() {
    return (
        <div
            className="mt-3 rounded-xl border border-tomo-warning/30 bg-tomo-warning/10 p-3 text-xs leading-5 text-tomo-text"
            role="status"
        >
            <p className="font-semibold text-tomo-text-h">
                Reconnect Google Calendar
            </p>
            <p className="mt-1">
                Run the reconnect command from the TomoCare project folder,
                update <code>GCAL_REFRESH_TOKEN</code> in <code>.env</code>, and
                restart TomoCare.
            </p>
            <code className="mt-2 block overflow-x-auto rounded-lg bg-tomo-code px-2 py-1.5 text-tomo-text-h">
                node server/scripts/get-gcal-refresh-token.js
            </code>
            <p className="mt-2">
                Then choose <strong>Try Calendar again</strong>. The TomoCare
                reminder is already safe.
            </p>
        </div>
    )
}

function InboxContext({ documents, result, error, checking, onCheck }) {
    const readyCount = documents.length

    return (
        <div>
            <div className="tomo-compact-record">
                <p className="text-3xl font-semibold text-tomo-text-h">{readyCount}</p>
                <p className="mt-1 text-sm text-tomo-text">
                    {readyCount === 1
                        ? "document ready for review"
                        : "documents ready for review"}
                </p>
                <p className="mt-3 text-xs leading-5 text-tomo-text">
                    Nothing enters Momo’s trusted record until you verify it.
                </p>
            </div>

            <button
                type="button"
                className={`tomo-btn tomo-btn-primary tomo-inbox-check mt-4 w-full text-sm${
                    checking ? " tomo-inbox-check--loading" : " gap-2"
                }`}
                onClick={onCheck}
                disabled={checking}
                aria-busy={checking}
                aria-label={checking ? "Checking Gmail inbox" : undefined}
            >
                {checking ? (
                    <>
                        <span className="tomo-inbox-check__track" aria-hidden="true">
                            <span className="tomo-inbox-check__dot" />
                        </span>
                        <span className="sr-only">Checking Gmail inbox</span>
                    </>
                ) : (
                    <>
                        <span
                            className="material-symbols-outlined text-lg"
                            aria-hidden="true"
                        >
                            inbox
                        </span>
                        Check inbox
                    </>
                )}
            </button>

            {checking && (
                <p className="mt-2 text-xs text-tomo-text" role="status" aria-live="polite">
                    Checking Gmail… This can take up to about 30 seconds.
                </p>
            )}
            {error && <InboxError error={error} />}

            {result && (
                <div className="mt-4 rounded-xl border border-tomo-border p-3 text-xs text-tomo-text">
                    <p className="font-medium text-tomo-text-h">Latest inbox check</p>
                    <p className="mt-2">
                        {result.processedToReview || 0} ready for review ·{" "}
                        {result.skippedDuplicates || 0} duplicates skipped
                    </p>
                </div>
            )}

            <div className="mt-4 space-y-2">
                {documents.slice(0, 5).map((doc) => (
                    <Link
                        key={doc.id}
                        to={`/review/${doc.id}`}
                        className="tomo-compact-link"
                    >
                        <span className="min-w-0">
                            <span className="block truncate font-medium text-tomo-text-h">
                                {doc.title || "Document ready for review"}
                            </span>
                            <span className="mt-1 block text-xs text-tomo-text">
                                {doc.source_org || doc.doc_type || "Source document"}
                            </span>
                        </span>
                        <span className="material-symbols-outlined text-lg" aria-hidden="true">
                            chevron_right
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    )
}

function VerifiedContext({ documents }) {
    if (documents.length === 0) {
        return <p className="text-sm text-tomo-text">No verified records yet.</p>
    }

    return (
        <div className="space-y-2">
            {documents.map((doc) => (
                <Link key={doc.id} to={`/review/${doc.id}`} className="tomo-compact-link">
                    <span className="min-w-0">
                        <span className="block truncate font-medium text-tomo-text-h">
                            {doc.title || "Verified document"}
                        </span>
                        <span className="mt-1 block text-xs text-tomo-text">
                            {formatDisplayDate(doc.doc_date)}
                            {doc.source_org ? ` · ${doc.source_org}` : ""}
                        </span>
                    </span>
                    <span
                        className="material-symbols-outlined text-lg text-tomo-success"
                        aria-hidden="true"
                    >
                        fact_check
                    </span>
                </Link>
            ))}
        </div>
    )
}

function ContextError({ children }) {
    return (
        <p className="mt-4 rounded-xl border border-[color:var(--tomo-danger-border)] bg-[var(--tomo-danger-bg)] px-3 py-2 text-xs leading-5 text-tomo-danger">
            {children}
        </p>
    )
}

function InboxError({ error }) {
    const presentation = getInboxErrorPresentation(error)

    return (
        <div className="tomo-inbox-error" role="alert">
            <span
                className="material-symbols-outlined mt-0.5 shrink-0 text-lg"
                aria-hidden="true"
            >
                error
            </span>
            <span>
                <span className="block font-semibold text-tomo-text-h">
                    {presentation.title}
                </span>
                <span className="mt-0.5 block">{presentation.message}</span>
            </span>
        </div>
    )
}

function isRecordableHomeMedication(reminder) {
    const details = reminder.details_json || {}

    return (
        details.reminder_type === "home_medication" &&
        details.requires_appointment === false &&
        ["due_now", "overdue"].includes(reminder.timing_state)
    )
}

function isFileableInsuranceClaim(reminder) {
    return (
        reminder.details_json?.subtype === "Insurance claim" &&
        reminder.status !== "completed"
    )
}
