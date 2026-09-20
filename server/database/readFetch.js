// Recover one known pre-query authentication rejection. Never replay a write,
// RPC, other service, ordinary authorization failure, or ambiguous network error.
export function createSupabaseReadFetch({ baseUrl, fetchImpl = globalThis.fetch, wait = abortableWait, onRetry = () => {} }) {
    const origin = new URL(baseUrl).origin
    return async (input, init) => {
        const request = input instanceof Request ? input : null
        const url = new URL(request?.url || input)
        const method = (init?.method || request?.method || "GET").toUpperCase()
        const signal = init?.signal || request?.signal
        const response = await fetchImpl(input, init)
        if (url.origin !== origin || !["GET", "HEAD"].includes(method) ||
            !url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/rest/v1/rpc/") ||
            response.status !== 401) return response

        let error
        try { error = await response.clone().json() } catch { return response }
        if (error?.code !== "PGRST303" || error?.message !== "JWT issued at future") return response

        onRetry({ code: "supabase_read_token_timing_retry" })
        await response.body?.cancel()
        await wait(1000, signal)
        signal?.throwIfAborted()
        return fetchImpl(input, init)
    }
}

function abortableWait(ms, signal) {
    signal?.throwIfAborted()
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer)
            reject(signal.reason)
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort)
            resolve()
        }, ms)
        signal?.addEventListener("abort", onAbort, { once: true })
    })
}
