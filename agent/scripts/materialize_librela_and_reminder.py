import os
import sys
from datetime import date, datetime, timedelta
from typing import Any, Dict, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from tomo.tools.supabase_client import get_supabase

PET_ID_DEFAULT = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"

LIBRELA_RECEIPT_DATES_DEFAULT = [
    "2025-02-17",
    "2025-04-16",
    "2025-06-04",
    "2025-07-18",
    "2025-10-20",
    "2025-12-22",
    "2026-02-09",
]

DUE_INTERVAL_DAYS = 49        # 7 weeks
REMIND_BEFORE_DAYS = 7        # remind 1 week before
RULE_VERSION = "librela_v1"


def _parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def _looks_like_librela(extracted: Dict[str, Any]) -> bool:
    summary = (extracted.get("summary") or "")
    if isinstance(summary, str) and "librela" in summary.lower():
        return True

    items = extracted.get("cost_items")
    if isinstance(items, list):
        for ci in items:
            if not isinstance(ci, dict):
                continue
            label = (ci.get("label") or "")
            if isinstance(label, str) and "librela" in label.lower():
                return True

    return False


def _event_exists_for_doc(sb, *, doc_id: str, event_type: str, subtype: str) -> bool:
    res = (
        sb.table("events")
          .select("id")
          .eq("doc_id", doc_id)
          .eq("event_type", event_type)
          .eq("details_json->>subtype", subtype)
          .limit(1)
          .execute()
    )
    return bool(res.data)


def _upsert_planned_reminder(
    sb,
    *,
    pet_id: str,
    remind_date: date,
    due_date: date,
    anchor_event_date: date,
    target_subtype: str,
) -> Dict[str, Any]:
    """
    Create or update ONE planned reminder for Librela.
    Identity:
      event_type='reminder', status='planned', details_json.subtype='<target_subtype>'
    """
    find = (
        sb.table("events")
          .select("id")
          .eq("pet_id", pet_id)
          .eq("event_type", "reminder")
          .eq("status", "planned")
          .eq("details_json->>subtype", target_subtype)
          .limit(1)
          .execute()
    )

    payload = {
        "pet_id": pet_id,
        "doc_id": None,
        "event_type": "reminder",
        "event_date": remind_date.isoformat(),
        "status": "planned",
        "details_json": {
            "subtype": target_subtype,
            "target_event_type": "injection",
            "target_subtype": target_subtype,
            "due_interval_days": DUE_INTERVAL_DAYS,
            "remind_before_days": REMIND_BEFORE_DAYS,
            # Rule signature + traceability
            "rule_version": RULE_VERSION,
            "anchor_event_date": anchor_event_date.isoformat(),
            "due_date": due_date.isoformat(),
        },
    }

    if find.data:
        reminder_id = find.data[0]["id"]
        sb.table("events").update(payload).eq("id", reminder_id).execute()
        out = (
            sb.table("events")
              .select("id, event_date, status, details_json")
              .eq("id", reminder_id)
              .single()
              .execute()
              .data
        )
        out["_action"] = "updated"
        return out

    ins = sb.table("events").insert(payload).execute()
    if getattr(ins, "data", None):
        out = ins.data[0]
    else:
        out = (
            sb.table("events")
              .select("id, event_date, status, details_json")
              .eq("pet_id", pet_id)
              .eq("event_type", "reminder")
              .eq("status", "planned")
              .eq("details_json->>subtype", target_subtype)
              .order("created_at", desc=True)
              .limit(1)
              .execute()
              .data[0]
        )
    out["_action"] = "inserted"
    return out


def main():
    sb = get_supabase()

    pet_id = os.environ.get("TOMO_PET_ID", PET_ID_DEFAULT)
    dates = os.environ.get("TOMO_LIBRELA_DATES")
    receipt_dates = [d.strip() for d in dates.split(",")] if dates else LIBRELA_RECEIPT_DATES_DEFAULT

    docs = (
        sb.table("documents")
          .select("id, pet_id, doc_type, doc_date, source_org, title, text_extracted, file_url")
          .eq("pet_id", pet_id)
          .eq("doc_type", "receipt")
          .in_("doc_date", receipt_dates)
          .order("doc_date", desc=False)
          .execute()
          .data
    )

    if not docs:
        raise SystemExit("No matching receipt documents found for those dates.")

    created = 0
    skipped = 0
    injected_dates: List[date] = []

    for d in docs:
        doc_id = d["id"]
        doc_date = d.get("doc_date")
        extracted = d.get("text_extracted")

        if not extracted:
            print(f"[SKIP] doc_id={doc_id} doc_date={doc_date} reason=no text_extracted")
            skipped += 1
            continue

        if not _looks_like_librela(extracted):
            print(f"[SKIP] doc_id={doc_id} doc_date={doc_date} reason=not librela")
            skipped += 1
            continue

        # Track date regardless of whether we insert (needed for computing last injection)
        try:
            injected_dates.append(_parse_date(str(doc_date)))
        except Exception:
            print(f"[SKIP] doc_id={doc_id} doc_date={doc_date} reason=bad doc_date")
            skipped += 1
            continue

        if _event_exists_for_doc(sb, doc_id=doc_id, event_type="injection", subtype="Librela"):
            print(f"[SKIP] doc_id={doc_id} doc_date={doc_date} reason=already materialized")
            skipped += 1
            continue

        paid = None
        try:
            totals = extracted.get("totals") or {}
            paid_raw = totals.get("paid")
            if isinstance(paid_raw, (int, float)):
                paid = float(paid_raw)
            elif isinstance(paid_raw, str):
                paid = float(paid_raw)
        except Exception:
            paid = None

        payload = {
            "pet_id": pet_id,
            "doc_id": doc_id,
            "event_type": "injection",
            "event_date": str(doc_date),
            "status": "completed",
            "details_json": {
                "subtype": "Librela",
                "source_org": d.get("source_org"),
                "title": d.get("title"),
                "invoice_id": extracted.get("invoice_id"),
                "total_paid": paid,
                "currency": (extracted.get("totals") or {}).get("currency") or "USD",
            },
        }

        sb.table("events").insert(payload).execute()
        created += 1
        print(f"[OK] materialized injection: doc_id={doc_id} event_date={doc_date}")

    if not injected_dates:
        raise SystemExit("No Librela injections materialized or found; cannot compute due/reminder dates.")

    last_injection = max(injected_dates)
    next_due = last_injection + timedelta(days=DUE_INTERVAL_DAYS)
    remind_on = next_due - timedelta(days=REMIND_BEFORE_DAYS)

    reminder = _upsert_planned_reminder(
        sb,
        pet_id=pet_id,
        remind_date=remind_on,
        due_date=next_due,
        anchor_event_date=last_injection,
        target_subtype="Librela",
    )

    print("\n--- Summary ---")
    print(f"created_injections={created} skipped={skipped}")
    print(f"last_librela_injection={last_injection.isoformat()}")
    print(f"next_due_date={next_due.isoformat()} (rule: +{DUE_INTERVAL_DAYS} days)")
    print(f"remind_on={remind_on.isoformat()} (rule: {REMIND_BEFORE_DAYS} days before due)")
    print(f"reminder_event_id={reminder.get('id')} action={reminder.get('_action')} reminder_date={reminder.get('event_date')}")


if __name__ == "__main__":
    main()