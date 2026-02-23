import csv
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tomo.tools.supabase_client import get_supabase

DEFAULT_CSV = "scripts/uploads.csv"


def parse_pet_and_date(storage_key: str) -> tuple[str, str, str]:
    """
    Expected: {pet_id}/{YYYY-MM-DD}/<filename>.pdf
    Returns: (pet_id, doc_date_str, filename)
    """
    parts = storage_key.strip().split("/")
    if len(parts) < 3:
        raise ValueError(f"Invalid storage_key (expected pet_id/YYYY-MM-DD/filename): {storage_key}")

    pet_id = parts[0]
    doc_date = parts[1]
    filename = parts[-1]

    # Validate ISO date
    datetime.strptime(doc_date, "%Y-%m-%d")
    return pet_id, doc_date, filename

def make_title(filename: str) -> str:
    # Example: receipt_i-11250009907.pdf -> "Receipt i-11250009907"
    base = filename.rsplit(".", 1)[0]
    base = base.replace("_", " ").strip()
    if base.lower().startswith("receipt "):
        return base[:1].upper() + base[1:]
    return base[:1].upper() + base[1:]

def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV

    source_org = os.environ.get("TOMO_SOURCE_ORG")  # optional
    set_title = os.environ.get("TOMO_SET_TITLE", "1") == "1"  # default on

    sb = get_supabase()

    ok = 0
    errors = []

    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for line_no, row in enumerate(reader, start=2):
            local_path = (row.get("local_path") or "").strip()
            storage_key = (row.get("storage_key") or "").strip()
            if not local_path or not storage_key:
                continue

            try:
                pet_id, doc_date_str, filename = parse_pet_and_date(storage_key)

                payload = {
                    "pet_id": pet_id,
                    "doc_type": "receipt",
                    "doc_date": doc_date_str,   # date column accepts "YYYY-MM-DD"
                    "file_url": storage_key,
                    # status default is "ingested", but setting explicitly is fine:
                    "status": "ingested",
                }

                if source_org:
                    payload["source_org"] = source_org

                if set_title:
                    payload["title"] = make_title(filename)

                # Requires a UNIQUE index/constraint on file_url for true idempotent behavior
                res = (
                    sb.table("documents")
                    .upsert(payload, on_conflict="file_url")
                    .execute()
                )

                # Some client versions don't return rows on upsert.
                if getattr(res, "data", None):
                    doc = res.data[0]
                else:
                    fetch = (
                        sb.table("documents")
                            .select("id, pet_id, doc_type, doc_date, source_org, title, file_url, status")
                            .eq("file_url", storage_key)
                            .limit(1)
                            .execute()
                    )
                    if not fetch.data:
                        raise RuntimeError(f"Upsert succeeded but could not fetch row for {storage_key}")
                    doc = fetch.data[0]
                
                ok += 1
                print(f"[OK] line {line_no}: doc_id={doc['id']} doc_date={doc['doc_date']} file_url={doc['file_url']}")

            except Exception as e:
                errors.append((line_no, storage_key, str(e)))
                print(f"[ERR] line {line_no}: {storage_key} -> {e}")

    print("\n--- Summary ---")
    print(f"Upserted: {ok}")
    if errors:
        print(f"Errors: {len(errors)}")
        for line_no, key, msg in errors:
            print(f"  - line {line_no}: {key} :: {msg}")

if __name__ == "__main__":
    main()