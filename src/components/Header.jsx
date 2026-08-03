import { Link } from "react-router-dom"
import tomoCareLogo from "../../assets/tomocare-logo.png"

export default function Header() {
    return (
        <header className="tomo-app-header h-[73px] border-b border-tomo-border bg-tomo-bg">
            <div className="flex h-full items-center px-4 md:px-5">
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
            </div>
        </header>
    )
}
