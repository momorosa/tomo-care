import express from "express"
import { sbAdmin } from "../supabase.js"
import {
    summarizePetProfile,
    summarizeVerifiedCareEvents,
} from "../dashboard/careSummary.js"

const router = express.Router()

router.get("/pets/:petId/care-summary", async (req, res) => {
    const { petId } = req.params

    try {
        const [eventsResult, petResult] = await Promise.all([
            sbAdmin
                .from("events")
                .select("id, event_type, event_date, status, details_json")
                .eq("pet_id", petId)
                .eq("status", "verified")
                .order("event_date", { ascending: false }),
            sbAdmin
                .from("pets")
                .select("name, breed, sex, spayed_neutered, birth_date")
                .eq("id", petId)
                .single(),
        ])

        if (eventsResult.error) throw eventsResult.error
        if (petResult.error) throw petResult.error

        return res.json({
            ok: true,
            summary: {
                ...summarizeVerifiedCareEvents(eventsResult.data || []),
                pet_profile: summarizePetProfile(petResult.data),
            },
        })
    } catch (error) {
        console.error("[care-summary] error:", error)

        return res.status(500).json({
            ok: false,
            error: "Failed to load Momo’s verified care summary.",
        })
    }
})

export default router
