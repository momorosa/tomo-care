import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

const workingPanelUrl = new URL("./WorkingPanel.jsx", import.meta.url)
const verifyDocsUrl = new URL("./VerifyDocs.jsx", import.meta.url)
const editorUrl = new URL("./hooks/useDraftEditor.js", import.meta.url)

test("exposes Clinic as editable candidate truth and wires the correction", async () => {
    const [workingPanel, verifyDocs, editor] = await Promise.all([
        readFile(workingPanelUrl, "utf8"),
        readFile(verifyDocsUrl, "utf8"),
        readFile(editorUrl, "utf8"),
    ])

    assert.match(workingPanel, /label="Clinic"[\s\S]*onUpdateSourceOrg/)
    assert.match(workingPanel, /placeholder="e\.g\., SoMa Animal Hospital"/)
    assert.match(workingPanel, /f\.path === "source_org"/)
    assert.match(workingPanel, />\s*Correct\s*</)
    assert.match(workingPanel, /focusOnMount=\{editTargetPath === "source_org"\}/)
    assert.match(verifyDocs, /onUpdateSourceOrg=\{draft\.onUpdateSourceOrg\}/)
    assert.match(editor, /function onUpdateSourceOrg\(value\)/)
})
