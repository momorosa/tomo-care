import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const routeUrl = new URL("../routes/careActions.js", import.meta.url)

test("native handoff route accepts only the server-owned action identity", async () => {
    const source = await readFile(routeUrl, "utf8")
    const route = source.match(
        /\/care-actions\/:actionId\/apple-messages-handoff[\s\S]*?\n\)/
    )?.[0]

    assert.ok(route)
    assert.match(route, /Object\.keys\(req\.body \|\| \{\}\)\.length > 0/)
    assert.match(route, /client_handoff_fields_not_allowed/)
    assert.doesNotMatch(route, /req\.body\.(to|recipient|phone|messageBody)/)
    assert.match(route, /Cache-Control", "no-store/)
})

test("native handoff route does not execute or call a message provider", async () => {
    const source = await readFile(routeUrl, "utf8")
    const route = source.match(
        /\/care-actions\/:actionId\/apple-messages-handoff[\s\S]*?\n\)/
    )?.[0]

    assert.ok(route)
    assert.doesNotMatch(route, /executeCareAction|sendMessage|outboundMessageProvider/)
    assert.match(route, /has not sent the message or booked an appointment/)
})

test("handoff resolution accepts only a human sent or not-sent choice", async () => {
    const source = await readFile(routeUrl, "utf8")
    const route = source.match(
        /\/care-actions\/:actionId\/apple-messages-handoff\/resolve[\s\S]*?\n\)/
    )?.[0]

    assert.ok(route)
    assert.match(route, /bodyKeys\.length !== 1/)
    assert.match(route, /bodyKeys\[0\] !== "resolution"/)
    assert.match(route, /resolveLibrelaAppleMessagesHandoff/)
    assert.match(route, /based on your report/)
    assert.match(route, /Delivery and appointment status are not verified/)
    assert.doesNotMatch(
        route,
        /executeCareAction|sendMessage|outboundMessageProvider/
    )
})
