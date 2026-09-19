import "dotenv/config"
import process from "node:process"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { DEFAULT_SEMANTIC_MODEL } from "../assistant/openAiSemanticProvider.js"
import { DEFAULT_STT_MODEL, DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE } from "../voice/openAiVoiceProvider.js"

export const MODEL_REVIEW_DATE = "2026-09-19"
const reviewed = new Set(["gpt-5.6-terra", "gpt-transcribe", "gpt-4o-mini-tts-2025-12-15", "gemini-3-flash-preview"])

export function configuredModels(env = process.env) {
    // Read Python's actual default without importing its credential/database dependencies.
    const extraction = readFileSync(new URL("../../agent/tomo/tools/extract.py", import.meta.url), "utf8")
    const geminiDefault = extraction.match(/MODEL = os.getenv\("TOMO_GEMINI_MODEL", "([^\"]+)"\)/)?.[1]
    if (!geminiDefault) throw new Error("Could not inspect the extraction model default.")
    return [
        { role: "Language understanding", provider: "openai", model: env.TOMO_SEMANTIC_MODEL || DEFAULT_SEMANTIC_MODEL },
        { role: "Transcription", provider: "openai", model: env.TOMO_STT_MODEL || DEFAULT_STT_MODEL },
        { role: "Speech", provider: "openai", model: env.TOMO_TTS_MODEL || DEFAULT_TTS_MODEL, voice: env.TOMO_TTS_VOICE || DEFAULT_TTS_VOICE },
        { role: "Document extraction", provider: "google", model: env.TOMO_GEMINI_MODEL || geminiDefault },
    ]
}

export async function checkModels({ env = process.env, fetchImpl = globalThis.fetch, offline = false, now = new Date() } = {}) {
    const ageDays = (now - new Date(MODEL_REVIEW_DATE)) / 86400000
    const warnings = []
    if (ageDays >= 30) warnings.push("The provider lifecycle review is over 30 days old. Refresh the official notices in docs/TomoCare_Model_Lifecycle.md.")
    const checks = await Promise.all(configuredModels(env).map(async entry => {
        if (!reviewed.has(entry.model)) warnings.push(`${entry.role}: this override needs a lifecycle and behavior review.`)
        if (entry.model.includes("preview")) warnings.push(`${entry.role}: preview model; check the provider lifecycle before each release.`)
        if (offline) return { ...entry, status: "NOT CHECKED", detail: "Configuration only; provider access was not checked." }
        const key = entry.provider === "openai" ? env.OPENAI_API_KEY : env.GOOGLE_API_KEY || env.GEMINI_API_KEY
        if (!key) return { ...entry, status: "FAIL", detail: "Provider credential is missing." }
        if (entry.provider === "google" && env.GOOGLE_GENAI_USE_VERTEXAI?.toLowerCase() === "true") {
            return { ...entry, status: "NOT CHECKED", detail: "Vertex configuration needs its own model access check." }
        }
        const url = entry.provider === "openai"
            ? `https://api.openai.com/v1/models/${encodeURIComponent(entry.model)}`
            : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(entry.model)}`
        try {
            const response = await fetchImpl(url, {
                headers: entry.provider === "openai" ? { Authorization: `Bearer ${key}` } : { "x-goog-api-key": key },
                signal: AbortSignal.timeout(10000),
            })
            // Never echo provider bodies: they can contain account or credential details.
            if (!response.ok) return { ...entry, status: "FAIL", detail: `Model access check returned HTTP ${response.status}; verify access or migrate before release.` }
            const data = await response.json()
            const matches = entry.provider === "openai" ? data.id === entry.model : data.name === `models/${entry.model}`
            const supportsGeneration = entry.provider !== "google" || data.supportedGenerationMethods?.includes("generateContent")
            return { ...entry, status: matches && supportsGeneration ? "PASS" : "FAIL", detail: matches && supportsGeneration
                ? "Model metadata is accessible. This does not test inference, voice quality, or future retirement."
                : "Provider metadata did not confirm the configured model and required operation." }
        } catch {
            return { ...entry, status: "FAIL", detail: "Model access check failed or timed out. No inference or care-record access was attempted." }
        }
    }))
    return { ok: checks.every(c => c.status === "PASS") || offline, reviewedAt: MODEL_REVIEW_DATE, warnings, checks }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const result = await checkModels({ offline: process.argv.includes("--offline") })
    console.log(`TomoCare model check — lifecycle review ${result.reviewedAt}`)
    for (const c of result.checks) console.log(`${c.status} ${c.role}: ${c.model}${c.voice ? ` / ${c.voice}` : ""}. ${c.detail}`)
    for (const warning of result.warnings) console.log(`REVIEW ${warning}`)
    console.log("Runway renders supplied audio; its model and SDK are covered in the lifecycle document. No model was changed.")
    process.exitCode = result.ok ? 0 : 1
}
