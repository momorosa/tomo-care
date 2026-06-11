import { ingestGmailReceipts } from "../gmail/ingestGmailReceipts.js";

const result = await ingestGmailReceipts({
    maxResults: 5,
})

console.dir(result, {
    depth: null,
})