import { Link } from "react-router-dom"
import tomoCareLogo from "../../assets/tomocare-logo.png"
import { useRuntimeContext } from "../runtime/RuntimeContext.jsx"

export default function Header() {
    const runtime = useRuntimeContext()

    return (
        <header className="tomo-app-header h-[73px] border-b border-tomo-border bg-tomo-bg">
            <div className="flex h-full items-center justify-between gap-4 px-4 md:px-5">
                <Link
                    to="/"
                    aria-label="Go to TomoCare dashboard"
                    className="
                        group inline-flex items-center gap-2 rounded-full
                        -ml-2 px-2 py-1
                        transition-all duration-200 ease-out
                        hover:bg-white/[0.04]
                        hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
                        focus-visible:outline-none
                        focus-visible:bg-white/[0.035]
                        focus-visible:ring-1
                        focus-visible:ring-white/10
                    "
                >
                    <img
                        src={tomoCareLogo}
                        alt=""
                        className="
                            h-10 w-10
                            transition-transform duration-200 ease-out
                            group-hover:scale-[1.03]
                        "
                    />

                    <h1
                        className="
                            text-xl font-bold text-tomo-text-h font-primary
                            transition-colors duration-200
                            group-hover:text-white
                        "
                    >
                        TomoCare
                    </h1>
                </Link>

                {runtime.mode === "demo" ? (
                    <div
                        className="tomo-demo-indicator"
                        role="status"
                        aria-label="Demo environment. Fictional data only."
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">
                            science
                        </span>
                        <span>Demo data</span>
                    </div>
                ) : (
                    <div
                        className="tomo-private-indicator"
                        role="status"
                        aria-label="Private care environment. Real care records."
                    >
                        <span>Private care</span>
                    </div>
                )}
            </div>
        </header>
    )
}
