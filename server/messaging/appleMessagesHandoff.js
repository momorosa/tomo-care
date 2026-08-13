const MAX_MESSAGE_LENGTH = 1600

export function buildAppleMessagesLaunchUri({ recipientAddress, messageBody }) {
    if (
        typeof recipientAddress !== "string" ||
        !/^\+1[2-9]\d{9}$/.test(recipientAddress)
    ) {
        throw new Error(
            "recipientAddress must be a valid U.S. E.164 SMS number."
        )
    }

    if (typeof messageBody !== "string" || !messageBody.trim()) {
        throw new Error("messageBody is required.")
    }

    if (messageBody.length > MAX_MESSAGE_LENGTH) {
        throw new Error(
            `messageBody cannot exceed ${MAX_MESSAGE_LENGTH} characters.`
        )
    }

    return `sms:${recipientAddress}?body=${encodeURIComponent(messageBody)}`
}

export function buildPrivateRecipientDisplay(recipientAddress) {
    if (
        typeof recipientAddress !== "string" ||
        !/^\+1[2-9]\d{9}$/.test(recipientAddress)
    ) {
        throw new Error(
            "recipientAddress must be a valid U.S. E.164 SMS number."
        )
    }

    return `Trusted number ending in ${recipientAddress.slice(-4)}`
}
