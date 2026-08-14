import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("the governed Profile repository selects only the bounded pets fields", async () => {
    const source = await readFile(
        new URL("./profileRepository.js", import.meta.url),
        "utf8"
    )

    assert.match(
        source,
        /"id, name, species, breed, birth_date, sex, spayed_neutered"/
    )
    assert.match(source, /\.from\("pets"\)/)
    assert.match(source, /\.eq\("id", petId\)/)
    assert.doesNotMatch(source, /select\("\*"\)/)
})
