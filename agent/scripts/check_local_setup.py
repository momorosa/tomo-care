"""Read a local fixture and import intake dependencies; never connect or persist."""
import importlib
import json
import sys
from pathlib import Path


def main():
    missing = []
    for module in ("pymupdf", "httpx", "supabase", "dotenv"):
        try:
            importlib.import_module(module)
        except ImportError:
            missing.append(module)
    if missing:
        print(json.dumps({"ok": False, "missing": missing}))
        return 1

    from populate_raw_text import extract_pdf_text_bytes

    fixture = Path(__file__).resolve().parents[2] / "demo/fixtures/tomocare-demo-v1-harborlight-invoice.pdf"
    try:
        text = extract_pdf_text_bytes(fixture.read_bytes())
        ok = all(value in text for value in ("HVC-DEMO-090726", "Librela", "177.00"))
        print(json.dumps({"ok": ok, "fixture_text_readable": ok}))
        return 0 if ok else 1
    except Exception:
        print(json.dumps({"ok": False, "fixture_text_readable": False}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
