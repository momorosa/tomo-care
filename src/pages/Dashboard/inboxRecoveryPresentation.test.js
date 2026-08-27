import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

const sidebarUrl = new URL("./CareSidebar.jsx", import.meta.url)

test("offers direct recovery actions for failed and manual-review intake", async () => {
    const source = await readFile(sidebarUrl, "utf8")

    assert.match(source, /Open saved document/)
    assert.match(source, /Retry processing/)
    assert.match(source, /Open saved PDF/)
    assert.match(source, /Processing stage:/)
    assert.doesNotMatch(
        source,
        /Check the inbox again to retry without creating a duplicate/
    )
})
