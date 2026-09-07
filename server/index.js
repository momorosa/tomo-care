import express from "express"
import cors from "cors"
import "dotenv/config"
import { getServerRuntimeContext } from "./config/runtimeContext.js"
import { createRuntimeBoundaryMiddleware } from "./middleware/runtimeBoundary.js"
import { createRuntimeRoutes } from "./routes/runtime.js"

const runtimeContext = getServerRuntimeContext()
const [
    { default: documentsRoutes },
    { default: triageRoutes },
    { default: gmailRoutes },
    { default: actionsRoutes },
    { default: careActionsRoutes },
    { default: assistantRoutes },
    { default: voiceRoutes },
    { default: dashboardRoutes },
    { default: avatarRoutes },
] = await Promise.all([
    import("./routes/documents.js"),
    import("./routes/triage.js"),
    import("./routes/gmail.js"),
    import("./routes/actions.js"),
    import("./routes/careActions.js"),
    import("./routes/assistant.js"),
    import("./routes/voice.js"),
    import("./routes/dashboard.js"),
    import("./routes/avatar.js"),
])

const app = express()
app.use(cors())
app.use(express.json())
app.use(createRuntimeBoundaryMiddleware(runtimeContext))

app.use("/api", createRuntimeRoutes(runtimeContext))
app.use("/api", documentsRoutes)
app.use("/api", triageRoutes)
app.use("/api", gmailRoutes)
app.use("/api", actionsRoutes)
app.use("/api", careActionsRoutes)
app.use("/api", assistantRoutes)
app.use("/api", voiceRoutes)
app.use("/api", dashboardRoutes)
app.use("/api", avatarRoutes)

app.listen(3001, () =>
    console.log(
        `API running on http://localhost:3001 (${runtimeContext.mode} mode)`
    )
)
