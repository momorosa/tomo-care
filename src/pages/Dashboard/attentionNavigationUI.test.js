import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const assistantUrl = new URL("./AssistantPanel.jsx", import.meta.url)
const dashboardUrl = new URL("./Dashboard.jsx", import.meta.url)
const sidebarUrl = new URL("./CareSidebar.jsx", import.meta.url)
const navigationUrl = new URL("./attentionNavigation.js", import.meta.url)

test("renders attention items as navigation cards rather than verified evidence", async () => {
    const source = await readFile(assistantUrl, "utf8")
    const attentionSource = source.match(
        /function AttentionSummary[\s\S]*?(?=\nfunction formatAttentionState)/
    )?.[0]

    assert.ok(attentionSource)
    assert.match(source, /answer\.answer_type === "attention_summary"/)
    assert.match(attentionSource, /aria-label="Items needing attention"/)
    assert.match(attentionSource, /item\.navigation_targets/)
    assert.match(attentionSource, /item\.governing_reference/)
    assert.match(attentionSource, /type="button"/)
    assert.match(attentionSource, /onNavigate\?\.\(target\)/)
    assert.doesNotMatch(attentionSource, /EvidenceCard|citation/)
})

test("routes each governed target to its existing view or trusted calendar URL", async () => {
    const [dashboard, sidebar] = await Promise.all([
        readFile(dashboardUrl, "utf8"),
        readFile(sidebarUrl, "utf8"),
    ])

    assert.match(dashboard, /getAttentionNavigationEffect\(target\)/)
    assert.match(dashboard, /setFocusedReminderId\(effect\.recordId\)/)
    assert.match(
        dashboard,
        /type: "select_section"[\s\S]*section: HOME_SECTIONS\.REMINDERS/
    )
    assert.match(dashboard, /reviewPendingAction\(effect\.recordId\)/)
    assert.match(dashboard, /navigate\(`\/review\/\$\{effect\.recordId\}`\)/)
    assert.match(dashboard, /window\.open\(effect\.url, "_blank", "noopener,noreferrer"\)/)
    assert.match(sidebar, /reminderElement\.open = true/)
    assert.match(sidebar, /reminderElement\.scrollIntoView/)
    assert.match(sidebar, /reminderElement\.focus/)
})

test("keeps the attention command interpreter navigation-only", async () => {
    const source = await readFile(navigationUrl, "utf8")

    assert.doesNotMatch(source, /fetch\s*\(|method:\s*["']POST|approve|execute|complete/)
    assert.match(source, /open_reminder/)
    assert.match(source, /open_care_action/)
    assert.match(source, /open_review_document/)
    assert.match(source, /open_calendar_event/)
    assert.match(source, /open_calendar_home/)
})
