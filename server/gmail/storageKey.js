import path from "node:path"

export function sanitizeFilename(filename) {
    return filename.replace(/[^\w.\-() ]+/g, "_")
}

export function getDateFromIso(isoString) {
    if (!isoString) {
        return new Date().toISOString().slice(0, 10)
    }

    return isoString.slice(0, 10)
}

export function buildGmailStorageKey({
    petId,
    receivedAt,
    filename,
    contentSha256,
}) {
    if (!petId) throw new Error("petId is required.")
    if (!filename) throw new Error("filename is required.")
    if (!contentSha256) throw new Error("contentSha256 is required.")

    const date = getDateFromIso(receivedAt)
    const safeFilename = sanitizeFilename(filename)
    const hashPrefix = contentSha256.slice(0, 12)

    return path.posix.join(
        petId,
        date,
        `${hashPrefix}-${safeFilename}`
    )
}
