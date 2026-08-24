import { invokeSpecialist } from "./specialistContract.js"

export function createSpecialistRegistry(entries = []) {
    const registry = new Map()

    for (const entry of entries) {
        const name = entry?.contract?.name

        if (!name) {
            throw new TypeError("Every specialist entry requires a contract.")
        }

        if (registry.has(name)) {
            throw new TypeError(`Duplicate specialist registration: ${name}`)
        }

        registry.set(name, Object.freeze({ ...entry }))
    }

    return Object.freeze({
        has(name) {
            return registry.has(name)
        },

        getContract(name) {
            return registry.get(name)?.contract || null
        },

        async invoke({ name, input, tools }) {
            const entry = registry.get(name)

            if (!entry) {
                throw new TypeError(`Specialist is not registered: ${name}`)
            }

            return invokeSpecialist({
                contract: entry.contract,
                input,
                handler: entry.handler,
                tools,
            })
        },

        list() {
            return [...registry.values()].map(({ contract }) => ({
                name: contract.name,
                version: contract.version,
                allowed_truth_tiers: [...contract.allowed_truth_tiers],
                allowed_tools: [...contract.allowed_tools],
                timeout_ms: contract.timeout_ms,
            }))
        },
    })
}
