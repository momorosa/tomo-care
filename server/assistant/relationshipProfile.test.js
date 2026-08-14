import test from "node:test"
import assert from "node:assert/strict"
import { TOMO_RELATIONSHIP_PROFILE_V2 } from "./relationshipProfile.js"

test("keeps the relationship profile intentional, versioned, and immutable", () => {
    assert.equal(
        TOMO_RELATIONSHIP_PROFILE_V2.version,
        "tomo-relationship-v2"
    )
    assert.equal(TOMO_RELATIONSHIP_PROFILE_V2.rosa.preferred_name, "Rosa")
    assert.ok(
        TOMO_RELATIONSHIP_PROFILE_V2.momo.approved_nicknames.includes(
            "Queen Momo"
        )
    )
    assert.ok(Object.isFrozen(TOMO_RELATIONSHIP_PROFILE_V2))
    assert.ok(Object.isFrozen(TOMO_RELATIONSHIP_PROFILE_V2.momo))
    assert.ok(
        Object.isFrozen(
            TOMO_RELATIONSHIP_PROFILE_V2.momo.approved_nicknames
        )
    )
})

test("keeps relationship texture separate from verified care evidence", () => {
    const serialized = JSON.stringify(
        TOMO_RELATIONSHIP_PROFILE_V2.momo
    )

    assert.doesNotMatch(serialized, /"name"|pronouns|breed|birth_date/i)
    assert.doesNotMatch(serialized, /verified_events|cost_items|citations/i)
    assert.doesNotMatch(serialized, /last injection|last dose|diagnosis/i)
})
