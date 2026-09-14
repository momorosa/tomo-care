import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const appUrl = new URL("../App.jsx", import.meta.url)
const gateUrl = new URL("./RuntimeGate.jsx", import.meta.url)
const headerUrl = new URL("../components/Header.jsx", import.meta.url)
const indexUrl = new URL("../../index.html", import.meta.url)
const sidebarUrl = new URL("../pages/Dashboard/CareSidebar.jsx", import.meta.url)
const verifyUrl = new URL("../pages/VerifyDocs/VerifyDocs.jsx", import.meta.url)
const postVerifyUrl = new URL(
    "../pages/VerifyDocs/PostVerifyActionsModal.jsx",
    import.meta.url
)
const dashboardUrl = new URL("../pages/Dashboard/Dashboard.jsx", import.meta.url)
const assistantUrl = new URL(
    "../pages/Dashboard/AssistantPanel.jsx",
    import.meta.url
)
const appointmentDialogUrl = new URL(
    "../pages/Dashboard/LibrelaAppointmentMessageDialog.jsx",
    import.meta.url
)
const verifyApiUrl = new URL("../pages/VerifyDocs/api.js", import.meta.url)
const insuranceProviderRuntimeUrl = new URL(
    "../../server/lib/insuranceProviderRuntime.js",
    import.meta.url
)
const postVerifyActionsHookUrl = new URL(
    "../pages/VerifyDocs/hooks/usePostVerifyActions.js",
    import.meta.url
)

test("does not mount care routes until the server runtime is confirmed", async () => {
    const [app, gate] = await Promise.all([
        readFile(appUrl, "utf8"),
        readFile(gateUrl, "utf8"),
    ])

    assert.match(app, /<RuntimeGate>[\s\S]*<Routes>[\s\S]*<\/RuntimeGate>/)
    assert.match(gate, /state\.status === "loading"/)
    assert.match(gate, /state\.status !== "ready"/)
    assert.match(gate, /Data environment unavailable/)
    assert.match(gate, /<RuntimeProvider[\s\S]*\{children\}/)
})

test("renders one persistent accessible Demo data indicator in the global header", async () => {
    const [header, index] = await Promise.all([
        readFile(headerUrl, "utf8"),
        readFile(indexUrl, "utf8"),
    ])

    assert.match(header, /runtime\.mode === "demo"/)
    assert.match(header, /role="status"/)
    assert.match(header, /Demo environment\. Fictional data only\./)
    assert.match(header, />\s*science\s*</)
    assert.match(header, />Demo data</)
    assert.match(index, /icon_names=[^"&]*\bscience\b/)
    assert.match(index, /icon_names=[^"&]*\bvisibility\b/)
    assert.doesNotMatch(header, /dismiss|close|onClick|localStorage/)
    assert.match(header, /Private care environment\. Real care records\./)
    assert.match(header, />Private care</)
})

test("keeps real-care clinic and insurance labels out of demo Profile", async () => {
    const sidebar = await readFile(sidebarUrl, "utf8")

    assert.match(sidebar, /useRuntimeContext\(\)/)
    assert.match(
        sidebar,
        /runtime\.mode === "real"[\s\S]*Primary clinic[\s\S]*SoMa AH[\s\S]*Insurance[\s\S]*Nationwide/
    )
})

test("offers a prefilled but unsent governed follow-through draft in demo mode", async () => {
    const [
        verify,
        postVerify,
        dashboard,
        assistant,
        dialog,
        verifyApi,
        insuranceProviderRuntime,
        postVerifyActionsHook,
    ] =
        await Promise.all([
            readFile(verifyUrl, "utf8"),
            readFile(postVerifyUrl, "utf8"),
            readFile(dashboardUrl, "utf8"),
            readFile(assistantUrl, "utf8"),
            readFile(appointmentDialogUrl, "utf8"),
            readFile(verifyApiUrl, "utf8"),
            readFile(insuranceProviderRuntimeUrl, "utf8"),
            readFile(postVerifyActionsHookUrl, "utf8"),
        ])

    assert.match(verify, /assistantPrompt:[\s\S]*Draft a Librela appointment request/)
    assert.match(postVerify, /runtimeMode === "demo"/)
    assert.match(postVerify, /Ask Tomo/)
    assert.match(postVerify, /pet insurance claim/)
    assert.match(dashboard, /initialQuestion=\{initialAssistantQuestion\}/)
    assert.match(dashboard, /runtimeMode=\{runtime\.mode\}/)
    assert.match(assistant, /setQuestion\(initialQuestion\.trim\(\)\)/)
    assert.match(dialog, /Review-only demo draft/)
    assert.match(dialog, /No clinic destination is configured/)
    assert.match(dialog, /Copying it is the only fallback/)
    assert.match(dialog, /isDemoReview \? "Done"/)
    assert.match(
        dialog,
        /if \(isDemoReview\)[\s\S]*onDismiss\?\.\(\)[\s\S]*return[\s\S]*onApproveMessage/
    )
    assert.doesNotMatch(verifyApi, /insuranceProvider = "Nationwide"/)
    assert.match(
        insuranceProviderRuntime,
        /RUNTIME_MODES\.DEMO[\s\S]*return "Pet insurance"/
    )
    assert.match(
        postVerifyActionsHook,
        /actionKey === "librela" && onReconciled[\s\S]*await onReconciled\(\)/
    )
})
