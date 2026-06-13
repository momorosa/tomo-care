import { useNavigate } from "react-router-dom"

export default function Dashboard() {
    const navigate = useNavigate()

    return (
        <main className="mx-auto max-w-[1120px] px-6 py-10">
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-tomo-text">
                    TomoCare
                </p>

                <h1 className="mt-3 text-3xl font-semibold text-tomo-text-h">
                    Momo’s care dashboard
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-tomo-text">
                    TomoCare watches for new care documents, prepares them for review,
                    and only adds them to Momo’s trusted record after verification.
                </p>

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate("/review")}
                        className="rounded-xl bg-yellow-mellow px-4 py-2 text-sm font-medium text-black"
                    >
                        Open review queue
                    </button>
                </div>
            </section>
        </main>
    )
}