import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tomo.tools.supabase_client import get_supabase

BUCKET = "tomo-docs"

def upload_pdf(local_path: str, dest_key: str):
    sb = get_supabase()
    with open(local_path, "rb") as f:
        data = f.read()

    return sb.storage.from_(BUCKET).upload(
        path=dest_key,
        file=data,
        file_options={
            "content-type": "application/pdf",
            "x-upsert": "true",  # must be a string for this client version
        },
    )

if __name__ == "__main__":
    local = sys.argv[1]
    key = sys.argv[2]
    print("uploading:", local, "->", f"{BUCKET}/{key}")
    out = upload_pdf(local, key)
    print(out)
    