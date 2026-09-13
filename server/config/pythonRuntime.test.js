import test from "node:test"
import assert from "node:assert/strict"
import { resolvePythonBin } from "./pythonRuntime.js"

test("uses the project Python environment when the shell has no activated environment", () => {
    const python = resolvePythonBin({ env: {}, projectRoot: "/repo", platform: "darwin", exists: () => true })
    assert.equal(python, "/repo/agent/.venv/bin/python")
})

test("honors an explicit Python choice and falls back when there is no project environment", () => {
    assert.equal(resolvePythonBin({ env: { PYTHON_BIN: "/custom/python" }, exists: () => true }), "/custom/python")
    assert.equal(resolvePythonBin({ env: {}, platform: "darwin", exists: () => false }), "python3")
})
