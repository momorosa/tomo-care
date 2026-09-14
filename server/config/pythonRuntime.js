import { existsSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

export const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))

export function resolvePythonBin({
    env = process.env,
    projectRoot = PROJECT_ROOT,
    platform = process.platform,
    exists = existsSync,
} = {}) {
    if (env.PYTHON_BIN?.trim()) return env.PYTHON_BIN.trim()
    const localPython = path.join(
        projectRoot,
        "agent",
        ".venv",
        ...(platform === "win32" ? ["Scripts", "python.exe"] : ["bin", "python"])
    )
    if (exists(localPython)) return localPython
    return platform === "win32" ? "python" : "python3"
}
