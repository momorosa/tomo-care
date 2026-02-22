import os
import json
from typing import Any, Dict, Optional, List, Tuple

from google import genai
from google.genai import types

from .documents import get_document_text, update_document_extraction

MODEL = os.getenv("TOMO_GEMINI_MODEL", "gemini-3-flash-preview")

SYSTEM_RULES = (
    "Return ONLY valid JSON. No markdown. "
    "If unsure, use null/empty arrays. Do not invent facts."
)

client = genai.Client()


# -----------------------------
# Response text + JSON parsing
# -----------------------------

def _strip_code_fences(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return s

    if s.startswith("```"):
        parts = s.split("\n", 1)
        if len(parts) == 2:
            s = parts[1]
        else:
            s = s.strip("`").strip()

    s = s.strip()
    if s.endswith("```"):
        s = s[:-3].strip()

    return s.strip()


def _resp_text(resp) -> str:
    try:
        t = getattr(resp, "text", None)
        if isinstance(t, str) and t.strip():
            return t.strip()
    except Exception:
        pass

    try:
        cands = getattr(resp, "candidates", None) or []
        if cands:
            parts = getattr(cands[0].content, "parts", None) or []
            return "".join(getattr(p, "text", "") or "" for p in parts).strip()
    except Exception:
        pass

    return ""


def parse_json_loose(s: str) -> Dict[str, Any]:
    s = _strip_code_fences((s or "").strip())
    if not s:
        raise ValueError("Empty model output")

    try:
        out = json.loads(s)
        if not isinstance(out, dict):
            raise ValueError("Model output JSON is not an object")
        return out
    except Exception:
        pass

    start = s.find("{")
    if start == -1:
        raise ValueError(f"No JSON object found. First 300 chars: {s[:300]}")

    depth = 0
    in_str = False
    esc = False

    for i in range(start, len(s)):
        ch = s[i]

        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = s[start : i + 1]
                    out = json.loads(candidate)
                    if not isinstance(out, dict):
                        raise ValueError("Extracted JSON is not an object")
                    return out

    raise ValueError(f"Unterminated JSON object. First 300 chars: {s[:300]}")


def _looks_truncated_json(s: str) -> bool:
    s = _strip_code_fences((s or "").strip())
    if not s:
        return True
    if s.count("{") > s.count("}"):
        return True
    if s.endswith((",", ":", "[", "{")):
        return True
    if s.endswith('"'):
        return True
    return False


def _call_gemini(prompt: str, *, temperature: float = 0.0, max_output_tokens: int = 4096) -> str:
    cfg = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_output_tokens,
        # Optional to try later:
        # response_mime_type="application/json",
    )

    resp1 = client.models.generate_content(model=MODEL, contents=prompt, config=cfg)
    text1 = _resp_text(resp1)

    if len(text1) < 800 or _looks_truncated_json(text1):
        resp2 = client.models.generate_content(model=MODEL, contents=prompt, config=cfg)
        text2 = _resp_text(resp2)
        if len(text2) > len(text1):
            return text2

    return text1


# -----------------------------
# Extraction normalization
# -----------------------------

def _coerce_ids(extracted: Dict[str, Any], doc: Dict[str, Any]) -> Dict[str, Any]:
    doc_uuid = doc["id"]
    if extracted.get("doc_id") != doc_uuid:
        wrong = extracted.get("doc_id")
        if wrong and not extracted.get("invoice_id"):
            extracted["invoice_id"] = wrong
        extracted["doc_id"] = doc_uuid

    if doc.get("pet_id") and extracted.get("pet_id") != doc.get("pet_id"):
        extracted["pet_id"] = doc.get("pet_id")

    return extracted


def _is_receipt(doc: Dict[str, Any], extracted: Dict[str, Any]) -> bool:
    dt = (doc.get("doc_type") or extracted.get("doc_type") or "").lower()
    return dt in {"receipt", "invoice"}


def _cost_items_empty(extracted: Dict[str, Any]) -> bool:
    items = extracted.get("cost_items")
    return not isinstance(items, list) or len(items) == 0


