export function transcriptBounds(width) {
    if (!Number.isFinite(width) || width < 600) return { min: 0.5, max: 0.5 }
    return { min: Math.max(0.25, 320 / width), max: Math.min(0.75, 1 - 280 / width) }
}

export function clampTranscriptRatio(ratio, width) {
    const { min, max } = transcriptBounds(width)
    return Math.max(min, Math.min(max, Number.isFinite(ratio) ? ratio : 0.5))
}

export function transcriptRatioFromPointer(clientX, left, width) {
    return clampTranscriptRatio(1 - (clientX - left) / width, width)
}

export function transcriptRatioFromKey(key, ratio, width, shift = false) {
    const step = shift ? 0.1 : 0.02
    const { min, max } = transcriptBounds(width)
    const values = { ArrowLeft: ratio + step, ArrowRight: ratio - step, Home: min, End: max, Enter: 0.5 }
    return Object.hasOwn(values, key) ? clampTranscriptRatio(values[key], width) : null
}
