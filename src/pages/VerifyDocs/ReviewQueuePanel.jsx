import { stopWheelIfScrollable } from "./stopWheelIfScrollable"

export default function ReviewQueuePanel({ docs, selectedId, onSelect, loading }) {
    return (
        <div className="col-span-12 md:col-span-3 rounded-xl overflow-hidden tomo-surface">
            <div className="px-4 py-3 border-b border-tomo-border flex items-center justify-between">
                <p className="text-sm text-tomo-text-h">Review queue</p>
                <p className="text-xs text-tomo-text-h">{loading ? "Loading…" : `${docs.length}`}</p>
            </div>

            <div className="h-full overflow-y-auto overscroll-contain" onWheel={stopWheelIfScrollable}>
                {docs.map((d) => {
                    const active = d.id === selectedId
                    const verified = d.status === "verified"
                    return (
                        <button
                            key={d.id}
                            className={`w-full text-left px-4 py-3 border-b border-tomo-border/50 hover:bg-white/5 ${
                            active ? "bg-white/10" : "" }`}
                            onClick={() => onSelect(d.id)}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium truncate text-tomo-text-h">
                                    {d.title || d.doc_type}
                                </p>
                                <span
                                    className={`text-[11px] px-3 py-0.5 rounded-full ${
                                        verified
                                        ? "bg-green-500/15 text-green-200"
                                        : "bg-tomo-accent/15 text-tomo-accent"
                                    }`}
                                >
                                    {d.status || "ingested"}
                                </span>
                            </div>
                            <p className="text-xs text-tomo-text mt-1 truncate">
                                {d.source_org || "Unknown source"} · {d.doc_date || ""}
                            </p>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}