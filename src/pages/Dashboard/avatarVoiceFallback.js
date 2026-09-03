export const AVATAR_VOICE_PLAYBACK = Object.freeze({
    AVATAR: "avatar",
    LOCAL: "local",
    CANCELLED: "cancelled",
})

export async function playVoiceWithAvatarFallback({
    avatarReady,
    playAvatar,
    playLocal,
    isCurrent = () => true,
}) {
    if (avatarReady) {
        try {
            const result = await playAvatar()

            if (!isCurrent()) {
                return { mode: AVATAR_VOICE_PLAYBACK.CANCELLED, result: null }
            }

            if (result) {
                return { mode: AVATAR_VOICE_PLAYBACK.AVATAR, result }
            }
        } catch {
            if (!isCurrent()) {
                return { mode: AVATAR_VOICE_PLAYBACK.CANCELLED, result: null }
            }
        }
    }

    if (!isCurrent()) {
        return { mode: AVATAR_VOICE_PLAYBACK.CANCELLED, result: null }
    }

    await playLocal()
    return { mode: AVATAR_VOICE_PLAYBACK.LOCAL, result: null }
}
