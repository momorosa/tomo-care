import assert from "node:assert/strict"
import test from "node:test"
import {
    buildGovernedProfile,
    calculateProfileAge,
    deriveReproductiveStatus,
    normalizeProfileFields,
} from "./governedProfile.js"

const PET_ID = "pet-123"

function repositoryFor(value) {
    return {
        async getPetProfile(petId) {
            assert.equal(petId, PET_ID)
            if (value instanceof Error) throw value
            return value
        },
    }
}

test("calculates age from the supplied TomoCare care date", () => {
    assert.equal(calculateProfileAge("2014-08-22", "2026-08-21"), 11)
    assert.equal(calculateProfileAge("2014-08-22", "2026-08-22"), 12)
    assert.equal(calculateProfileAge("2014-08-22", "2026-08-23"), 12)
    assert.equal(calculateProfileAge("2027-01-01", "2026-08-22"), null)
    assert.equal(calculateProfileAge("not-a-date", "2026-08-22"), null)
})

test("maps reproductive status without guessing sex", () => {
    assert.equal(deriveReproductiveStatus(true, "female"), "spayed")
    assert.equal(deriveReproductiveStatus(true, "male"), "neutered")
    assert.equal(deriveReproductiveStatus(true, null), "spayed_or_neutered")
    assert.equal(
        deriveReproductiveStatus(false, "female"),
        "not_spayed_or_neutered"
    )
    assert.equal(deriveReproductiveStatus(null, "female"), null)
})

test("preserves a stored microchip identifier as trimmed text", () => {
    assert.equal(
        normalizeProfileFields(
            { microchip_id: " 900215000000001 " },
            "2026-08-14"
        ).microchip_id,
        "900215000000001"
    )
    assert.equal(
        normalizeProfileFields({ microchip_id: "   " }, "2026-08-14")
            .microchip_id,
        null
    )
})

test("builds an available governed profile and typed navigation", async () => {
    const result = await buildGovernedProfile({
        repository: repositoryFor({
            id: PET_ID,
            name: "Momo",
            species: "canine",
            breed: "American Eskimo",
            birth_date: "2014-08-22",
            sex: "female",
            spayed_neutered: true,
            microchip_id: "900215000000001",
        }),
        petId: PET_ID,
        currentCareDate: "2026-08-14",
    })

    assert.equal(result.status, "available")
    assert.equal(result.fields.age, 11)
    assert.equal(result.fields.reproductive_status, "spayed")
    assert.equal(result.fields.microchip_id, "900215000000001")
    assert.deepEqual(result.governing_reference, {
        table: "pets",
        record_id: PET_ID,
    })
    assert.deepEqual(result.navigation_targets, [
        { kind: "open_profile", label: "Open Profile", target_id: PET_ID },
    ])
})

test("keeps missing optional fields null and marks the profile partial", async () => {
    const result = await buildGovernedProfile({
        repository: repositoryFor({
            id: PET_ID,
            name: "Momo",
            species: "canine",
            breed: " ",
            birth_date: null,
            sex: null,
            spayed_neutered: null,
        }),
        petId: PET_ID,
        currentCareDate: "2026-08-14",
    })

    assert.equal(result.status, "partial")
    assert.equal(result.fields.breed, null)
    assert.equal(result.fields.age, null)
    assert.deepEqual(result.missing_fields, [
        "breed",
        "birth_date",
        "age",
        "sex",
        "reproductive_status",
        "microchip_id",
    ])
})

test("does not turn a missing row or source failure into an empty profile", async () => {
    for (const value of [null, new Error("offline")]) {
        const result = await buildGovernedProfile({
            repository: repositoryFor(value),
            petId: PET_ID,
            currentCareDate: "2026-08-14",
        })

        assert.equal(result.status, "unavailable")
        assert.equal(result.fields.name, null)
        assert.ok(result.reason)
    }
})
