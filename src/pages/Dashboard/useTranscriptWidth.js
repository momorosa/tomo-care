import { useEffect, useRef, useState } from "react"
import { clampTranscriptRatio } from "./transcriptResize.js"

export function useTranscriptWidth(preferredRatio) {
    const stageRef = useRef(null)
    const [width, setWidth] = useState(0)
    useEffect(() => {
        const stage = stageRef.current
        if (!stage) return undefined
        const measure = () => setWidth(stage.getBoundingClientRect().width)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(stage)
        return () => observer.disconnect()
    }, [])
    return { stageRef, width, ratio: clampTranscriptRatio(preferredRatio, width) }
}

