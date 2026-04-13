import express from "express"
import { sbAdmin } from "../supabase.js"

const router = express.Router()

// List documents for left panel
router.get("/pets/:petId/documents", async (req, res) => {
    const { petId } = req.params
    const { status = "all", limit = "50" } = req.query

    let q = sbAdmin
        .from("documents")
        .select("id, doc_type, title, doc_date, source_org, status, created_at,     file_url, remarks, raw_text, text_extracted")
        .eq("pet_id", petId)
        .order("doc_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(Number(limit))

    if (status !== "all") q = q.eq("status", status)

    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })

    // Add lightweight booleans + counts for UI (simple approach; optimize later)
    const docIds = data.map(d => d.id)
    const counts = { events: {}, labs: {}, cost_items: {} }

    async function countBy(table, key) {
        const { data: rows, error: err } = await sbAdmin
            .from(table)
            .select("doc_id", { count: "exact", head: false })
            .in("doc_id", docIds)

        // Supabase JS count doesn’t group; easiest is a second query per doc later.
        // For MVP: return 0 and show counts only on detail view.
        return err ? {} : {}
    }

    const list = data.map(d => ({
        id: d.id,
        doc_type: d.doc_type,
        title: d.title,
        doc_date: d.doc_date,
        source_org: d.source_org,
        status: d.status,
        created_at: d.created_at,
        file_url: d.file_url,
        remarks: d.remarks,
        has_raw_text: !!(d.raw_text && d.raw_text.length > 0),
        has_jsonb: !!(d.text_extracted && Object.keys(d.text_extracted).length > 0),
    }))

    res.json({ documents: list })
})

// Get doc detail (right panel)
router.get("/documents/:docId", async (req, res) => {
    const { docId } = req.params

    const { data: doc, error } = await sbAdmin
        .from("documents")
        .select("id, pet_id, doc_type, title, doc_date, source_org, status, file_url,   raw_text, text_extracted, remarks")
        .eq("id", docId)
        .single()

    if (error) return res.status(404).json({ error: error.message })

    // counts for “materialized outputs”
    const [events, labs, costItems] = await Promise.all([
        sbAdmin.from("events").select("id", { count: "exact", head: true }).eq("doc_id",    docId),
        sbAdmin.from("labs").select("id", { count: "exact", head: true }).eq("doc_id",  docId),
        sbAdmin.from("cost_items").select("id", { count: "exact", head: true }).eq  ("doc_id", docId),
    ])

    res.json({
        doc,
        counts: {
            events: events.count ?? 0,
            labs: labs.count ?? 0,
            cost_items: costItems.count ?? 0,
        },
    })
})

// Signed URL for PDF preview (middle panel)
router.get("/documents/:docId/view-url", async (req, res) => {
    const { docId } = req.params

    const { data: doc, error } = await sbAdmin
        .from("documents")
        .select("file_url")
        .eq("id", docId)
        .single()

    if (error || !doc?.file_url) return res.status(404).json({ error: "Missing    file_url" })

    // file_url stores stable storage key, ex: `${pet_id}/2025-04-16/receipt.pdf`
    const { data, error: signErr } = await sbAdmin
        .storage
        .from("tomo-docs")
        .createSignedUrl(doc.file_url, 60 * 10)

    if (signErr) return res.status(500).json({ error: signErr.message })
    res.json({ url: data.signedUrl })
})

// Approve + auto-materialize (Phase 0.5 PoC)
// - documents.status: ingested -> verified
// - materialized rows: status = "verified" (simple PoC)
// - normalize Librela subtype during event materialization (aligns with reminder/calendar flow)
// - keep calendar sync as a separate explicit action (not triggered here)

