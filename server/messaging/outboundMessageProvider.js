import { createMockSmsProvider } from "./mockSmsProvider.js"
import process from "node:process"

export function createOutboundMessageProvider() {
    const providerName =
        process.env.OUTBOUND_MESSAGE_PROVIDER?.trim().toLowerCase() || "mock"

    if (providerName !== "mock") {
        throw new Error(
            `Outbound provider "${providerName}" is not available in this build.`
        )
    }

    return createMockSmsProvider()
}