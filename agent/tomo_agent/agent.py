import os
from google.adk.agents.llm_agent import Agent
from tomo.tools import list_documents
from tomo.tools.extract import extract_and_persist

def healthcheck() -> dict:
    return {"status": "ok", "service": "tomo_care"}

def list_momo_documents(limit: int = 20, doc_type: str | None = None):
    """Convenience wrapper so you don't have to type pet_id in the UI every time."""
    pet_id = os.getenv("TOMO_PET_ID")
    if not pet_id:
        raise RuntimeError("TOMO_PET_ID must be set in environment variables.")
    return list_documents(pet_id=pet_id, limit=limit, doc_type=doc_type)

def debug_env():
    return {
        "TOMO_PET_ID": os.getenv("TOMO_PET_ID"),
        "SUPABASE_URL_set": bool(os.getenv("SUPABASE_URL")),
        "GOOGLE_API_KEY_set": bool(os.getenv("GOOGLE_API_KEY")),
        "TOMO_GEMINI_MODEL": os.getenv("TOMO_GEMINI_MODEL"),
    }

def extract_document(doc_id: str):
    """Extract structured JSON from the document raw_text and persist into documents.text_extracted."""
    return extract_and_persist(doc_id)

root_agent = Agent(
    name="root_agent",
    model="gemini-3-flash-preview",
    instruction=(
        "You are Tomo, a careful pet-health record assistant.\n"
        "- When the user asks what records exist or asks to browse documents, call list_momo_documents.\n"
        "- When the user asks to extract a document by id, call extract_document.\n"
        "- Keep responses short and structured. For document lists, include doc_date, doc_type, title, and id.\n"
        "- Do not invent details; rely on tool outputs."
    ),
    tools=[healthcheck, debug_env, list_momo_documents, extract_document],
)