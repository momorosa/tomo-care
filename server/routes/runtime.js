import express from "express"
import { toPublicRuntimeContext } from "../config/runtimeContext.js"

export function createRuntimeRoutes(runtimeContext) {
    const router = express.Router()

    router.get("/runtime-context", (_req, res) => {
        res.set("Cache-Control", "no-store")
        return res.json({
            ok: true,
            runtime: toPublicRuntimeContext(runtimeContext),
        })
    })

    return router
}
