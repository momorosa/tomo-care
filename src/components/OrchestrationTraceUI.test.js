import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const componentUrl = new URL("./OrchestrationTrace.jsx", import.meta.url)
const assistantUrl = new URL(
    "../pages/Dashboard/AssistantPanel.jsx",
    import.meta.url
)
const verifyDocsUrl = new URL(
    "../pages/VerifyDocs/VerifyDocs.jsx",
    import.meta.url
)
const workingPanelUrl = new URL(
    "../pages/VerifyDocs/WorkingPanel.jsx",
    import.meta.url
)
const triageHookUrl = new URL(
    "../pages/VerifyDocs/hooks/useTriage.js",
    import.meta.url
)
const triageApiUrl = new URL("../pages/VerifyDocs/api.js", import.meta.url)

test("uses one collapsed orchestration trace component with a human-control boundary", async () => {
    const source = await readFile(componentUrl, "utf8")

    assert.match(source, /<details/)
    assert.match(source, /How Tomo handled this/)
    assert.match(source, /Human control/)
    assert.match(source, /getOrchestrationTracePresentation\(trace\)/)
})

test("shows the actual manager route as an accessible visual sequence", async () => {
    const source = await readFile(componentUrl, "utf8")

    assert.match(source, /aria-label="Route used for this response"/)
    assert.match(source, /kind="manager"/)
    assert.match(source, /kind="specialist"/)
    assert.match(source, /label="Bounded evidence"/)
    assert.match(source, /label="Result"/)
    assert.match(source, /<RouteConnector label="selected" \/>/)
    assert.match(source, /<RouteConnector label="returned" \/>/)
})

test("renders the same trace in Chat and Voice through their shared assistant turn", async () => {
    const source = await readFile(assistantUrl, "utf8")

    assert.match(
        source,
        /<OrchestrationTrace trace=\{answer\.orchestration_trace\} \/>/
    )
    assert.match(source, /function VoiceTranscriptSheet/)
    assert.match(source, /function SessionTranscript/)

    const assistantTurnUses = source.match(/<AssistantTurn/g) || []
    assert.equal(assistantTurnUses.length, 2)
})

test("carries successful and failed Verification Intelligence traces into VerifyDocs", async () => {
    const [verifyDocs, workingPanel, triageHook, triageApi] =
        await Promise.all([
            readFile(verifyDocsUrl, "utf8"),
            readFile(workingPanelUrl, "utf8"),
            readFile(triageHookUrl, "utf8"),
            readFile(triageApiUrl, "utf8"),
        ])

    assert.match(
        verifyDocs,
        /orchestrationTrace=\{triage\.orchestrationTrace\}/
    )
    assert.match(
        workingPanel,
        /<OrchestrationTrace trace=\{orchestrationTrace\} \/>/
    )
    assert.match(
        triageHook,
        /setOrchestrationTrace\(j\.orchestration_trace \|\| null\)/
    )
    assert.match(
        triageHook,
        /setOrchestrationTrace\(e\.orchestrationTrace \|\| null\)/
    )
    assert.match(
        triageApi,
        /error\.orchestrationTrace = j\.orchestration_trace \|\| null/
    )
})

test("keeps sensitive trace fields outside the rendering component", async () => {
    const source = await readFile(componentUrl, "utf8")

    for (const sensitiveField of [
        "run_id",
        "evidence.ids",
        "human_control_boundary",
        "prompt",
        "reasoning",
    ]) {
        assert.doesNotMatch(source, new RegExp(sensitiveField.replace(".", "\\.")))
    }
})
