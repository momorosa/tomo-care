import { DEMO_INTAKE_FIXTURE, DEMO_SCENARIO_ID } from "../demo/scenarioManifest.js"

// Recognize this project's synthetic source, without excluding ordinary clinic
// PDFs merely because their names contain words like "sample" or "demo".
export function isKnownDemoSource({
    subject = "",
    filename = "",
    contentSha256 = "",
    document = null,
} = {}) {
    const refs = document?.external_refs || {}
    const marker = DEMO_INTAKE_FIXTURE.subjectPrefix.toLowerCase()
    const fixtureName = DEMO_INTAKE_FIXTURE.filename.toLowerCase()
    return (
        [subject, refs.gmail_subject].some((value) =>
            String(value || "").toLowerCase().includes(marker)
        ) ||
        [filename, refs.gmail_attachment_filename].some((value) =>
            String(value || "").trim().toLowerCase() === fixtureName
        ) ||
        [contentSha256, refs.content_sha256].some((value) =>
            String(value || "").toLowerCase() === DEMO_INTAKE_FIXTURE.contentSha256
        ) ||
        document?.id === DEMO_INTAKE_FIXTURE.documentId ||
        document?.file_url === DEMO_INTAKE_FIXTURE.storageKey ||
        refs.demo_owned === true ||
        refs.scenario_id === DEMO_SCENARIO_ID
    )
}

export const DEMO_SOURCE_EXCLUDED = "demo_source_excluded_from_private_care"
