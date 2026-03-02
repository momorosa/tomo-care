import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Make "tomo" importable + allow importing scripts as modules
AGENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, AGENT_DIR)

from tomo.tools.supabase_client import get_supabase
from tomo.tools.extract import extract_and_persist

# Import existing script function
# File: tomo_care/agent/scripts/populate_raw_text.py
from scripts.populate_raw_text import populate_raw_text as populate_raw_text_fn  # type: ignore

from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="TomoCare Local Worker", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite
        "http://localhost:3000",  # Next.js
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Models
# -----------------------------

class DocIdRequest(BaseModel):
    doc_id: str


class VerifyRequest(BaseModel):
    doc_id: str
    verified_extraction: Dict[str, Any]
    verifier: Optional[str] = "rosa"
    notes: Optional[str] = None


class MaterializeRequest(BaseModel):
    doc_id: str
    # For Phase 0.5: we will only materialize Librela injections.
    # Later we can generalize by doc_type and event_type.
    allow_auto_verify_receipt: bool = True


# -----------------------------
# Helpers
# -----------------------------

def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _set_doc_status(doc_id: str, status: str) -> None:
    sb = get_supabase()
    sb.table("documents").update({"status": status}).eq("id", doc_id).execute()


def _get_document(doc_id: str) -> Dict[str, Any]:
    sb = get_supabase()
    res = (
        sb.table("documents")
          .select("id, pet_id, doc_type, doc_date, title, source_org, file_url, raw_text, text_extracted, external_refs, status")
          .eq("id", doc_id)
          .single()
          .execute()
          .data
    )
    if not res:
        raise HTTPException(status_code=404, detail=f"Document not found: {doc_id}")
    return res


