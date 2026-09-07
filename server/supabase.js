import { createClient } from "@supabase/supabase-js"
import "dotenv/config"
import { getSupabaseServerConfig } from "./config/supabaseConfig.js"

const { url, secretKey } = getSupabaseServerConfig()

export const sbAdmin = createClient(url, secretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
})
