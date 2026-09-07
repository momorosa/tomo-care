import { useEffect, useState } from "react"
import { fetchRuntimeContext } from "./runtimeContext.js"
import { RuntimeProvider } from "./RuntimeContext.jsx"

export default function RuntimeGate({ children }) {
    const [state, setState] = useState({ status: "loading" })

    useEffect(() => {
        let active = true

        fetchRuntimeContext()
            .then((runtime) => {
                if (active) setState({ status: "ready", runtime })
            })
            .catch(() => {
                if (active) setState({ status: "unavailable" })
            })

        return () => {
            active = false
        }
    }, [])

    if (state.status === "loading") {
        return (
            <main
                className="tomo-runtime-state"
                aria-busy="true"
                aria-label="Confirming TomoCare data environment"
            >
                <p>Confirming the data environment…</p>
            </main>
        )
    }

    if (state.status !== "ready") {
        return (
            <main className="tomo-runtime-state" role="alert">
                <h1>Data environment unavailable</h1>
                <p>
                    TomoCare did not load care data because it could not confirm
                    whether this is the private or demo environment.
                </p>
            </main>
        )
    }

    return (
        <RuntimeProvider value={state.runtime}>
            {children}
        </RuntimeProvider>
    )
}
