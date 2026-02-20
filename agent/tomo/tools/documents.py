from __future__ import annotations
from typing import Any, Dict, List, Optional
from .supabase_client import get_supabase

def list_documents(pet_id: str, limit: int = 20, doc_type: Optional[str] = None) -> List[Dict[str, Any]]:
    sb = get_supabase()
    q = (
        sb.table("documents")
        .select("id, doc_type, title, doc_date, source_org, status, created_at, file_url, remarks")
        .eq("pet_id", pet_id)
        .order("doc_date", desc=True)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if doc_type:
        q = q.eq("doc_type", doc_type)

    response = q.execute()
    return response.data or []

def get_document_text(doc_id: str) -> Optional[Dict[str, Any]]:
    sb = get_supabase()
    try:
        response = (
            sb.table("documents")
            .select("id, pet_id, doc_type, title, doc_date, source_org, raw_text")
            .eq("id", doc_id)
            .single()
            .execute()
        )
        return response.data
    except Exception:
        # if .single() raises when not found
        return None

def update_document_extraction(doc_id: str, extracted: Dict[str, Any]) -> Dict[str, Any]:
    sb = get_supabase()
    response = (
        sb.table("documents")
        .update({"text_extracted": extracted})
        .eq("id", doc_id)
        .execute()
    )
    return {"updated": bool(response.data), "data": response.data}