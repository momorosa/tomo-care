import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const appUrl = new URL("../App.jsx", import.meta.url)
const gateUrl = new URL("./RuntimeGate.jsx", import.meta.url)
const headerUrl = new URL("../components/Header.jsx", import.meta.url)
const indexUrl = new URL("../../index.html", import.meta.url)
const sidebarUrl = new URL("../pages/Dashboard/CareSidebar.jsx", import.meta.url)

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
    assert.doesNotMatch(header, /dismiss|close|onClick|localStorage/)
})

test("keeps real-care clinic and insurance labels out of demo Profile", async () => {
    const sidebar = await readFile(sidebarUrl, "utf8")

    assert.match(sidebar, /useRuntimeContext\(\)/)
    assert.match(
        sidebar,
        /runtime\.mode === "real"[\s\S]*Primary clinic[\s\S]*SoMa AH[\s\S]*Insurance[\s\S]*Nationwide/
    )
})
