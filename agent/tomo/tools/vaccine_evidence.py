from datetime import date
from typing import Any, Dict, List, Optional


ALLOWED_SOURCE_RECORD_TYPES = {"vaccination_certificate", "receipt"}
ALLOWED_ASSERTION_TYPES = {
    "administration",
    "next_due",
    "clinic_reported_status",
}
ALLOWED_CLINIC_STATUSES = {"current", "due", "overdue", "unknown"}


def _iso_date(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        return None


def normalize_vaccine_evidence(value: Any) -> List[Dict[str, Any]]:
    """Normalize the future-ready vaccine array while allowlisting Rabies only."""
    if not isinstance(value, list):
        return []

    normalized: List[Dict[str, Any]] = []
    for candidate in value:
        if not isinstance(candidate, dict):
            continue
        if str(candidate.get("care_kind") or "").lower() != "vaccine":
            continue
        if str(candidate.get("care_item") or "").lower() != "rabies":
            continue

        source_record_type = str(
            candidate.get("source_record_type") or ""
        ).lower()
        if source_record_type not in ALLOWED_SOURCE_RECORD_TYPES:
            continue

        assertions = []
        seen = set()
        for assertion in candidate.get("assertions") or []:
            if not isinstance(assertion, dict):
                continue
            assertion_type = str(
                assertion.get("assertion_type") or ""
            ).lower()
            if assertion_type not in ALLOWED_ASSERTION_TYPES or assertion_type in seen:
                continue

            item: Dict[str, Any] = {"assertion_type": assertion_type}
            source_context = assertion.get("source_context")
            if isinstance(source_context, str) and source_context.strip():
                item["source_context"] = " ".join(source_context.split())[:500]

            if assertion_type == "administration":
                administered_on = _iso_date(assertion.get("date"))
                if not administered_on or source_record_type != "vaccination_certificate":
                    continue
                item.update(
                    date=administered_on,
                    date_meaning="administered_on",
                )
            elif assertion_type == "next_due":
                next_due = _iso_date(assertion.get("date"))
                if not next_due:
                    continue
                item.update(
                    date=next_due,
                    date_meaning="clinic_reported_next_due",
                )
            else:
                status = str(assertion.get("status") or "").lower()
                if status not in ALLOWED_CLINIC_STATUSES:
                    continue
                item["status"] = status
                as_of_date = _iso_date(assertion.get("as_of_date"))
                if as_of_date:
                    item["as_of_date"] = as_of_date

            assertions.append(item)
            seen.add(assertion_type)

        if not assertions:
            continue

        raw_product = candidate.get("product_details")
        product: Dict[str, Any] = {}
        if isinstance(raw_product, dict):
            for key in ("product_name", "manufacturer", "batch_number"):
                field = raw_product.get(key)
                if isinstance(field, str) and field.strip():
                    product[key] = " ".join(field.split())[:200]
            product_expiration = _iso_date(
                raw_product.get("product_expiration_date")
            )
            if product_expiration:
                product["product_expiration_date"] = product_expiration

        normalized.append(
            {
                "schema_version": 1,
                "care_kind": "vaccine",
                "care_item": "rabies",
                "source_record_type": source_record_type,
                "assertions": assertions,
                "product_details": product,
            }
        )

    return normalized[:1]
