// The production component with a local video standing in for a remote track.
// No microphone, synthesis, network provider session, or care-service calls.
import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import RunwayAvatarMedia from "../../src/pages/Dashboard/RunwayAvatarMedia.jsx"
import { playVoiceWithAvatarFallback } from "../../src/pages/Dashboard/avatarVoiceFallback.js"
import portrait from "../../assets/tomo-voice-avatar-placeholder.webp"
import "../../src/index.css"

// Scope the preference simulation to this development page only.
const originalMatchMedia = window.matchMedia.bind(window)
const motionListeners = new Set()
let simulatedReducedMotion = false
window.matchMedia = query => query === "(prefers-reduced-motion: reduce)" ? {
    matches: simulatedReducedMotion,
    addEventListener: (_event, listener) => motionListeners.add(listener),
    removeEventListener: (_event, listener) => motionListeners.delete(listener),
} : originalMatchMedia(query)

export default function HandoffFixture() {
    const avatar = useRef(null)
    const stage = useRef(null)
    const speech = useRef(null)
    const playbackAttempt = useRef(0)
    const [localResponses, setLocalResponses] = useState(0)
    const track = useRef(null)
    const disconnected = useRef(null)
    const [voiceState, setVoiceState] = useState("idle")
    const [reaction, setReaction] = useState(null)
    const reactionId = useRef(0)
    const [events, setEvents] = useState([])
    const [expire, setExpire] = useState(false)
    const [delay, setDelay] = useState(false)
    const delayRef = useRef(false)
    const [reduce, setReduce] = useState(false)
    const log = (entry) => setEvents(current => [...current.slice(-19), entry])

    useEffect(() => {
        const observer = new MutationObserver(() => {
            const media = stage.current?.querySelector("[data-avatar-transition]")
            if (media) setEvents(current => [...current.slice(-19), `${media.dataset.avatarState} / ${media.dataset.avatarMedia} / ${media.dataset.avatarTransition}`])
        })
        observer.observe(stage.current, { subtree: true, attributes: true, attributeFilter: ["data-avatar-transition", "data-avatar-state", "data-avatar-media"] })
        return () => observer.disconnect()
    }, [])

    async function connect({ onVideoTrack, onDisconnected }) {
        disconnected.current = onDisconnected
        onVideoTrack({ attach(video) {
            track.current = video
            video.src = "/media/tomo/motion/happy-a.mp4"
            video.loop = true
            video.play().catch(() => {})
        } })
        return {
            sendSpeech(_url, { onPlaybackStarted }) {
                return new Promise((resolve, reject) => {
                    speech.current = { resolve, reject, onPlaybackStarted }
                    if (!delayRef.current) onPlaybackStarted()
                })
            },
            stopSpeech() {
                speech.current?.resolve({ status: "interrupted" })
                log("Stop reached provider immediately")
                return Promise.resolve()
            },
            disconnect() {
                log("Disconnect reached provider immediately")
                speech.current?.reject(new Error("fixture disconnect"))
                track.current?.pause()
                track.current?.removeAttribute("src")
                track.current?.load()
            },
        }
    }
    async function play(expression) {
        const attempt = ++playbackAttempt.current
        setVoiceState("speaking")
        if (typeof expression === "string") setReaction({id:++reactionId.current, expression})
        const result = await playVoiceWithAvatarFallback({
            avatarReady: avatar.current?.isReady(),
            playAvatar: () => avatar.current.speak("fixture-only"),
            isCurrent: () => attempt === playbackAttempt.current,
            playLocal: async () => {
                setLocalResponses(count => count + 1)
                log("Local Voice fallback received the answer")
            },
        })
        log(`Answer settled: ${result.mode}`)
        setVoiceState("idle")
    }

    return <main className="tomo-theme" style={{padding:16,minHeight:"100vh"}}>
        <h1>Avatar handoff · local simulation</h1>
        <p role="status">Voice state: {voiceState}. Local answers: {localResponses}.</p>
        <p>Happy footage stands in for a different live pose. No provider connection or audio.</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBlock:12}}>
            <label><input type="checkbox" checked={reduce} onChange={e=>{
                simulatedReducedMotion = e.target.checked
                setReduce(e.target.checked)
                for (const listener of motionListeners) listener({matches:e.target.checked})
            }} /> Simulate Reduced Motion</label>
            <label><input type="checkbox" checked={expire} onChange={e=>setExpire(e.target.checked)} /> Expire next connection after 8 seconds</label>
            <label><input type="checkbox" checked={delay} onChange={e=>{delayRef.current=e.target.checked;setDelay(e.target.checked)}} /> Hold playback-start signal</label>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBlock:12}}>
            <button onClick={()=>{setReaction({id:++reactionId.current,expression:"pleased"});setVoiceState("idle")}}>Receive thanks</button>
            <button onClick={()=>{setReaction({id:++reactionId.current,expression:"amused"});setVoiceState("idle")}}>Receive playful praise</button>
            <button onClick={()=>{setReaction({id:++reactionId.current,expression:"attentive"});setVoiceState("idle")}}>Thanks with worry</button>
            <button onClick={()=>setVoiceState("listening")}>Listen locally</button>
            <button onClick={()=>setVoiceState("thinking")}>Think locally</button>
            <button onClick={()=>play()}>Play simulated answer</button>
            <button onClick={()=>play("pleased")}>Play grateful answer</button>
            <button onClick={()=>speech.current?.resolve({status:"completed"})}>Complete answer</button>
            <button onClick={()=>{playbackAttempt.current += 1;avatar.current.stopSpeech();setVoiceState("idle")}}>Stop speech</button>
            <button onClick={()=>disconnected.current?.()}>Simulate disconnect</button>
            <button onClick={()=>speech.current?.onPlaybackStarted()}>Release playback-start signal</button>
        </div>
        <div ref={stage} className="tomo-voice-stage--transcript-open" style={{position:"relative",width:"min(100%, 480px)",height:540,overflow:"hidden",borderRadius:20}}>
            <RunwayAvatarMedia ref={avatar} voiceState={voiceState} reaction={reaction} fallbackSrc={portrait} fallbackAlt="Tomo fixture"
                createSession={async()=>({max_duration_seconds:expire?8:0})} connectAvatar={connect} />
        </div>
        <ol aria-label="Transition history">{events.map((event,i)=><li key={i}>{event}</li>)}</ol>
    </main>
}
createRoot(document.getElementById("root")).render(<HandoffFixture />)
