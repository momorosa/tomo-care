export default function NotificationCard({
    eyebrow = "Notification",
    title,
    body,
    meta = [],
    actionLabel,
    onAction,
    variant = "accent",
}) {
    const surfaceClass =
        variant === "accent"
            ? "tomo-accent-surface border-tomo-accent/30"
            : "tomo-surface border-tomo-border"

    return (
        <section className={`${surfaceClass} rounded-2xl border p-5`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    {eyebrow && (
                        <p className="tomo-section-label mb-2">
                            {eyebrow}
                        </p>
                    )}

                    <h2 className="text-xl font-semibold text-tomo-text-h">
                        {title}
                    </h2>

                    {body && (
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-tomo-text">
                            {body}
                        </p>
                    )}

                    {meta.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-tomo-text">
                            {meta
                                .filter(Boolean)
                                .map((item, index) => (
                                    <span
                                        key={`${item}-${index}`}
                                        className="rounded-full border border-tomo-border bg-white/[0.03] px-3 py-1"
                                    >
                                        {item}
                                    </span>
                                ))}
                        </div>
                    )}
                </div>

                {actionLabel && onAction && (
                    <button
                        type="button"
                        className="tomo-btn tomo-btn-primary shrink-0"
                        onClick={onAction}
                    >
                        {actionLabel}
                    </button>
                )}
            </div>
        </section>
    )
}