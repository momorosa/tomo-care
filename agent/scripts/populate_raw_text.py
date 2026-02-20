import os
import sys
import fitz  # PyMuPDF
import httpx

# make "tomo" importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tomo.tools.supabase_client import get_supabase

BUCKET = "tomo-docs"

def extract_pdf_text_bytes(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    return "\n".join(page.get_text("text") for page in doc).strip()

def populate_raw_text(doc_id: str, expires_in: int = 600):
    sb = get_supabase()

    doc = (
        sb.table("documents")
        .select("id, file_url")
        .eq("id", doc_id)
        .single()
        .execute()
        .data
    )
    if not doc:
        raise RuntimeError(f"Document not found: {doc_id}")
    key = doc.get("file_url")
    if not key:
        raise RuntimeError("documents.file_url is empty; set it to the storage path first.")

    signed = sb.storage.from_(BUCKET).create_signed_url(key, expires_in)
    url = signed.get("signedURL") or signed.get("signedUrl") or signed.get("signed_url")
    if not url:
        raise RuntimeError(f"Could not create signed URL. Response: {signed}")

    r = httpx.get(url, timeout=30)
    r.raise_for_status()

    text = extract_pdf_text_bytes(r.content)
    if len(text) < 40:
        raise RuntimeError("Extracted text is too short (may be scanned/OCR needed).")

    sb.table("documents").update({"raw_text": text}).eq("id", doc_id).execute()
    return {"doc_id": doc_id, "raw_text_len": len(text), "signed_url_used": True}

if __name__ == "__main__":
    doc_id = sys.argv[1]
    out = populate_raw_text(doc_id)
    print(out)