router.post("/documents/:docId/approve", async (req, res) => {
    const { docId } = req.params
    const { verifiedBy = "rosa", notes = "" } = req.body || {}

    try {
        // 1) Load doc + extracted JSON
        const { data: doc, error } = await sbAdmin
            .from("documents")
            .select("id, pet_id, doc_type, doc_date, source_org, title, status,     text_extracted")
            .eq("id", docId)
            .single()

        if (error || !doc) return res.status(404).json({ error: error?.message || "Document not found" })

        const extracted = doc.text_extracted
        if (!extracted || typeof extracted !== "object" || Object.keys(extracted).length === 0) {
            return res.status(400).json({ error: "No text_extracted found for this    document." })
        }

        const petId = doc.pet_id
        const nowIso = new Date().toISOString()

        // 2) Mark doc verified (doc-level gate)
        const { error: upErr } = await sbAdmin
            .from("documents")
            .update({ status: "verified", remarks: notes })
            .eq("id", docId)

        if (upErr) return res.status(500).json({ error: upErr.message })

        // 3) Materialize outputs (MVP: delete then insert for this doc_id)
        // Keeps iteration idempotent and avoids duplicate rows during PoC.
        const [delEv, delCi, delLabs] = await Promise.all([
            sbAdmin.from("events").delete().eq("doc_id", docId),
            sbAdmin.from("cost_items").delete().eq("doc_id", docId),
            sbAdmin.from("labs").delete().eq("doc_id", docId),
        ])

        if (delEv.error) return res.status(500).json({ error: delEv.error.message })
        if (delCi.error) return res.status(500).json({ error: delCi.error.message })
        if (delLabs.error) return res.status(500).json({ error: delLabs.error.message })

        // Helper: normalize known subtype patterns from extractor
        const normalizeEventDetails = (eventType, details = {}) => {
            const out = (details && typeof details === "object") ? { ...details } : {}
            const desc = String(out.description || "").toLowerCase()

            // Align to your downstream reminder/calendar flows:
            // set details_json.subtype = "Librela" for Librela injection events.
            if (eventType === "injection" && desc.includes("librela")) {
                out.subtype = "Librela"
            }

            // Store verification trace in details_json for events (since events table has no verified_at/by columns)
            out.verified_at = nowIso
            out.verified_by = verifiedBy

            return out
        }

        // 4) Build insert payloads
        const eventsToInsert = Array.isArray(extracted.events)
        ? extracted.events
            .filter((e) => e && typeof e === "object" && e.event_type && e.event_date)
            .map((e) => ({
                pet_id: petId,
                doc_id: docId,
                event_type: e.event_type,
                event_date: e.event_date,
                status: "verified",
                details_json: normalizeEventDetails(e.event_type, e.details_json),
            }))
        : []

        const costItemsToInsert = Array.isArray(extracted.cost_items)
        ? extracted.cost_items
            .filter((ci) => ci && typeof ci === "object" && (ci.label || ci.amount != null))
            .map((ci) => ({
                pet_id: petId,
                doc_id: docId,
                service_date: ci.service_date || extracted.doc_date || doc.doc_date,
                category: ci.category || "other",
                item_name: ci.label || "Unknown item",
                quantity: null,
                unit: null,
                amount: ci.amount ?? 0,
                currency: ci.currency || "USD",
                tax_amount: 0,
                status: "verified",
                confidence: extracted.confidence ?? null,
                verified_at: nowIso,
                verified_by: verifiedBy,
            }))
        : []

        // Labs scaffold: your current receipt example has labs: []
        // When you start materializing labs, you'll flatten panels/results into rows in `labs`.
        const labsToInsert = [] // keep PoC simple for now

        // 5) Insert rows
        if (eventsToInsert.length) {
            const { error: evErr } = await sbAdmin.from("events").insert(eventsToInsert)
            if (evErr) return res.status(500).json({ error: evErr.message })
        }

        if (costItemsToInsert.length) {
            const { error: ciErr } = await sbAdmin.from("cost_items").insert(costItemsToInsert)
            if (ciErr) return res.status(500).json({ error: ciErr.message })
        }

        if (labsToInsert.length) {
            const { error: labErr } = await sbAdmin.from("labs").insert(labsToInsert)
            if (labErr) return res.status(500).json({ error: labErr.message })
        }

        // 6) Return updated counts
        const [eventsCount, costCount, labsCount] = await Promise.all([
            sbAdmin.from("events").select("id", { count: "exact", head: true }).eq("doc_id", docId),
            sbAdmin.from("cost_items").select("id", { count: "exact", head: true }).eq("doc_id", docId),
            sbAdmin.from("labs").select("id", { count: "exact", head: true }).eq("doc_id", docId),
        ])

        res.json({
            ok: true,
            status: "verified",
            materialized: {
                events: eventsCount.count ?? 0,
                cost_items: costCount.count ?? 0,
                labs: labsCount.count ?? 0,
            },
        })
    } catch (err) {
        res.status(500).json({ error: err?.message || "Unexpected error" })
    }
})

export default router