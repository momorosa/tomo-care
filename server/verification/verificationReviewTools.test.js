import assert from "node:assert/strict"
import process from "node:process"
import test from "node:test"

import {
    runSourceReview,
    SOURCE_REVIEW_TIMEOUT_MS,
} from "./verificationReviewTools.js"

const DOCUMENT = {
    doc_type: "receipt",
    doc_date: "2026-08-16",
    source_org: "Fictional Cedar Veterinary Center",
}

const EXTRACTED = {
    invoice_id: "SYNTHETIC-1",
    doc_date: "2026-08-16",
    source_org: "Fictional Cedar Veterinary Center",
    cost_items: [],
}

test("keeps the source-review deadline inside the specialist deadline", () => {
    assert.equal(SOURCE_REVIEW_TIMEOUT_MS, 45000)
})

test("turns a slow source comparison into persisted manual-review input", async () => {
    const previousApiKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = "synthetic-test-key"

    try {
        const review = await runSourceReview({
            rawText:
                "Synthetic veterinary receipt source long enough for timeout recovery testing.",
            extracted: EXTRACTED,
            document: DOCUMENT,
            timeoutMs: 5,
            fetchImpl: async (_url, { signal }) =>
                new Promise((_, reject) => {
                    signal.addEventListener(
                        "abort",
                        () => {
                            const error = new Error("aborted")
                            error.name = "AbortError"
                            reject(error)
                        },
                        { once: true }
                    )
                }),
        })

        assert.equal(review.failed, true)
        assert.equal(review.failure.reason, "timeout")
        assert.equal(review.failure.retryable, true)
        assert.equal(Number.isFinite(review.failure.elapsed_ms), true)
        assert.equal(review.fields.length > 0, true)
        assert.equal(
            review.fields.every((field) => field.state === "uncertain"),
            true
        )
    } finally {
        if (previousApiKey == null) {
            delete process.env.ANTHROPIC_API_KEY
        } else {
            process.env.ANTHROPIC_API_KEY = previousApiKey
        }
    }
})
