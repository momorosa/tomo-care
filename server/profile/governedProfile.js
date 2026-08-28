const PROFILE_FIELD_KEYS = Object.freeze([
    "id",
    "name",
    "species",
    "breed",
    "birth_date",
    "age",
    "sex",
    "reproductive_status",
    "microchip_id",
])

const OPTIONAL_PROFILE_FIELD_KEYS = Object.freeze([
    "breed",
    "birth_date",
    "age",
    "sex",
    "reproductive_status",
    "microchip_id",
])

export function calculateProfileAge(birthDate, currentCareDate) {
    const birth = parseIsoDate(birthDate)
    const current = parseIsoDate(currentCareDate)

    if (!birth || !current || birthDate > currentCareDate) return null

    let age = current.year - birth.year
    if (
        current.month < birth.month ||
        (current.month === birth.month && current.day < birth.day)
    ) {
        age -= 1
    }

    return age >= 0 ? age : null
}

export function deriveReproductiveStatus(spayedNeutered, sex) {
    if (typeof spayedNeutered !== "boolean") return null
    if (spayedNeutered === false) return "not_spayed_or_neutered"

    const normalizedSex = normalizeText(sex)?.toLowerCase()
    if (normalizedSex === "female") return "spayed"
    if (normalizedSex === "male") return "neutered"
    return "spayed_or_neutered"
}

export function normalizeProfileFields(pet, currentCareDate) {
    const birthDate = normalizeText(pet?.birth_date)
    const sex = normalizeText(pet?.sex)

    return {
        id: normalizeText(pet?.id),
        name: normalizeText(pet?.name),
        species: normalizeText(pet?.species),
        breed: normalizeText(pet?.breed),
        birth_date: birthDate,
        age: calculateProfileAge(birthDate, currentCareDate),
        sex,
        reproductive_status: deriveReproductiveStatus(
            pet?.spayed_neutered,
            sex
        ),
        microchip_id: normalizeText(pet?.microchip_id),
    }
}

export async function buildGovernedProfile({
    repository,
    petId,
    currentCareDate,
}) {
    const unavailable = (reason) => ({
        status: "unavailable",
        fields: emptyProfileFields(),
        missing_fields: [...PROFILE_FIELD_KEYS],
        governing_reference: {
            table: "pets",
            record_id: petId,
        },
        navigation_targets: profileNavigationTargets(petId),
        reason,
    })

    try {
        const pet = await repository.getPetProfile(petId)
        if (!pet) return unavailable("profile_record_not_found")

        const fields = normalizeProfileFields(pet, currentCareDate)
        const missingFields = OPTIONAL_PROFILE_FIELD_KEYS.filter(
            (field) => fields[field] === null
        )

        if (!fields.id || !fields.name || !fields.species) {
            for (const field of ["id", "name", "species"]) {
                if (fields[field] === null && !missingFields.includes(field)) {
                    missingFields.push(field)
                }
            }
        }

        return {
            status: missingFields.length ? "partial" : "available",
            fields,
            missing_fields: missingFields,
            governing_reference: {
                table: "pets",
                record_id: petId,
            },
            navigation_targets: profileNavigationTargets(petId),
            reason: null,
        }
    } catch {
        return unavailable("profile_source_unavailable")
    }
}

function profileNavigationTargets(petId) {
    return petId
        ? [{ kind: "open_profile", label: "Open Profile", target_id: petId }]
        : []
}

function emptyProfileFields() {
    return Object.fromEntries(PROFILE_FIELD_KEYS.map((field) => [field, null]))
}

function normalizeText(value) {
    if (typeof value !== "string") return null
    const normalized = value.trim()
    return normalized || null
}

function parseIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null
    const [year, month, day] = value.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null
    }

    return { year, month, day }
}