def _normalize_receipt_fields(extracted: Dict[str, Any], doc: Dict[str, Any]) -> Dict[str, Any]:
    dt = (extracted.get("doc_type") or doc.get("doc_type") or "").lower()
    if dt not in {"receipt", "invoice"}:
        return extracted

    if not isinstance(extracted.get("cost_items"), list):
        extracted["cost_items"] = []

    billing = extracted.get("billing")
    if (not extracted["cost_items"]) and isinstance(billing, list) and billing:
        service_date = extracted.get("doc_date") or (str(doc.get("doc_date")) if doc.get("doc_date") else None)
        items = []
        for b in billing:
            items.append(
                {
                    "service_date": service_date,
                    "category": "other",
                    "label": b.get("item"),
                    "amount": b.get("amount"),
                    "currency": b.get("currency") or "USD",
                    "notes": None,
                }
            )
        extracted["cost_items"] = items

    totals = extracted.get("totals")
    if not isinstance(totals, dict):
        totals = {}

    if totals.get("paid") is None:
        amt_sum = 0.0
        has_any = False
        for ci in extracted.get("cost_items") or []:
            a = ci.get("amount")
            if isinstance(a, (int, float)):
                amt_sum += float(a)
                has_any = True
            elif isinstance(a, str):
                try:
                    amt_sum += float(a.replace("$", "").replace(",", "").strip())
                    has_any = True
                except Exception:
                    pass
        if has_any:
            totals["paid"] = round(amt_sum, 2)

    if totals:
        totals.setdefault("currency", "USD")
        extracted["totals"] = totals

    return extracted


def _normalize_discount_labels(extracted: Dict[str, Any]) -> Dict[str, Any]:
    items = extracted.get("cost_items")
    if not isinstance(items, list) or not items:
        return extracted

    discount_tokens = ("discount", "promo", "coupon", "adjust", "credit", "rebate", "savings")

    for ci in items:
        if not isinstance(ci, dict):
            continue

        label = (ci.get("label") or "").strip()
        amt = ci.get("amount")

        amt_num: Optional[float] = None
        if isinstance(amt, (int, float)):
            amt_num = float(amt)
        elif isinstance(amt, str):
            try:
                amt_num = float(amt.replace("$", "").replace(",", "").strip())
            except Exception:
                amt_num = None

        if amt_num is None or amt_num >= 0:
            continue

        if any(tok in label.lower() for tok in discount_tokens):
            continue

        ci["label"] = f"{label} (Discount)" if label else "Discount"

    return extracted


def _to_title_case(s: str) -> str:
    return " ".join(s.strip().split()).title()


def _normalize_lab_value_text_title_case(extracted: Dict[str, Any]) -> Dict[str, Any]:
    labs = extracted.get("labs")
    if not isinstance(labs, list) or not labs:
        return extracted

    for lab in labs:
        results = lab.get("results")
        if not isinstance(results, list):
            continue

        for r in results:
            if not isinstance(r, dict):
                continue

            vt = r.get("value_text")
            vn = r.get("value_num")

            if vn is not None:
                continue
            if not isinstance(vt, str) or not vt.strip():
                continue

            s = vt.strip()
            if s.isupper() or s.replace(" ", "").isupper():
                r["value_text"] = _to_title_case(s)

    return extracted


def _normalize_lab_analytes(extracted: Dict[str, Any]) -> Dict[str, Any]:
    labs = extracted.get("labs")
    if not isinstance(labs, list) or not labs:
        return extracted

    analyte_map = {
        "blood / hemoglobin": "Blood (Hemoglobin)",
        "blood/hemoglobin": "Blood (Hemoglobin)",
        "blood hemoglobin": "Blood (Hemoglobin)",
        "wbc": "WBC",
        "rbc": "RBC",
    }

    for lab in labs:
        results = lab.get("results")
        if not isinstance(results, list):
            continue

        for r in results:
            if not isinstance(r, dict):
                continue

            a = r.get("analyte")
            if not isinstance(a, str) or not a.strip():
                continue

            key = " ".join(a.strip().lower().split())
            r["analyte"] = analyte_map.get(key, a.strip())

    return extracted


