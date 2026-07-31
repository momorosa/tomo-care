export const TOMO_TRANSCRIPTION_KEYWORDS = Object.freeze([
    "Momo",
    "Tomo",
    "Librela",
    "Simparica Trio",
    "Adequan",
    "SoMa Animal Hospital",
])

export const TOMO_TRANSCRIPTION_PROMPT =
    "An English question about Momo’s pet care. Preserve the speaker’s wording and use the expected names Momo, Tomo, Librela, Simparica Trio, Adequan, and SoMa Animal Hospital."

const FUZZY_MEDICATION_TERMS = Object.freeze([
    "Librela",
    "Simparica",
    "Adequan",
])

function editDistance(left, right) {
    const previous = Array.from(
        { length: right.length + 1 },
        (_, index) => index
    )

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex]

        for (
            let rightIndex = 1;
            rightIndex <= right.length;
            rightIndex += 1
        ) {
            const substitutionCost =
                left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
            current[rightIndex] = Math.min(
                current[rightIndex - 1] + 1,
                previous[rightIndex] + 1,
                previous[rightIndex - 1] + substitutionCost
            )
        }

        previous.splice(0, previous.length, ...current)
    }

    return previous[right.length]
}

function findMedicationNearMatch(token) {
    const normalizedToken = token.toLowerCase()

    return FUZZY_MEDICATION_TERMS.find((term) => {
        const normalizedTerm = term.toLowerCase()

        if (normalizedToken === normalizedTerm) return false
        if (normalizedToken.slice(0, 2) !== normalizedTerm.slice(0, 2)) {
            return false
        }
        if (Math.abs(normalizedToken.length - normalizedTerm.length) > 1) {
            return false
        }

        return editDistance(normalizedToken, normalizedTerm) === 1
    })
}

export function interpretCareTranscript(transcript) {
    const original = transcript?.trim() || ""
    const corrections = []
    const seenCorrections = new Set()
    const interpreted = original.replace(/\p{L}+/gu, (token) => {
        const canonicalTerm = findMedicationNearMatch(token)

        if (!canonicalTerm) return token

        const correctionKey =
            `${token.toLowerCase()}:${canonicalTerm.toLowerCase()}`

        if (!seenCorrections.has(correctionKey)) {
            seenCorrections.add(correctionKey)
            corrections.push({
                heard: token,
                interpreted_as: canonicalTerm,
            })
        }

        return canonicalTerm
    })

    return {
        original,
        interpreted,
        corrections,
    }
}
