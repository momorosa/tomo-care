import assert from "node:assert/strict"
import test from "node:test"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseReadFetch } from "./readFetch.js"

const baseUrl = "https://demo.supabase.co"
const rejection = () => Response.json({code:"PGRST303", message:"JWT issued at future"}, {status:401})

function harness(responses = [rejection(), Response.json([{id:"document"}])]) {
    const calls = [], waits = [], logs = []
    const wrapped = createSupabaseReadFetch({baseUrl,
        fetchImpl: async (...args) => { calls.push(args); return responses.shift() },
        wait: async ms => { waits.push(ms) }, onRetry: event => logs.push(event),
    })
    return { wrapped, calls, waits, logs }
}

test("Supabase SDK recovers one rejected table read without changing its query or credentials", async () => {
    const h = harness()
    const client = createClient(baseUrl, "sb_secret_fictional", {global:{fetch:h.wrapped}, auth:{persistSession:false,autoRefreshToken:false}})
    const result = await client.from("documents").select("id").eq("pet_id", "demo")
    assert.equal(result.error, null)
    assert.deepEqual(result.data, [{id:"document"}])
    assert.equal(h.calls.length, 2)
    assert.equal(h.calls[0][0], h.calls[1][0])
    assert.equal(h.calls[0][1], h.calls[1][1])
    assert.deepEqual(h.waits, [1000])
    assert.deepEqual(h.logs, [{code:"supabase_read_token_timing_retry"}])
})

test("a second timing rejection is returned intact without looping", async () => {
    const h = harness([rejection(), rejection()])
    const result = await h.wrapped(`${baseUrl}/rest/v1/documents`)
    assert.equal(result.status, 401)
    assert.equal((await result.json()).message, "JWT issued at future")
    assert.equal(h.calls.length, 2)
})

for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
    test(`${method} is never replayed after the same rejection`, async () => {
        const h = harness()
        const result = await h.wrapped(`${baseUrl}/rest/v1/documents`, {method, body:'{}'})
        assert.equal(result.status, 401)
        assert.equal(h.calls.length, 1)
        assert.deepEqual(h.waits, [])
    })
}

for (const url of [`${baseUrl}/rest/v1/rpc/do_work`, `${baseUrl}/storage/v1/object/sign/pdf`, "https://other.supabase.co/rest/v1/documents"]) {
    test(`does not retry an excluded destination: ${url}`, async () => {
        const h = harness()
        const result = await h.wrapped(url)
        assert.equal(result.status, 401)
        assert.equal(h.calls.length, 1)
    })
}

test("other auth failures and malformed error bodies remain unchanged", async () => {
    for (const response of [Response.json({code:"PGRST303",message:"JWT expired"},{status:401}), Response.json({code:"PGRST301",message:"Invalid signature"},{status:401}), new Response("not JSON",{status:401}), Response.json({code:"PGRST303",message:"JWT issued at future"},{status:403})]) {
        const h = harness([response])
        assert.equal(await h.wrapped(`${baseUrl}/rest/v1/documents`), response)
        assert.equal(h.calls.length, 1)
        await response.text() // Error inspection did not consume the caller's response.
    }
})

test("network errors are not automatically retried", async () => {
    let calls = 0
    const wrapped = createSupabaseReadFetch({baseUrl,fetchImpl:async()=>{calls++;throw new Error("network")}})
    await assert.rejects(wrapped(`${baseUrl}/rest/v1/documents`), /network/)
    assert.equal(calls, 1)
})

test("Request input method is respected", async () => {
    const h = harness()
    await h.wrapped(new Request(`${baseUrl}/rest/v1/documents`, {method:"POST",body:'{}'}))
    assert.equal(h.calls.length, 1)
})

test("aborting during the delay prevents replay", async () => {
    const controller = new AbortController()
    let calls = 0
    const wrapped = createSupabaseReadFetch({baseUrl,
        fetchImpl:async()=>{calls++;return rejection()},
        onRetry:()=>setTimeout(()=>controller.abort(), 10),
    })
    await assert.rejects(wrapped(`${baseUrl}/rest/v1/documents`,{signal:controller.signal}), {name:"AbortError"})
    assert.equal(calls, 1)
})
