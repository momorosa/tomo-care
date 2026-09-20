// Development-only presentation fixture. No network calls or care mutations.
import { useState } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { RuntimeProvider } from "../../src/runtime/RuntimeContext.jsx"
import { CareContextDrawer } from "../../src/pages/Dashboard/CareSidebar.jsx"
import { HOME_SECTIONS } from "../../src/pages/Dashboard/conversationalHomeState.js"
import "../../src/index.css"
const docs = [{id:"fixture",title:"SAMPLE — previously loaded document",doc_date:"2026-09-07"}]
export default function Fixture() {
    const [state, setState] = useState("error")
    const [cached, setCached] = useState(false)
    const [section, setSection] = useState(HOME_SECTIONS.VERIFIED)
    const [inboxCalls, setInboxCalls] = useState(0)
    return <RuntimeProvider value={{mode:"demo"}}><main className="tomo-theme" style={{padding:20,minHeight:"100vh"}}>
        <h1>Document loading recovery · fictional fixture</h1>
        <p>No database or Gmail requests. Inbox calls: {inboxCalls}</p>
        <div className="flex flex-wrap gap-3 my-4">
            <button onClick={()=>{setState("error");setCached(false)}}>Fail initial load</button>
            <button onClick={()=>{setState("error");setCached(true)}}>Fail with cached records</button>
            <button onClick={()=>setState("loading")}>Loading</button>
            <button onClick={()=>setState("ready")}>Successful empty load</button>
            <button onClick={()=>setSection(HOME_SECTIONS.INBOX)}>Inbox view</button>
            <button onClick={()=>setSection(HOME_SECTIONS.VERIFIED)}>Verified view</button>
        </div>
        <div style={{maxWidth:420}}><CareContextDrawer section={section} reminders={[]} careSummary={{}}
            reviewDocuments={cached?docs:[]} verifiedDocuments={cached?docs:[]}
            reviewLoadState={state} verifiedLoadState={state}
            onReloadReviewDocuments={()=>{setCached(true);setState("ready")}}
            onReloadVerifiedDocuments={()=>{setCached(true);setState("ready")}}
            onCheckInbox={()=>setInboxCalls(n=>n+1)} onClose={()=>{}} />
        </div>
    </main></RuntimeProvider>
}
createRoot(document.getElementById("root")).render(<BrowserRouter><Fixture /></BrowserRouter>)
