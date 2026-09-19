import { useRef, useState } from "react"
import { transcriptBounds, transcriptRatioFromKey, transcriptRatioFromPointer } from "./transcriptResize.js"

export default function TranscriptDivider({ stageRef, width, ratio, onChange }) {
    const dragRef = useRef(null)
    const [dragging, setDragging] = useState(false)
    const { min, max } = transcriptBounds(width)
    function finish(event, cancel = false) {
        const drag = dragRef.current
        if (!drag || event.pointerId !== undefined && event.pointerId !== drag.pointerId) return
        dragRef.current = null
        setDragging(false)
        if (cancel) onChange(drag.ratio)
        if (event.currentTarget.hasPointerCapture(drag.pointerId)) event.currentTarget.releasePointerCapture(drag.pointerId)
    }
    return <div
        role="separator"
        tabIndex={0}
        aria-label="Resize conversation panel"
        aria-orientation="vertical"
        aria-controls="tomo-voice-transcript"
        aria-valuemin={Math.round(min * 100)}
        aria-valuemax={Math.round(max * 100)}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuetext={`Conversation width ${Math.round(ratio * 100)} percent`}
        title="Drag to resize. Arrow keys adjust; Enter resets."
        className={`tomo-transcript-divider${dragging ? " tomo-transcript-divider--dragging" : ""}`}
        onDoubleClick={() => onChange(0.5)}
        onPointerDown={event => {
            if (event.button !== 0 || !event.isPrimary) return
            event.preventDefault()
            event.currentTarget.focus()
            dragRef.current = { pointerId: event.pointerId, ratio }
            event.currentTarget.setPointerCapture(event.pointerId)
            setDragging(true)
        }}
        onPointerMove={event => {
            if (dragRef.current?.pointerId !== event.pointerId) return
            const box = stageRef.current?.getBoundingClientRect()
            if (box) onChange(transcriptRatioFromPointer(event.clientX, box.left, box.width))
        }}
        onPointerUp={event => finish(event)}
        onPointerCancel={event => finish(event, true)}
        onLostPointerCapture={() => { dragRef.current = null; setDragging(false) }}
        onKeyDown={event => {
            if (event.key === "Escape" && dragRef.current) {
                event.preventDefault()
                finish(event, true)
                return
            }
            const next = transcriptRatioFromKey(event.key, ratio, width, event.shiftKey)
            if (next !== null) { event.preventDefault(); onChange(next) }
        }}
    />
}
