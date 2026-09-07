/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react"

const RuntimeContext = createContext(null)

export function useRuntimeContext() {
    const value = useContext(RuntimeContext)
    if (!value) throw new Error("RuntimeContext is unavailable.")
    return value
}

export function RuntimeProvider({ value, children }) {
    return (
        <RuntimeContext.Provider value={value}>
            {children}
        </RuntimeContext.Provider>
    )
}
