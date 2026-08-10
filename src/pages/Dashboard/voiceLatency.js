function roundedDuration(startedAt, endedAt) {
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return null
    return Math.max(0, Math.round(endedAt - startedAt))
}

function numericTimings(timings = {}) {
    return Object.fromEntries(
        Object.entries(timings).filter(([, value]) => Number.isFinite(value))
    )
}

export function createVoiceLatencySummary({
    serverTimings,
    requestStartedAt,
    responseReceivedAt,
}) {
    const timings = numericTimings(serverTimings)
    const voiceRoundTripMs = roundedDuration(
        requestStartedAt,
        responseReceivedAt
    )
    const serverTotalMs = timings.server_total_ms

    return {
        ...timings,
        ...(voiceRoundTripMs == null
            ? {}
            : { voice_round_trip_ms: voiceRoundTripMs }),
        ...(voiceRoundTripMs == null || !Number.isFinite(serverTotalMs)
            ? {}
            : {
                  network_and_serialization_ms: Math.max(
                      0,
                      voiceRoundTripMs - serverTotalMs
                  ),
              }),
    }
}

export function mergeAvatarLatency(voiceTimings, avatarTimings) {
    return {
        ...numericTimings(voiceTimings),
        ...numericTimings(avatarTimings),
    }
}

export function reportVoiceLatency(timings, logger = console.info) {
    logger("[Tomo latency]", numericTimings(timings))
}

