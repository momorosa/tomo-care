import test from "node:test"
import assert from "node:assert/strict"
import { TOMO_RELATIONSHIP_PROFILE_V1 } from "./relationshipProfile.js"

test("keeps the relationship profile intentional, versioned, and immutable", () => {
    assert.equal(
        TOMO_RELATIONSHIP_PROFILE_V1.version,
        "tomo-relationship-v1"
    )
    assert.equal(TOMO_RELATIONSHIP_PROFILE_V1.rosa.preferred_name, "Rosa")
    assert.equal(TOMO_RELATIONSHIP_PROFILE_V1.momo.name, "Momo")
    assert.equal(
        TOMO_RELATIONSHIP_PROFILE_V1.momo.birth_date,
        "2014-08-22"
    )
    assert.ok(
        TOMO_RELATIONSHIP_PROFILE_V1.momo.approved_nicknames.includes(
            "Queen Momo"
        )
    )
    assert.ok(Object.isFrozen(TOMO_RELATIONSHIP_PROFILE_V1))
    assert.ok(Object.isFrozen(TOMO_RELATIONSHIP_PROFILE_V1.momo))
    assert.ok(
        Object.isFrozen(
            TOMO_RELATIONSHIP_PROFILE_V1.momo.approved_nicknames
        )
    )
})

test("keeps relationship texture separate from verified care evidence", () => {
    const serialized = JSON.stringify(
        TOMO_RELATIONSHIP_PROFILE_V1.momo
    )

    assert.doesNotMatch(serialized, /verified_events|cost_items|citations/i)
    assert.doesNotMatch(serialized, /last injection|last dose|diagnosis/i)
})
