import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

// Native modality keeps background controls inert and contains keyboard focus.
// Closing is controlled by the existing flow, including its busy-state guard.
export default function Modal({ children, labelledBy, label, onDismiss, busy = false, className = "" }) {
    const dialogRef = useRef(null)
    useEffect(() => {
        const dialog = dialogRef.current
        const trigger = document.activeElement
        dialog.showModal()
        dialog.focus({ preventScroll: true })
        return () => {
            dialog.close()
            if (trigger?.isConnected) trigger.focus({ preventScroll: true })
        }
    }, [])
    useEffect(() => {
        const dialog = dialogRef.current
        if (dialog.open && !dialog.contains(document.activeElement)) {
            dialog.focus({ preventScroll: true })
        }
    })
    return createPortal(
        <dialog ref={dialogRef} tabIndex={-1} className={`tomo-theme tomo-modal ${className}`}
            aria-labelledby={labelledBy} aria-label={label}
            onKeyDown={(event) => {
                if (event.key !== "Tab") return
                const dialog = event.currentTarget
                const controls = [...dialog.querySelectorAll(
                    'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'
                )].filter((element) => element.getClientRects().length > 0)
                const first = controls[0]
                const last = controls.at(-1)
                const active = document.activeElement
                if (!first) {
                    event.preventDefault()
                    dialog.focus()
                } else if (event.shiftKey && (active === first || active === dialog)) {
                    event.preventDefault()
                    last.focus()
                } else if (!event.shiftKey && (active === last || active === dialog)) {
                    event.preventDefault()
                    first.focus()
                }
            }}
            onCancel={(event) => {
                event.preventDefault()
                if (!busy) onDismiss?.()
            }}>
            {children}
        </dialog>, document.body
    )
}
