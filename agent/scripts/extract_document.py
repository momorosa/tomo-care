import os
import sys
import json
import inspect
import asyncio

# Make "tomo" importable when running from project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tomo.tools import extract as extract_tool


def find_extraction_function():
    preferred_names = [
        "extract_and_persist",
        "extract_document_to_json",
    ]

    for name in preferred_names:
        fn = getattr(extract_tool, name, None)
        if callable(fn):
            return name, fn

    available = [
        name
        for name, value in vars(extract_tool).items()
        if callable(value) and not name.startswith("_")
    ]

    raise RuntimeError(
        "Could not find a usable extraction function. "
        f"Available callables in tomo.tools.extract: {available}"
    )


async def maybe_await(value):
    if inspect.isawaitable(value):
        return await value
    return value


async def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python agent/scripts/extract_document.py <doc_id>")

    doc_id = sys.argv[1]

    fn_name, fn = find_extraction_function()
    signature = inspect.signature(fn)

    print(f"[extract_document] using tomo.tools.extract.{fn_name}")
    print(f"[extract_document] doc_id={doc_id}")
    print(f"[extract_document] signature={fn_name}{signature}")

    result = await maybe_await(fn(doc_id))

    print("\n[extract_document] result:")
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())