def _summary_from_labs(extracted: Dict[str, Any]) -> Optional[str]:
    """
    Deterministic summary generator (used when per-panel fallback doesn’t provide a summary).
    Produces a compact string highlighting common items like T4 + 4Dx results.
    """
    labs = extracted.get("labs")
    if not isinstance(labs, list) or not labs:
        return None

    highlights: List[str] = []

    def add_once(prefix: str, value: str) -> None:
        s = f"{prefix} {value}".strip()
        if s and s not in highlights:
            highlights.append(s)

    for lab in labs:
        if not isinstance(lab, dict):
            continue
        results = lab.get("results")
        if not isinstance(results, list):
            continue

        for r in results:
            if not isinstance(r, dict):
                continue
            analyte = (r.get("analyte") or "").strip()
            a = analyte.lower()
            vt = r.get("value_text")
            if not isinstance(vt, str) or not vt.strip():
                continue
            val = vt.strip()

            if "t4" in a:
                add_once("T4", val)
            elif "heartworm" in a:
                add_once("Heartworm", val)
            elif "ehrlich" in a:
                add_once("Ehrlichia", val)
            elif "anaplas" in a:
                add_once("Anaplasma", val)
            elif "lyme" in a:
                add_once("Lyme", val)

    if highlights:
        return "; ".join(highlights[:6])

    panels = sorted(
        {(lab.get("panel") or "").strip() for lab in labs if isinstance(lab, dict) and (lab.get("panel") or "").strip()}
    )
    if panels:
        return "Panels: " + ", ".join(panels)

    return None


def _apply_post_normalizations(extracted: Dict[str, Any], doc: Dict[str, Any]) -> Dict[str, Any]:
    extracted = _coerce_ids(extracted, doc)
    extracted = _normalize_receipt_fields(extracted, doc)
    extracted = _normalize_discount_labels(extracted)
    extracted = _normalize_lab_analytes(extracted)
    extracted = _normalize_lab_value_text_title_case(extracted)

    # Fill summary if missing and labs exist (common in per-panel fallback)
    if extracted.get("summary") in (None, ""):
        s = _summary_from_labs(extracted)
        if s:
            extracted["summary"] = s

    return extracted


# -----------------------------
# Lab per-panel fallback (prevents truncation)
# -----------------------------

