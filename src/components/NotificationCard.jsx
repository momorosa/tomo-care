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
            ? "border-tomo-border border-l-4 border-l-tomo-accent bg-white/[0.025]"
            : "border-tomo-border bg-white/[0.025]"

    return (
        <section
            className={`${surfaceClass} rounded-2xl border p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.8)] transition-colors hover:bg-white/[0.035]`}
        >
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
                        <div className="mt-3 flex flex-wrap gap-2">
                            {meta
                                .filter(Boolean)
                                .map((item, index) => (
                                    <span
                                        key={`${item}-${index}`}
                                        className="tomo-badge tomo-badge--neutral"
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