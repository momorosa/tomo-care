import test from "node:test"
import assert from "node:assert/strict"
import {
    fetchRuntimeContext,
    validatePublicRuntimeContext,
} from "./runtimeContext.js"

test("accepts the bounded public demo contract", () => {
    assert.deepEqual(
        validatePublicRuntimeContext({
            mode: "demo",
            label: "Demo data",
            data_notice: "Fictional data only.",
            care_date: "2026-09-03",
        }),
        {
            mode: "demo",
            label: "Demo data",
            dataNotice: "Fictional data only.",
            careDate: "2026-09-03",
        }
    )
})

test("rejects unknown modes and incomplete demo labels", () => {
    assert.throws(() =>
        validatePublicRuntimeContext({
            mode: "unknown",
            label: "TomoCare",
            care_date: "2026-09-03",
        })
    )
    assert.throws(() =>
        validatePublicRuntimeContext({
            mode: "demo",
            label: "Private care",
            care_date: "2026-09-03",
        })
    )
})

test("loads runtime context before the application requests care data", async () => {
    const calls = []
    const runtime = await fetchRuntimeContext(async (url, options) => {
        calls.push({ url, options })
        return {
            ok: true,
            async json() {
                return {
                    ok: true,
                    runtime: {
                        mode: "real",
                        label: "Private care",
                        data_notice: null,
                        care_date: "2026-09-03",
                    },
                }
            },
        }
    })

    assert.equal(runtime.mode, "real")
    assert.deepEqual(calls.map((call) => call.url), ["/api/runtime-context"])
    assert.equal(calls[0].options.cache, "no-store")
})
