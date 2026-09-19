// Visual timing only: this controller never holds audio or provider resources.
export const AVATAR_HANDOFF_MS = Object.freeze({
    SETTLE: 360,
    DEPART: 160,
    ARRIVE: 240,
    READY_WAIT: 640,
    READY_POLL: 40,
})

export function createAvatarVisualHandoff({
    captureOutgoing,
    isReady = () => true,
    onChange,
    schedule = setTimeout,
    cancel = clearTimeout,
}) {
    let state = { displayLive: false, phase: "steady" }
    let desiredLive = false
    let timer = null
    let generation = 0
    let pending = false

    function publish(next) {
        state = next
        onChange(next)
    }
    function clear() {
        generation += 1
        cancel(timer)
        timer = null
        pending = false
    }
    function later(callback, delay) {
        const version = generation
        timer = schedule(() => {
            if (version !== generation) return
            timer = null
            callback()
        }, delay)
    }
    function finish() {
        pending = false
        publish({ ...state, phase: "steady" })
    }

    return {
        getState: () => state,
        request(targetLive, { settleMs = 0, urgent = false, immediate = false } = {}) {
            if (!immediate && desiredLive === targetLive && pending && (!urgent || state.phase !== "steady")) return
            if (!immediate && !pending && state.displayLive === targetLive) return
            clear()
            desiredLive = targetLive
            if (immediate) {
                publish({ displayLive: targetLive, phase: "steady" })
                return
            }
            // A new answer can cancel a pending return without briefly showing local media.
            if (state.displayLive === targetLive) {
                finish()
                return
            }
            pending = true
            function begin() {
                const captured = captureOutgoing(state.displayLive)
                if (captured) publish({ ...state, phase: "departing" })
                function commit(waited = 0) {
                    if (!isReady(targetLive) && waited < AVATAR_HANDOFF_MS.READY_WAIT) {
                        later(() => commit(waited + AVATAR_HANDOFF_MS.READY_POLL), AVATAR_HANDOFF_MS.READY_POLL)
                        return
                    }
                    // Readiness can be revoked by disconnect. Never reveal a dead live frame.
                    if (targetLive && !isReady(true)) {
                        desiredLive = state.displayLive
                        finish()
                        return
                    }
                    publish({ displayLive: targetLive, phase: captured ? "arriving" : "steady" })
                    if (captured) later(finish, AVATAR_HANDOFF_MS.ARRIVE)
                    else pending = false
                }
                if (captured) later(commit, AVATAR_HANDOFF_MS.DEPART)
                else commit()
            }
            if (settleMs > 0) later(begin, settleMs)
            else begin()
        },
        dispose() {
            clear()
            desiredLive = false
            state = { displayLive: false, phase: "steady" }
        },
    }
}

export function captureAvatarFrame(canvas, media) {
    const width = media?.videoWidth || media?.naturalWidth || 0
    const height = media?.videoHeight || media?.naturalHeight || 0
    if (!canvas || !width || !height) return false
    try {
        const scale = Math.min(1, 1280 / Math.max(width, height))
        canvas.width = Math.round(width * scale)
        canvas.height = Math.round(height * scale)
        const context = canvas.getContext("2d")
        if (!context) return false
        context.drawImage(media, 0, 0, canvas.width, canvas.height)
        return true
    } catch {
        // An unavailable/undecodable frame must not interfere with voice or cleanup.
        return false
    }
}