def _merge_external_refs(doc_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    sb = get_supabase()
    doc = _get_document(doc_id)
    external_refs = doc.get("external_refs") or {}
    if not isinstance(external_refs, dict):
        external_refs = {}
    external_refs.update(patch)
    sb.table("documents").update({"external_refs": external_refs}).eq("id", doc_id).execute()
    return external_refs


def _has_verified_extraction(doc: Dict[str, Any]) -> bool:
    ext = doc.get("external_refs") or {}
    return isinstance(ext, dict) and isinstance(ext.get("verified_extraction"), dict)


def _get_verified_extraction(doc: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    ext = doc.get("external_refs") or {}
    if isinstance(ext, dict) and isinstance(ext.get("verified_extraction"), dict):
        return ext["verified_extraction"]
    return None


def _looks_like_librela(extracted: Dict[str, Any]) -> bool:
    summary = extracted.get("summary")
    if isinstance(summary, str) and "librela" in summary.lower():
        return True
    items = extracted.get("cost_items")
    if isinstance(items, list):
        for ci in items:
            if not isinstance(ci, dict):
                continue
            label = ci.get("label")
            if isinstance(label, str) and "librela" in label.lower():
                return True
    return False


def _materialize_librela_injection_from_verified(doc: Dict[str, Any], verified: Dict[str, Any]) -> Dict[str, Any]:
    """
    Minimal Phase 0.5 materialization: create one injection event if Librela receipt.
    Idempotent by (doc_id + event_type + subtype).
    """
    sb = get_supabase()

    doc_id = doc["id"]
    pet_id = doc["pet_id"]
    doc_date = str(doc.get("doc_date"))

    if not doc_date:
        raise HTTPException(status_code=400, detail="documents.doc_date is required to materialize an event.")

    if not _looks_like_librela(verified):
        raise HTTPException(status_code=400, detail="Verified extraction does not look like Librela; refusing materialize.")

    # Idempotency check
    existing = (
        sb.table("events")
          .select("id")
          .eq("doc_id", doc_id)
          .eq("event_type", "injection")
          .eq("details_json->>subtype", "Librela")
          .limit(1)
          .execute()
          .data
    )
    if existing:
        return {"status": "skipped", "reason": "already_materialized", "event_id": existing[0]["id"]}

    totals = verified.get("totals") or {}
    paid = totals.get("paid")
    try:
        if isinstance(paid, str):
            paid = float(paid)
        elif isinstance(paid, (int, float)):
            paid = float(paid)
        else:
            paid = None
    except Exception:
        paid = None

    payload = {
        "pet_id": pet_id,
        "doc_id": doc_id,
        "event_type": "injection",
        "event_date": doc_date,
        "status": "completed",
        "details_json": {
            "subtype": "Librela",
            "source_org": doc.get("source_org"),
            "title": doc.get("title"),
            "invoice_id": verified.get("invoice_id"),
            "total_paid": paid,
            "currency": totals.get("currency") or "USD",
            "verification": {
                "status": "user_verified",
                "verified_at": _now_utc_iso(),
                "verified_by": (doc.get("external_refs") or {}).get("verified_by") or "rosa",
            },
        },
    }

    ins = sb.table("events").insert(payload).execute()
    event_id = ins.data[0]["id"] if getattr(ins, "data", None) else None

    return {"status": "inserted", "event_id": event_id}


# -----------------------------
# Routes
# -----------------------------

@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "service": "tomo_worker", "ts": _now_utc_iso()}


@app.get("/documents/{doc_id}")
def get_doc(doc_id: str) -> Dict[str, Any]:
    return _get_document(doc_id)


@app.get("/inbox")
def inbox(limit: int = 50) -> Dict[str, Any]:
    sb = get_supabase()
    rows = (
        sb.table("documents")
          .select("id, pet_id, doc_type, doc_date, title, source_org, status, created_at, updated_at")
          .eq("status", "needs_review")
          .order("doc_date", desc=True)
          .limit(limit)
          .execute()
          .data
    )
    return {"items": rows or []}


@app.post("/documents/{doc_id}/populate_raw_text")
def populate_raw_text(doc_id: str) -> Dict[str, Any]:
    try:
        out = populate_raw_text_fn(doc_id)
        _set_doc_status(doc_id, "raw_text_ready")
        return {"ok": True, "doc_id": doc_id, "populate_raw_text": out}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/documents/{doc_id}/extract")
def extract(doc_id: str) -> Dict[str, Any]:
    """
    Runs extraction and moves status to needs_review.
    """
    try:
        extracted = extract_and_persist(doc_id)
        _set_doc_status(doc_id, "needs_review")
        return {"ok": True, "doc_id": doc_id, "extracted": extracted}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/documents/{doc_id}/extract_pipeline")
def extract_pipeline(doc_id: str) -> Dict[str, Any]:
    """
    Convenience: populate raw_text then extract.
    """
    try:
        prt = populate_raw_text_fn(doc_id)
        _set_doc_status(doc_id, "raw_text_ready")
        extracted = extract_and_persist(doc_id)
        _set_doc_status(doc_id, "needs_review")
        return {"ok": True, "doc_id": doc_id, "populate_raw_text": prt, "extracted": extracted}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/documents/{doc_id}/verify")
def verify(doc_id: str, req: VerifyRequest) -> Dict[str, Any]:
    """
    Stores verified extraction into documents.external_refs.verified_extraction.
    Also stores verifier metadata + sets status=verified.
    """
    if req.doc_id != doc_id:
        raise HTTPException(status_code=400, detail="doc_id mismatch")

    patch = {
        "verified_extraction": req.verified_extraction,
        "verified_by": req.verifier or "rosa",
        "verified_at": _now_utc_iso(),
    }
    if req.notes:
        patch["verification_notes"] = req.notes

    external_refs = _merge_external_refs(doc_id, patch)
    _set_doc_status(doc_id, "verified")
    return {"ok": True, "doc_id": doc_id, "status": "verified", "external_refs": external_refs}


@app.post("/documents/{doc_id}/materialize_librela")
def materialize_librela(doc_id: str, req: MaterializeRequest) -> Dict[str, Any]:
    """
    Materializes Librela injection event ONLY if verified_extraction exists.
    """
    if req.doc_id != doc_id:
        raise HTTPException(status_code=400, detail="doc_id mismatch")

    doc = _get_document(doc_id)
    verified = _get_verified_extraction(doc)
    if not verified:
        raise HTTPException(status_code=400, detail="No verified_extraction found. Verify first.")

    result = _materialize_librela_injection_from_verified(doc, verified)

    # If inserted or already existed, mark as materialized
    if result.get("status") in {"inserted", "skipped"}:
        _set_doc_status(doc_id, "materialized")

    return {"ok": True, "doc_id": doc_id, "materialize": result}