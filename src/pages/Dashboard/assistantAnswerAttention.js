export function buildFreshAssistantAnswer(currentAnswer, question, result) {
    const currentRevision = Number.isSafeInteger(
        currentAnswer?.attention_revision
    )
        ? currentAnswer.attention_revision
        : 0

    return {
        question,
        ...result,
        attention_revision: currentRevision + 1,
    }
}