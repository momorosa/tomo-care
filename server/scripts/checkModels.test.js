import test from "node:test"
import assert from "node:assert/strict"
import { checkModels, configuredModels } from "./checkModels.js"

test("reports runtime overrides without requesting inference or exposing credentials", async () => {
    const requests = []
    const env = { OPENAI_API_KEY: "secret-openai", GEMINI_API_KEY: "secret-google", TOMO_SEMANTIC_MODEL: "candidate", TOMO_TTS_VOICE: "marin" }
    const report = await checkModels({ env, now: new Date("2026-09-19"), fetchImpl: async (url, options) => {
        requests.push({ url, options })
        const model = decodeURIComponent(url.split("/").at(-1))
        return { ok: true, json: async () => url.includes("googleapis") ? { name: `models/${model}`, supportedGenerationMethods: ["generateContent"] } : { id: model } }
    } })
    assert.equal(report.ok, true)
    assert.equal(report.checks[0].model, "candidate")
    assert.equal(report.warnings.some(w => w.includes("override")), true)
    assert.equal(requests.length, 4)
    assert.equal(requests.every(r => !r.options.body && !r.url.includes("secret")), true)
    assert.equal(JSON.stringify(report).includes("secret"), false)
})

test("unavailable models and expired lifecycle reviews do not report all clear", async () => {
    const report = await checkModels({ env: { OPENAI_API_KEY: "secret", GOOGLE_API_KEY: "secret" }, now: new Date("2026-11-01"), fetchImpl: async () => ({ ok: false, status: 404 }) })
    assert.equal(report.ok, false)
    assert.equal(report.checks.every(c => c.status === "FAIL"), true)
    assert.equal(report.warnings.some(w => w.includes("30 days")), true)
})

test("offline inspection is explicit and never calls a provider", async () => {
    const report = await checkModels({ env: {}, offline: true, fetchImpl: () => { throw new Error("unexpected request") } })
    assert.equal(report.checks.every(c => c.status === "NOT CHECKED"), true)
    assert.equal(configuredModels({}).length, 4)
})