def _merge_labs(dst_labs: List[Dict[str, Any]], src_labs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Merge labs arrays by (panel, lab_date). Dedup results by (analyte, value_text, value_num, unit).
    """
    def key_lab(l: Dict[str, Any]) -> Tuple[str, str]:
        return (str(l.get("panel") or ""), str(l.get("lab_date") or ""))

    index: Dict[Tuple[str, str], Dict[str, Any]] = {key_lab(l): l for l in dst_labs if isinstance(l, dict)}

    for lab in src_labs:
        if not isinstance(lab, dict):
            continue
        k = key_lab(lab)
        if k not in index:
            index[k] = lab
            continue

        existing = index[k]
        ex_results = existing.get("results")
        if not isinstance(ex_results, list):
            ex_results = []
            existing["results"] = ex_results

        new_results = lab.get("results")
        if not isinstance(new_results, list):
            continue

        seen = set()
        for r in ex_results:
            if not isinstance(r, dict):
                continue
            seen.add((r.get("analyte"), r.get("value_text"), r.get("value_num"), r.get("unit")))

        for r in new_results:
            if not isinstance(r, dict):
                continue
            sig = (r.get("analyte"), r.get("value_text"), r.get("value_num"), r.get("unit"))
            if sig in seen:
                continue
            ex_results.append(r)
            seen.add(sig)

    return list(index.values())


def _extract_lab_panels(raw_text: str, doc: Dict[str, Any]) -> List[str]:
    """
    Tiny call: return the list of panel names present.
    """
    schema = {"doc_id": doc["id"], "panels": ["Hematology", "Chemistry", "Urinalysis", "Endocrinology", "Serology", "Other"]}

    prompt = (
        f"{SYSTEM_RULES}\n"
        "TASK: Identify the lab panel names present in the TEXT.\n"
        "Return ONLY JSON matching the schema.\n"
        "Do not include any other keys.\n\n"
        f"documents.id: {doc['id']}\n"
        f"doc_date: {doc.get('doc_date')}\n\n"
        "SCHEMA:\n"
        f"{json.dumps(schema)}\n\n"
        "TEXT:\n"
        f"{raw_text[:120000]}"
    )

    text = _call_gemini(prompt, temperature=0.0, max_output_tokens=512)
    out = parse_json_loose(text)

    panels = out.get("panels") if isinstance(out, dict) else []
    if not isinstance(panels, list):
        return []

    cleaned = []
    for p in panels:
        if isinstance(p, str) and p.strip():
            cleaned.append(" ".join(p.strip().split()).title())

    seen = set()
    uniq = []
    for p in cleaned:
        if p.lower() in seen:
            continue
        seen.add(p.lower())
        uniq.append(p)

    return uniq


def _extract_single_panel(raw_text: str, doc: Dict[str, Any], panel: str) -> Dict[str, Any]:
    """
    Extract ONE panel only. Keeps output small and avoids truncation.
    """
    schema = {
        "doc_id": doc["id"],
        "labs": [
            {
                "panel": panel,
                "lab_date": str(doc.get("doc_date")) if doc.get("doc_date") else None,
                "results": [
                    {
                        "analyte": "",
                        "value_text": None,
                        "value_num": None,
                        "unit": None,
                        "ref_low": None,
                        "ref_high": None,
                        "flag": None,
                    }
                ],
            }
        ],
    }

    prompt = (
        f"{SYSTEM_RULES}\n"
        f"TASK: Extract ONLY the '{panel}' panel from the TEXT.\n"
        "STRICT RULES:\n"
        "- Return ONLY JSON matching the schema.\n"
        "- Include ONLY analytes belonging to this panel.\n"
        "- Keep output compact.\n"
        "- doc_id MUST match.\n\n"
        f"documents.id: {doc['id']}\n"
        f"doc_date: {doc.get('doc_date')}\n\n"
        "SCHEMA:\n"
        f"{json.dumps(schema)}\n\n"
        "TEXT:\n"
        f"{raw_text[:120000]}"
    )

    text = _call_gemini(prompt, temperature=0.0, max_output_tokens=2048)
    return parse_json_loose(text)


# -----------------------------
# Receipt retry
# -----------------------------

def _retry_cost_items_only(raw_text: str, doc: Dict[str, Any], extracted: Dict[str, Any]) -> Dict[str, Any]:
    retry_schema = {
        "doc_id": doc["id"],
        "invoice_id": extracted.get("invoice_id"),
        "cost_items": [
            {
                "service_date": str(doc.get("doc_date")) if doc.get("doc_date") else None,
                "category": "visit|medication|lab|procedure|other",
                "label": "",
                "amount": None,
                "currency": "USD",
                "notes": None,
            }
        ],
        "totals": {"paid": None, "currency": "USD"},
    }

    retry_prompt = (
        f"{SYSTEM_RULES}\n"
        "RETRY TASK (RECEIPT LINE ITEMS):\n"
        "- Return ONLY JSON.\n"
        "- Extract ALL receipt line items into cost_items[]. Do not leave it empty.\n"
        "- Include negative adjustments as negative amounts.\n"
        "- Populate totals.paid if present.\n"
        "- doc_id MUST equal the provided UUID exactly.\n\n"
        f"documents.id (UUID): {doc['id']}\n"
        f"doc_date: {doc.get('doc_date')}\n"
        f"source_org: {doc.get('source_org')}\n\n"
        "JSON SHAPE:\n"
        f"{json.dumps(retry_schema)}\n\n"
        "TEXT:\n"
        f"{raw_text[:120000]}"
    )

    text = _call_gemini(retry_prompt, temperature=0.0, max_output_tokens=4096)

    try:
        retry_out = parse_json_loose(text)
    except Exception:
        return extracted

    retry_out = _coerce_ids(retry_out, doc)

    if isinstance(retry_out.get("cost_items"), list) and retry_out["cost_items"]:
        extracted["cost_items"] = retry_out["cost_items"]
    if isinstance(retry_out.get("totals"), dict) and retry_out["totals"]:
        extracted["totals"] = retry_out["totals"]
    if retry_out.get("invoice_id") and not extracted.get("invoice_id"):
        extracted["invoice_id"] = retry_out["invoice_id"]

    return extracted


# -----------------------------
# Main extraction API
# -----------------------------

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
        "doc_id": doc["id"],
        "pet_id": doc.get("pet_id"),
        "doc_type": doc.get("doc_type"),
        "doc_date": str(doc.get("doc_date")) if doc.get("doc_date") else None,
        "source_org": doc.get("source_org"),
        "title": doc.get("title"),
        "invoice_id": None,
        "summary": None,
        "events": [
            {
                "event_type": "appointment|visit|injection|vaccine|procedure|lab|refill_request|other",
                "event_date": None,
                "status": "completed|planned|cancelled|unknown",
                "details_json": {},
            }
        ],
        "cost_items": [
            {
                "service_date": None,
                "category": "visit|medication|lab|procedure|other",
                "label": "",
                "amount": None,
                "currency": "USD",
                "notes": None,
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
                        "flag": None,
                    }
                ],
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
        "- Do not invent facts.\n"
        "- If this is a receipt/invoice and line items exist, cost_items must include them. Do not leave it empty.\n\n"
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

    text = _call_gemini(prompt, temperature=0.0, max_output_tokens=4096)

    try:
        extracted = parse_json_loose(text)
    except Exception as e:
        dt = (doc.get("doc_type") or "").lower()

        # Receipt fallback
        if dt in {"receipt", "invoice"}:
            fallback_base: Dict[str, Any] = {
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
                "notes": "fallback: primary extraction returned truncated/non-JSON; used receipt-only retry",
            }
            fallback = _retry_cost_items_only(raw_text, doc, fallback_base)
            fallback = _apply_post_normalizations(fallback, doc)
            if not _cost_items_empty(fallback):
                return fallback

        # Lab report fallback: per-panel extraction and merge
        if dt in {"lab_report", "lab"}:
            panels = _extract_lab_panels(raw_text, doc)
            if not panels:
                panels = ["Hematology", "Chemistry", "Urinalysis", "Endocrinology", "Serology", "Other"]

            labs_all: List[Dict[str, Any]] = []
            notes = []

            for p in panels:
                try:
                    outp = _extract_single_panel(raw_text, doc, p)
                    lp = outp.get("labs") if isinstance(outp, dict) else []
                    if isinstance(lp, list) and lp:
                        labs_all = _merge_labs(labs_all, lp)
                except Exception:
                    notes.append(f"{p.lower()}_failed")

            if labs_all:
                fallback_lab: Dict[str, Any] = {
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
                    "labs": labs_all,
                    "confidence": 0.0,
                    "notes": "fallback: primary extraction truncated; used per-panel lab extraction"
                             + (f" ({','.join(notes)})" if notes else ""),
                }
                fallback_lab = _apply_post_normalizations(fallback_lab, doc)
                return fallback_lab

        cleaned = _strip_code_fences(text)
        raise RuntimeError(
            "Gemini returned non-JSON (or JSON mixed with extra text / truncated output). "
            f"First 300 chars: {cleaned[:300]} | Last 300 chars: {cleaned[-300:]}"
        ) from e

    extracted = _apply_post_normalizations(extracted, doc)

    # Receipt: if still empty, retry narrower prompt
    if _is_receipt(doc, extracted) and _cost_items_empty(extracted):
        extracted = _retry_cost_items_only(raw_text, doc, extracted)
        extracted = _apply_post_normalizations(extracted, doc)

    return extracted


def extract_and_persist(doc_id: str) -> Dict[str, Any]:
    doc = get_document_text(doc_id)
    if not doc:
        raise RuntimeError(f"Document with id {doc_id} not found.")

    extracted = extract_document_to_json(doc)
    update_document_extraction(doc_id, extracted)
    return extracted