// Fictional component fixture: no Google, database or other network writes.
import { useState } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { RuntimeProvider } from "../../src/runtime/RuntimeContext.jsx"
import { CareContextDrawer } from "../../src/pages/Dashboard/CareSidebar.jsx"
import { HOME_SECTIONS } from "../../src/pages/Dashboard/conversationalHomeState.js"
import "../../src/index.css"
const reminder = {
    id: "fixture-librela",
    demo_calendar_available: true,
    title: "Librela shot due soon",
    subtype: "Librela",
    event_date: "2026-10-19",
    timing_state: "upcoming",
    details_json: {
        subtype: "Librela",
        due_date: "2026-10-26",
        anchor_event_date: "2026-09-07",
        message: "Fictional Librela reminder.",
    },
}
export default function Fixture() {
    const [state, setState] = useState(null)
    const [mode, setMode] = useState("demo")
    const [fail, setFail] = useState(false)
    const [calls, setCalls] = useState(0)
    const [wide, setWide] = useState(false)
    const synced = state?.phase === "synced"
    return (
        <RuntimeProvider value={{ mode }}>
            <main
                className="tomo-theme"
                style={{ padding: 20, minHeight: "100vh" }}
            >
                <h1>Demo calendar · fictional presentation fixture</h1>
                <p>No external writes. Explicit clicks: {calls}</p>
                <div className="flex flex-wrap gap-3 my-4">
                    <button
                        onClick={() => {
                            setState(null)
                            setCalls(0)
                        }}
                    >
                        Reset fixture
                    </button>
                    <button onClick={() => setFail((v) => !v)}>
                        Simulate failure: {fail ? "on" : "off"}
                    </button>
                    <button
                        onClick={() =>
                            setMode((m) => (m === "demo" ? "real" : "demo"))
                        }
                    >
                        Mode: {mode}
                    </button>
                    <button onClick={() => setWide((v) => !v)}>
                        Width: {wide ? "wide" : "narrow"}
                    </button>
                </div>
                <div style={{ maxWidth: wide ? 440 : 300 }}>
                    <CareContextDrawer
                        section={HOME_SECTIONS.REMINDERS}
                        reminders={[
                            {
                                ...reminder,
                                google_calendar_url: synced
                                    ? "https://calendar.google.com/calendar/"
                                    : null,
                            },
                        ]}
                        careSummary={{
                            last_librela: { event_date: "2026-09-07" },
                        }}
                        calendarSyncByReminder={{ [reminder.id]: state }}
                        onSyncCalendar={() => {
                            setCalls((n) => n + 1)
                            setState(
                                fail
                                    ? {
                                          phase: "error",
                                          message:
                                              "Couldn’t update the demo calendar. Your TomoCare reminder is saved; try again.",
                                      }
                                    : {
                                          phase: "synced",
                                          message:
                                              "Added to TomoCare Demo — Synthetic Data. No alerts or appointment booking.",
                                      }
                            )
                        }}
                        onRefresh={() => {}}
                        onClose={() => {}}
                    />
                </div>
            </main>
        </RuntimeProvider>
    )
}
createRoot(document.getElementById("root")).render(
    <BrowserRouter>
        <Fixture />
    </BrowserRouter>
)
