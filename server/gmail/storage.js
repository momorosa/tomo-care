import { sbAdmin } from "../supabase.js"
export {
    buildGmailStorageKey,
    getDateFromIso,
    sanitizeFilename,
} from "./storageKey.js"

const BUCKET = "tomo-docs";

export async function uploadPdfToTomoDocs({
    storageKey,
    buffer,
    upsert = false,
}) {
    if (!storageKey) throw new Error("storageKey is required.")
    if (!buffer) throw new Error("buffer is required.")

    const { data, error } = await sbAdmin.storage
        .from(BUCKET)
        .upload(storageKey, buffer, {
            contentType: "application/pdf",
            upsert,
        })

    if (error) {
        throw error;
    }

    return {
        bucket: BUCKET,
        storageKey,
        path: data?.path ?? storageKey,
    }
}
