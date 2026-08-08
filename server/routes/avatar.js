import express from "express"
import {
    AvatarConfigurationError,
    createLiveAvatarSession,
} from "../avatar/liveAvatarSession.js"

const router = express.Router()

router.post("/avatar/sessions", async (_req, res) => {
    try {
        const session = await createLiveAvatarSession()
        res.status(201).json(session)
    } catch (err) {
        if (err instanceof AvatarConfigurationError) {
            res.status(err.status).json({
                error: err.message,
                reason: err.reason,
            })
            return
        }

        console.error("[avatar] session creation failed:", {
            name: err?.name || "Error",
        })
        res.status(502).json({
            error: "Tomo’s live animation could not start right now.",
            reason: "avatar_session_failed",
        })
    }
})

export default router
