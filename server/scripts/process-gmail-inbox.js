import {
    processGmailInbox,
    processExistingDocuments,
} from "../gmail/processGmailDocuments.js"

function getArgValue(flag) {
    const index = process.argv.indexOf(flag)
    if (index === -1) return null
    return process.argv[index + 1] || null
}

function hasFlag(flag) {
    return process.argv.includes(flag)
}

const docId = getArgValue("--doc")
const dryRun = hasFlag("--dry-run")

let result

if (docId) {
    result = await processExistingDocuments({
        documentIds: [docId],
    })
} else {
    result = await processGmailInbox({
        maxResults: 10,
        dryRun,
    })
}

console.dir(result, {
    depth: null,
})