import test from "node:test"
import assert from "node:assert/strict"
import { AVATAR_HANDOFF_MS as MS, captureAvatarFrame, createAvatarVisualHandoff } from "./avatarVisualHandoff.js"

function fixture({ capture = true, ready = () => true } = {}) {
    let time = 0
    let id = 0
    const jobs = new Map()
    const changes = []
    const captures = []
    const controller = createAvatarVisualHandoff({
        captureOutgoing: (live) => { captures.push(live); return capture },
        isReady: ready,
        onChange: (state) => changes.push({ ...state }),
        schedule: (callback, delay) => { jobs.set(++id, { callback, at: time + delay }); return id },
        cancel: (key) => jobs.delete(key),
    })
    function advance(ms) {
        const end = time + ms
        while (true) {
            const next = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
            if (!next) break
            time = next[1].at
            jobs.delete(next[0])
            next[1].callback()
        }
        time = end
    }
    function live() { controller.request(true); advance(MS.DEPART + MS.ARRIVE) }
    return { controller, advance, live, changes, captures, jobs }
}

test("captures outgoing local media before revealing live and settles to one visible source", () => {
    const f = fixture()
    f.controller.request(true)
    assert.deepEqual(f.captures, [false])
    assert.deepEqual(f.controller.getState(), { displayLive: false, phase: "departing" })
    f.advance(MS.DEPART)
    assert.deepEqual(f.controller.getState(), { displayLive: true, phase: "arriving" })
    f.advance(MS.ARRIVE)
    assert.deepEqual(f.controller.getState(), { displayLive: true, phase: "steady" })
})

test("normal completion leaves a short live settling interval before returning locally", () => {
    const f = fixture(); f.live()
    f.controller.request(false, { settleMs: MS.SETTLE })
    f.advance(MS.SETTLE - 1)
    assert.equal(f.controller.getState().phase, "steady")
    assert.equal(f.controller.getState().displayLive, true)
    f.advance(1)
    assert.equal(f.controller.getState().phase, "departing")
    assert.equal(f.captures.at(-1), true)
    f.advance(MS.DEPART + MS.ARRIVE)
    assert.deepEqual(f.controller.getState(), { displayLive: false, phase: "steady" })
})

test("a new answer cancels a pending return without flashing local media", () => {
    const f = fixture(); f.live()
    f.controller.request(false, { settleMs: MS.SETTLE })
    f.advance(100)
    f.controller.request(true)
    f.advance(2000)
    assert.equal(f.controller.getState().displayLive, true)
    assert.equal(f.changes.filter(s => !s.displayLive && s.phase === "arriving").length, 0)
})

test("Stop or End captures synchronously and bypasses the settling wait", () => {
    const f = fixture(); f.live()
    f.controller.request(false, { settleMs: MS.SETTLE })
    f.controller.request(false, { urgent: true })
    assert.equal(f.captures.at(-1), true)
    assert.equal(f.controller.getState().phase, "departing")
    f.advance(MS.DEPART)
    assert.equal(f.controller.getState().displayLive, false)
})

test("disconnect during live entry cancels the late reveal", () => {
    const f = fixture()
    f.controller.request(true)
    f.advance(50)
    f.controller.request(false, { urgent: true })
    f.advance(2000)
    assert.deepEqual(f.controller.getState(), { displayLive: false, phase: "steady" })
    assert.equal(f.changes.some(s => s.displayLive), false)
})

test("waits for prepared local media but bounds the wait on a failed local asset", () => {
    let localReady = false
    const f = fixture({ ready: live => live || localReady }); f.live()
    f.controller.request(false)
    f.advance(MS.DEPART + 80)
    assert.equal(f.controller.getState().phase, "departing")
    localReady = true
    f.advance(MS.READY_POLL)
    assert.equal(f.controller.getState().displayLive, false)
    const failed = fixture({ ready: live => live }); failed.live()
    failed.controller.request(false)
    failed.advance(MS.DEPART + MS.READY_WAIT + MS.ARRIVE)
    assert.deepEqual(failed.controller.getState(), { displayLive: false, phase: "steady" })
})

test("does not reveal live media whose readiness was revoked", () => {
    const f = fixture({ ready: () => false })
    f.controller.request(true)
    f.advance(2000)
    assert.deepEqual(f.controller.getState(), { displayLive: false, phase: "steady" })
})

test("reduced motion cancels an active bridge without scheduling a visual effect", () => {
    const f = fixture(); f.live()
    f.controller.request(false, { immediate: true })
    assert.equal(f.jobs.size, 0)
    assert.deepEqual(f.controller.getState(), { displayLive: false, phase: "steady" })
    f.advance(2000)
    assert.equal(f.controller.getState().phase, "steady")
})

test("missing frame falls back to a ready source without showing an empty canvas", () => {
    const f = fixture({ capture: false })
    f.controller.request(true)
    assert.deepEqual(f.controller.getState(), { displayLive: true, phase: "steady" })
    assert.equal(f.jobs.size, 0)
})

test("dispose cancels pending visual work", () => {
    const f = fixture(); f.controller.request(true)
    f.controller.dispose()
    const before = f.changes.length
    f.advance(2000)
    assert.equal(f.changes.length, before)
    assert.equal(f.jobs.size, 0)
})

test("frame capture preserves proportions, bounds memory, and tolerates decoding failure", () => {
    const draws = []
    const canvas = { getContext: () => ({ drawImage: (...args) => draws.push(args) }) }
    assert.equal(captureAvatarFrame(canvas, { videoWidth: 1080, videoHeight: 1920 }), true)
    assert.deepEqual([canvas.width, canvas.height], [720, 1280])
    assert.equal(draws.length, 1)
    assert.equal(captureAvatarFrame(canvas, { videoWidth: 0, videoHeight: 0 }), false)
    assert.equal(captureAvatarFrame({ getContext() { throw new Error("unavailable") } }, { naturalWidth: 500, naturalHeight: 500 }), false)
})


test("Stop followed by End preserves the same captured frame through track teardown", () => {
    const f = fixture(); f.live()
    f.controller.request(false, { urgent: true })
    const captures = f.captures.length
    f.advance(50)
    f.controller.request(false, { urgent: true })
    assert.equal(f.captures.length, captures)
    assert.equal(f.controller.getState().phase, "departing")
    f.advance(MS.DEPART)
    f.controller.request(false, { urgent: true })
    assert.equal(f.controller.getState().phase, "arriving")
    f.advance(MS.ARRIVE)
    assert.deepEqual(f.controller.getState(), { displayLive: false, phase: "steady" })
})
