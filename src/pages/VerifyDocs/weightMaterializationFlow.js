export function buildWeightPreviewMessage(preview, formatDate = (value) => value) {
    const measurement = preview?.measurement
    if (!measurement) return "Review the weight measurement before saving it."

    const value = `${measurement.value} ${measurement.unit}`
    const date = formatDate(measurement.measured_date)
    const source = measurement.source_label || "the verified invoice"

    return `Save ${value} measured ${date} from ${source}. This will add one trusted weight fact and update Momo’s current weight only if this is her newest verified measurement. Events, costs, reminders, and Calendar stay unchanged.`
}
