export const MAX_VISIBLE_VERIFIED_SOURCES = 10

function getCitationTimestamp(citation) {
    const value =
        citation?.display_date ||
        citation?.date ||
        citation?.source_date ||
        null

    if (!value) return Number.NEGATIVE_INFINITY

    const timestamp = Date.parse(String(value))
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}

export function getRecentVerifiedSources(
    citations = [],
    limit = MAX_VISIBLE_VERIFIED_SOURCES
) {
    if (!Array.isArray(citations) || limit <= 0) return []

    return citations
        .map((citation, index) => ({ citation, index }))
        .sort((a, b) => {
            const dateDifference =
                getCitationTimestamp(b.citation) -
                getCitationTimestamp(a.citation)

            return dateDifference || a.index - b.index
        })
        .slice(0, limit)
        .map(({ citation }) => citation)
}

export function getVerifiedSourcesLabel({ visibleCount, totalCount }) {
    const noun = visibleCount === 1 ? "source" : "sources"
    const recencyLabel = totalCount > visibleCount ? " recent" : ""

    return `View ${visibleCount}${recencyLabel} verified ${noun}`
}
