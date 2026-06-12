import express from "express"
import cors from "cors"
import documentsRoutes from "./routes/documents.js"
import "dotenv/config"
import triageRoutes from "./routes/triage.js"
import gmailRoutes from "./routes/gmail.js"


const app = express()
app.use(cors())
app.use(express.json())

app.use("/api", documentsRoutes)
app.use("/api", triageRoutes)
app.use("/api", gmailRoutes);

app.listen(3001, () => console.log("API running on http://localhost:3001"))