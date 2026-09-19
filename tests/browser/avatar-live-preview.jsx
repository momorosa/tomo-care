// Explicit, bounded provider review using fictional speech samples; no care writes.
import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import RunwayAvatarMedia from "../../src/pages/Dashboard/RunwayAvatarMedia.jsx"
import portrait from "../../assets/tomo-voice-avatar-placeholder.webp"
import "../../src/index.css"

export default function LivePreview() {
    const avatar = useRef(null)
    const stage = useRef(null)
    const attempt = useRef(0)
    const [voiceState, setVoiceState] = useState("idle")
    const [events, setEvents] = useState([])
    const [result, setResult] = useState("Choose Animate Tomo to connect. This uses the configured live provider.")
    useEffect(() => {
        const observer = new MutationObserver(() => {
            const media = stage.current?.querySelector("[data-avatar-transition]")
            if (media) setEvents(current => [...current.slice(-29), `${media.dataset.avatarState} / ${media.dataset.avatarMedia} / ${media.dataset.avatarTransition}`])
        })
        observer.observe(stage.current, { subtree: true, attributes: true, attributeFilter: ["data-avatar-transition", "data-avatar-state", "data-avatar-media"] })
        return () => observer.disconnect()
    }, [])
    async function play(sample) {
        if (!avatar.current.isReady()) { setResult("Wait until live animation is ready."); return }
        const current = ++attempt.current
        setVoiceState("speaking")
        setResult(`Playing ${sample} sample`)
        try {
            const outcome = await avatar.current.speak(`/docs/review/voice-animation/${sample}.mp3`)
            if (current === attempt.current) setResult(`Provider playback: ${outcome?.status || "unavailable"}`)
        } catch { if (current === attempt.current) setResult("Provider playback failed. Use the local samples for the character review.") }
        if (current === attempt.current) setVoiceState("idle")
    }
    function stop() {
        attempt.current += 1
        avatar.current.stopSpeech()?.catch(()=>{})
        setVoiceState("idle")
        setResult("Speech stopped")
    }
    return <main className="tomo-theme" style={{padding:16,minHeight:"100vh"}}>
        <h1>Live avatar review · fictional audio</h1>
        <p>Explicit provider test. End the session when finished; no microphone or care-service requests.</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBlock:12}}>
            <button onClick={()=>play("gratitude")}>Play gratitude sample</button>
            <button onClick={()=>play("playfulness")}>Play playful sample</button>
            <button onClick={stop}>Stop speech</button>
        </div>
        <p role="status">{result}</p>
        <div ref={stage} className="tomo-voice-stage--transcript-open" style={{position:"relative",width:"min(100%, 480px)",height:540,overflow:"hidden",borderRadius:20}}>
            <RunwayAvatarMedia ref={avatar} voiceState={voiceState} fallbackSrc={portrait} fallbackAlt="Tomo live review" />
        </div>
        <ol aria-label="Transition history">{events.map((event,i)=><li key={i}>{event}</li>)}</ol>
    </main>
}
createRoot(document.getElementById("root")).render(<LivePreview />)
