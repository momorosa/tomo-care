import process from "node:process"

export function getSupabaseServerConfig(env = process.env) {
    const url = env.SUPABASE_URL?.trim()
    const secretKey =
        env.SUPABASE_SECRET_KEY?.trim() ||
        env.SUPABASE_SERVICE_ROLE_KEY?.trim()

    if (!url) throw new Error("SUPABASE_URL is required.")
    if (!secretKey) {
        throw new Error(
            "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required."
        )
    }

    return Object.freeze({ url, secretKey })
}
