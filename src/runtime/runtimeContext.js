const RUNTIME_MODES = new Set(["real", "demo"])

export function validatePublicRuntimeContext(value) {
    if (
        !value ||
        !RUNTIME_MODES.has(value.mode) ||
        typeof value.label !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value.care_date || "")
    ) {
        throw new Error("TomoCare could not confirm its data environment.")
    }

    if (
        value.mode === "demo" &&
        (value.label !== "Demo data" ||
            value.data_notice !== "Fictional data only.")
    ) {
        throw new Error("TomoCare received an invalid demo environment label.")
    }

    return Object.freeze({
        mode: value.mode,
        label: value.label,
        dataNotice: value.data_notice || null,
        careDate: value.care_date,
    })
}

export async function fetchRuntimeContext(fetchImpl = fetch) {
    const response = await fetchImpl("/api/runtime-context", {
        headers: { Accept: "application/json" },
        cache: "no-store",
    })
    const payload = await response.json()

    if (!response.ok || payload?.ok !== true) {
        throw new Error("TomoCare could not confirm its data environment.")
    }

    return validatePublicRuntimeContext(payload.runtime)
}
