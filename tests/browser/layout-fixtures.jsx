// Development-only fixtures: real UI components, fictional inputs, no service calls.
import { useState } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "../../src/index.css"
import PostVerifyActionsModal from "../../src/pages/VerifyDocs/PostVerifyActionsModal.jsx"
import CareActionDialog from "../../src/pages/Dashboard/CareActionDialog.jsx"
import LibrelaAppointmentMessageDialog from "../../src/pages/Dashboard/LibrelaAppointmentMessageDialog.jsx"
import WorkingPanel from "../../src/pages/VerifyDocs/WorkingPanel.jsx"
import VerifiedWeightTrendChart from "../../src/pages/Dashboard/VerifiedWeightTrendChart.jsx"
import { EvidencePresentationContext } from "../../src/pages/Dashboard/evidencePresentationContext.js"

const visualization = {
    schema_version: 1, type: "verified_weight_trend", unit: "kg",
    points: [
        { fact_id: "first", fact_date: "2026-08-01", value_kg: 13.3, value_lb: 29.32 },
        { fact_id: "latest", fact_date: "2026-09-07", value_kg: 13.1, value_lb: 28.88 },
    ],
    summary: { reading_count: 2, first_fact_id: "first", latest_fact_id: "latest", low_fact_ids: ["latest"], high_fact_ids: ["first"], overall_change_kg: -0.2 },
}
const draft = { message_body: "Hello fictional clinic. I would like to discuss Momo’s next appointment. This is a UI fixture only.", recipient_name: "Fictional clinic", purpose: "Review-only appointment draft", dates: { last_verified_injection_date: "2026-09-07", reminder_date: "2026-10-01", due_date: "2026-10-07" } }
export default function Fixtures() {
    const [modal, setModal] = useState(null)
    const [busy, setBusy] = useState(false)
    const [date, setDate] = useState("2026-09-19")
    const [visible, setVisible] = useState(true)
    const [states, setStates] = useState(() => new Map())
    const [tab, setTab] = useState("fields")
    const [editing, setEditing] = useState(false)
    const [invoice, setInvoice] = useState("SAMPLE-001")
    const [saved, setSaved] = useState(false)
    const extracted = { invoice_id: invoice, doc_date: "2026-09-07", source_org: "Fictional clinic", events: [], cost_items: [] }
    const dismiss = () => setModal(null)
    return <main className="tomo-theme" style={{padding: 16, minHeight: "100vh"}}>
        <h1>Layout fixtures · fictional · no care writes</h1>
        <p>Buttons below exercise shipped components without calling care services.</p>
        <label><input type="checkbox" checked={busy} onChange={e => setBusy(e.target.checked)} /> Simulate busy dialog</label>
        <div style={{display: "flex", gap: 8, flexWrap: "wrap", marginBlock: 16}}>
            <button className="tomo-btn tomo-btn-secondary" onClick={() => setModal("post")}>Open verification confirmation</button>
            <button className="tomo-btn tomo-btn-secondary" onClick={() => setModal("care")}>Open care date dialog</button>
            <button className="tomo-btn tomo-btn-secondary" onClick={() => setModal("draft")}>Open appointment draft</button>
            <button className="tomo-btn tomo-btn-secondary" onClick={() => setVisible(v => !v)}>Toggle chart mounting</button>
        </div>
        <div style={{maxWidth: 600}}>
            <EvidencePresentationContext.Provider value={{states, update: (key, patch) => setStates(current => new Map(current).set(key, {...current.get(key), ...patch}))}}>
                {visible && <VerifiedWeightTrendChart visualization={visualization} />}
            </EvidencePresentationContext.Provider>
            <WorkingPanel tab={tab} setTab={setTab} extracted={extracted} draftExtracted={extracted}
                counts={{events:0,cost_items:0,facts:0}} editMode={editing} editTargetPath="invoice_id" dirty={editing}
                onStartEdit={() => setEditing(true)} onCancelEdit={() => setEditing(false)}
                onUpdateInvoiceId={setInvoice} onSaveAndRecheck={() => {setEditing(false);setSaved(true)}} />
            <p role="status">{saved ? "Fixture correction saved; record remains unverified." : "Fixture record is unverified."}</p>
        </div>
        <PostVerifyActionsModal open={modal === "post"} onClose={dismiss} documentTitle="SAMPLE — fictional invoice"
            isLibrela runtimeMode="demo" insuranceClaimLoading={busy} />
        <CareActionDialog phase={modal === "care" ? busy ? "preparing" : "choosing" : "idle"}
            reminder={{details_json:{care_item:"Fixture medication"}}} selectedDate={date} maxDate="2026-09-19"
            onDateChange={setDate} onDismiss={dismiss} onPrepare={e=>e.preventDefault()} />
        {modal === "draft" && <LibrelaAppointmentMessageDialog draft={draft} runtimeMode="demo"
            phase={busy ? "preparing" : "drafting"} onDismiss={dismiss} />}
    </main>
}
createRoot(document.getElementById("root")).render(<BrowserRouter><Fixtures /></BrowserRouter>)
