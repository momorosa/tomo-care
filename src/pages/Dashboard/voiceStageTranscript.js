export const VOICE_STAGE_TURN_LIMIT = 4

export function getVoiceStageTurns(
    sessionTurns = [],
    limit = VOICE_STAGE_TURN_LIMIT
) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : VOICE_STAGE_TURN_LIMIT
    const visibleTurns = sessionTurns.slice(-safeLimit)

    return visibleTurns.map((turn, index) => ({
        ...turn,
        receding: index < Math.max(visibleTurns.length - 2, 0),
        latest: index === visibleTurns.length - 1,
    }))
}
