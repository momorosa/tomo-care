import express from "express"
import cors from "cors"
import documentsRoutes from "./routes/documents.js"
import "dotenv/config"
import triageRoutes from "./routes/triage.js"
import gmailRoutes from "./routes/gmail.js"
import actionsRoutes from "./routes/actions.js"
import careActionsRoutes from "./routes/careActions.js"
import assistantRoutes from "./routes/assistant.js"
import dashboardRoutes from "./routes/dashboard.js"


const app = express()
app.use(cors())
app.use(express.json())

app.use("/api", documentsRoutes)
app.use("/api", triageRoutes)
app.use("/api", gmailRoutes)
app.use("/api", actionsRoutes)
app.use("/api", careActionsRoutes)
app.use("/api", assistantRoutes)
app.use("/api", dashboardRoutes)

app.listen(3001, () => console.log("API running on http://localhost:3001"))
