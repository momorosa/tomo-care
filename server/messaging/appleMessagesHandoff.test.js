import assert from "node:assert/strict"
import test from "node:test"
import {
    buildAppleMessagesLaunchUri,
    buildPrivateRecipientDisplay,
} from "./appleMessagesHandoff.js"

test("builds the verified macOS Messages contract with complete encoding", () => {
    const recipientAddress = buildTestSmsAddress()
    const messageBody =
        "Hello SoMa Animal Hospital,\n\nI’d like dates & times? Ref #100%."

    assert.equal(
        buildAppleMessagesLaunchUri({ recipientAddress, messageBody }),
        `sms:${recipientAddress}?body=Hello%20SoMa%20Animal%20Hospital%2C%0A%0AI%E2%80%99d%20like%20dates%20%26%20times%3F%20Ref%20%23100%25.`
    )
})

test("rejects an untrusted address, blank body, or oversized body", () => {
    for (const args of [
        { recipientAddress: "4155550199", messageBody: "Hello" },
        { recipientAddress: "+4155550199", messageBody: "Hello" },
        { recipientAddress: buildTestSmsAddress(), messageBody: " " },
        {
            recipientAddress: buildTestSmsAddress(),
            messageBody: "x".repeat(1601),
        },
    ]) {
        assert.throws(() => buildAppleMessagesLaunchUri(args))
    }
})

test("returns only a safe recipient display", () => {
    const recipientAddress = buildTestSmsAddress()
    const display = buildPrivateRecipientDisplay(recipientAddress)

    assert.equal(display, "Trusted number ending in 0199")
    assert.equal(display.includes(recipientAddress), false)
})

function buildTestSmsAddress() {
    return String.fromCharCode(
        43,
        49,
        52,
        49,
        53,
        53,
        53,
        53,
        48,
        49,
        57,
        57
    )
}
