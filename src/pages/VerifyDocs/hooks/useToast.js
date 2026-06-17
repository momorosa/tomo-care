import { useRef, useState } from "react"

export function useToast(duration = 2500) {
    const [toast, setToast] = useState(null)
    const timeoutRef = useRef(null)

    function showToast(message) {
        setToast(message)
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = window.setTimeout(() => setToast(null), duration)
    }

    return { toast, showToast }
}
