import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const dialogUrl = new URL(
    "./LibrelaAppointmentMessageDialog.jsx",
    import.meta.url
)
const dashboardUrl = new URL("./Dashboard.jsx", import.meta.url)
const assistantPanelUrl = new URL("./AssistantPanel.jsx", import.meta.url)

test("keeps explicit approval, Open in Messages, and Copy message controls", async () => {
    const source = await readFile(dialogUrl, "utf8")

    assert.match(source, /Approve message/)
    assert.match(source, /Open in Messages/)
    assert.match(source, /Copy message/)
    assert.match(source, /cannot tell whether you send or cancel it/)
    assert.match(source, /has not recorded a send, delivery, or appointment booking/)
    assert.match(source, /I didn’t send it/)
    assert.match(source, /I sent it/)
    assert.match(source, /Confirm that you did not send it/)
    assert.match(source, /Confirm that you pressed Send/)
    assert.match(source, /Open in Messages again/)
    assert.doesNotMatch(source, /OPEN_IN_NEW|open_in_new/)
})

test("pending care actions are reopenable from the assistant header", async () => {
    const source = await readFile(assistantPanelUrl, "utf8")

    assert.match(source, /Review \$\{pendingActionCount\} pending/)
    assert.match(source, /pendingActions\.length === 1/)
    assert.match(source, /reviewPendingAction\(pendingActions\[0\]\.id\)/)
    assert.match(source, /pendingActions\.map/)
    assert.match(source, /onReviewPendingAction/)
})

test("asking Tomo about an approved request reopens the governed action", async () => {
    const source = await readFile(assistantPanelUrl, "utf8")

    assert.match(source, /Boolean\(result\.review_action_id\)/)
    assert.match(source, /reviewPendingAction\(result\.review_action_id\)/)
})

test("native handoff never enters the provider execution path", async () => {
    const source = await readFile(dashboardUrl, "utf8")
    const approvalFlow = source.match(
        /async function prepareAndApproveAppointmentRequest[\s\S]*?async function openAppointmentRequestInMessages/
    )?.[0]
    const handoffFlow = source.match(
        /async function openAppointmentRequestInMessages[\s\S]*?async function editAppointmentMessage/
    )?.[0]

    assert.ok(approvalFlow)
    assert.ok(handoffFlow)
    assert.match(approvalFlow, /approveAppointmentRequest/)
    assert.doesNotMatch(approvalFlow, /executeCareAction/)
    assert.match(handoffFlow, /prepareAppleMessagesHandoff/)
    assert.match(handoffFlow, /requestAppleMessagesDraft/)
    assert.doesNotMatch(handoffFlow, /executeCareAction|sendMessage/)
    assert.match(handoffFlow, /messages_handoff_requested/)
})

test("handoff resolution uses its dedicated human-report endpoint", async () => {
    const source = await readFile(dashboardUrl, "utf8")
    const resolutionFlow = source.match(
        /async function resolveAppointmentMessageHandoff[\s\S]*?async function editAppointmentMessage/
    )?.[0]

    assert.ok(resolutionFlow)
    assert.match(resolutionFlow, /resolveAppleMessagesHandoff/)
    assert.match(resolutionFlow, /result\.handoff\.state/)
    assert.doesNotMatch(
        resolutionFlow,
        /executeCareAction|sendMessage|delivery_status.*sent/
    )
})
