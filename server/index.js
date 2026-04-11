import express from "express"
import cors from "cors"
import documentsRoutes from "./routes/documents.js"
import "dotenv/config"

const app = express()
app.use(cors())
app.use(express.json())

app.use("/api", documentsRoutes)

app.listen(3001, () => console.log("API running on http://localhost:3001"))