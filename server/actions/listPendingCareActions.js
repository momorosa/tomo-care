export async function listPendingCareActions({ repository, petId }) {
    assertRepository(repository)
    assertRequiredString(petId, "petId")

    const actions = await repository.findPendingActionsByPetId(petId)

    return {
        count: actions.length,
        actions,
    }
}

function assertRepository(repository) {
    if (typeof repository?.findPendingActionsByPetId !== "function") {
        throw new Error("repository.findPendingActionsByPetId is required.")
    }
}

function assertRequiredString(value, label) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${label} is required.`)
    }
}
