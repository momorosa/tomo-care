import os, json
from typing import Any, Dict
import google.generativeai as genai

from .documents import get_document_text, update_document_extraction

MODEL = os.getenv("TOMO_GEMINI_MODEL", "gemini-3-flash-preview")

SYSTEM_RULES = (
    "Return ONLY valid JSON. No markdown. "
    "If unsure, use null/empty arrays. Do not invent facts."
)

# Configure once
genai.configure(api_key=os.environ["GOOGLE_API_KEY"])


def _strip_code_fences(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = s.strip("`")
        # remove optional leading language token like "json"
        s = s.split("\n", 1)[1] if "\n" in s else s
    if s.endswith("```"):
        s = s[:-3].strip()
    return s.strip()


def _coerce_ids(extracted: Dict[str, Any], doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensure extracted['doc_id'] equals documents.id (UUID).
    If the model incorrectly put an invoice id into doc_id,
    move it into invoice_id when possible.
    """
    doc_uuid = doc["id"]
    if extracted.get("doc_id") != doc_uuid:
        # preserve whatever the model provided as doc_id as a candidate invoice_id
        wrong = extracted.get("doc_id")
        if wrong and not extracted.get("invoice_id"):
            extracted["invoice_id"] = wrong
        extracted["doc_id"] = doc_uuid

    # also ensure pet_id is present and correct (helpful downstream)
    if doc.get("pet_id") and extracted.get("pet_id") != doc.get("pet_id"):
        extracted["pet_id"] = doc.get("pet_id")

    return extracted


def extract_document_to_json(doc: Dict[str, Any]) -> Dict[str, Any]:
    raw_text = (doc.get("raw_text") or "").strip()
    if len(raw_text) < 40:
        return {
            "doc_id": doc["id"],
            "pet_id": doc.get("pet_id"),
            "doc_type": doc.get("doc_type"),
            "doc_date": str(doc.get("doc_date")) if doc.get("doc_date") else None,
            "source_org": doc.get("source_org"),
            "title": doc.get("title"),
            "invoice_id": None,
            "summary": None,
            "events": [],
            "cost_items": [],
            "totals": {"paid": None, "currency": "USD"},
            "labs": [],
            "confidence": 0.0,
            "notes": "raw_text too short to extract",
        }

    schema_example = {
        "doc_id": doc["id"],  # MUST be documents.id UUID
        "pet_id": doc.get("pet_id"),
        "doc_type": doc.get("doc_type"),
        "doc_date": str(doc.get("doc_date")) if doc.get("doc_date") else None,
        "source_org": doc.get("source_org"),
        "title": doc.get("title"),
        "invoice_id": None,  # e.g. "i-11260001296" if present
        "summary": None,

        "events": [
            {
                "event_type": "appointment|visit|injection|vaccine|procedure|lab|refill_request|other",
                "event_date": None,
                "status": "completed|planned|cancelled|unknown",
                "details_json": {}
            }
        ],

        "cost_items": [
            {
                "service_date": None,
                "category": "visit|medication|lab|procedure|other",
                "label": "",
                "amount": None,
                "currency": "USD",
                "notes": None
            }
        ],

        "totals": {"paid": None, "currency": "USD"},

        "labs": [
            {
                "panel": None,
                "lab_date": None,
                "results": [
                    {
                        "analyte": "",
                        "value_text": None,
                        "value_num": None,
                        "unit": None,
                        "ref_low": None,
                        "ref_high": None,
                        "flag": None
                    }
                ]
            }
        ],

        "confidence": 0.0,
        "notes": None,
    }

    prompt = (
        f"{SYSTEM_RULES}\n"
        "STRICT OUTPUT RULES:\n"
        "- Return ONLY a single JSON object (no markdown, no code fences).\n"
        "- doc_id MUST equal the provided documents.id UUID exactly.\n"
        "- If you find an invoice number (e.g., i-###########), put it in invoice_id.\n"
        "- For receipts/invoices: populate cost_items[] and totals.paid if present.\n"
        "- For clinical docs: populate events[]; for lab reports: populate labs[].\n"
        "- Do not invent facts.\n\n"
        "CANONICAL IDS (use these):\n"
        f"- documents.id (UUID): {doc['id']}\n"
        f"- pet_id (UUID): {doc.get('pet_id')}\n\n"
        "DOCUMENT METADATA:\n"
        f"title={doc.get('title')}\n"
        f"doc_date={doc.get('doc_date')}\n"
        f"source_org={doc.get('source_org')}\n"
        f"doc_type={doc.get('doc_type')}\n\n"
        "SCHEMA EXAMPLE (fill values, keep keys the same):\n"
        f"{json.dumps(schema_example)}\n\n"
        "TEXT:\n"
        f"{raw_text[:120000]}"
    )

    model = genai.GenerativeModel(MODEL)
    resp = model.generate_content(
        contents=prompt,
        generation_config={"temperature": 0.2, "max_output_tokens": 2000},
    )

    text = (getattr(resp, "text", "") or "").strip()
    text = _strip_code_fences(text)

    try:
        extracted = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Gemini returned non-JSON. First 300 chars: {text[:300]}") from e

    # ✅ Quick check / coercion happens right here (post-parse, pre-return)
    extracted = _coerce_ids(extracted, doc)
    return extracted


def extract_and_persist(doc_id: str) -> Dict[str, Any]:
    doc = get_document_text(doc_id)
    if not doc:
        raise RuntimeError(f"Document with id {doc_id} not found.")

    extracted = extract_document_to_json(doc)
    update_document_extraction(doc_id, extracted)
    return extracted