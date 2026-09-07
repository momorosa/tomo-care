import { Navigate, Route, Routes } from "react-router-dom"
import Header from "./components/Header.jsx"
import Dashboard from "./pages/Dashboard/Dashboard.jsx"
import VerifyDocs from "./pages/VerifyDocs/VerifyDocs.jsx"
import RuntimeGate from "./runtime/RuntimeGate.jsx"

export default function App() {
    return (
        <RuntimeGate>
            <div className="tomo-theme min-h-screen overflow-x-hidden bg-tomo-bg text-tomo-text">
                <Header />

                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/review" element={<VerifyDocs />} />
                    <Route path="/review/:docId" element={<VerifyDocs />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </RuntimeGate>
    )
}
