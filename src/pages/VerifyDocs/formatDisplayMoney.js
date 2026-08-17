export function formatDisplayMoney(value, currency = "") {
    if (value == null || value === "") return "—"

    const numericValue = Number(value)
    const amount = Number.isFinite(numericValue)
        ? numericValue.toFixed(2)
        : String(value)

    return `${amount} ${currency || ""}`.trim()
}
