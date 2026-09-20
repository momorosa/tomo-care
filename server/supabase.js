import { createSupabaseReadFetch } from "./database/readFetch.js"
import { createClient } from "@supabase/supabase-js"
import "dotenv/config"
import { getSupabaseServerConfig } from "./config/supabaseConfig.js"

const { url, secretKey } = getSupabaseServerConfig()

export const sbAdmin = createClient(url, secretKey, {
    global: {
        fetch: createSupabaseReadFetch({
            baseUrl: url,
            onRetry: ({ code }) => console.warn(`[database] ${code}`),
        }),
    },
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
})
