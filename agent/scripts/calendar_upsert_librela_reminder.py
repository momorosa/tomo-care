import os
import sys
from datetime import datetime, time
from typing import Any, Dict, Optional
from datetime import datetime, timezone

# make "tomo" importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tomo.tools.supabase_client import get_supabase

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

DEFAULT_PET_ID = "6e90e0b7-ad8c-4fde-97f9-2d2554b59c95"
DEFAULT_SUBTYPE = "Librela"

# 9:00 AM Pacific
DEFAULT_TZ = "America/Los_Angeles"
DEFAULT_START_HOUR = 9
DEFAULT_START_MINUTE = 0
DEFAULT_DURATION_MINUTES = 30


def _ensure_parent_dir(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


def get_calendar_service() -> Any:
    """
    Returns an authenticated Google Calendar API service.
    Stores token (refresh token etc.) locally for reuse.
    """
    client_secret_path = os.environ.get("TOMO_GCAL_CLIENT_SECRET", "secrets/client_secret.json")
    token_path = os.environ.get("TOMO_GCAL_TOKEN_PATH", ".tokens/google_calendar_token.json")

    _ensure_parent_dir(token_path)

    creds: Optional[Credentials] = None
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        # For local dev: open browser OAuth flow once, then token is reused.
        flow = InstalledAppFlow.from_client_secrets_file(client_secret_path, SCOPES)
        creds = flow.run_local_server(port=0)
        with open(token_path, "w") as f:
            f.write(creds.to_json())

    return build("calendar", "v3", credentials=creds)


def _parse_iso_date(d: str) -> datetime.date:
    return datetime.strptime(d, "%Y-%m-%d").date()


def _build_event_payload(
    *,
    title: str,
    event_date_str: str,
    timezone: str = DEFAULT_TZ,
    start_hour: int = DEFAULT_START_HOUR,
    start_minute: int = DEFAULT_START_MINUTE,
    duration_minutes: int = DEFAULT_DURATION_MINUTES,
    description: str = "",
) -> Dict[str, Any]:
    d = _parse_iso_date(event_date_str)
    start_dt = datetime.combine(d, time(hour=start_hour, minute=start_minute))
    end_dt = start_dt + __import__("datetime").timedelta(minutes=duration_minutes)

    return {
        "summary": title,
        "description": description,
        "start": {"dateTime": start_dt.isoformat(), "timeZone": timezone},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": timezone},
        # Optional: set popup reminders. If you prefer email, change "method".
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "popup", "minutes": 60},   # 1 hour before (optional)
                {"method": "popup", "minutes": 15},   # 15 minutes before (optional)
            ],
        },
    }


def _get_planned_reminder_event(sb, pet_id: str, subtype: str) -> Dict[str, Any]:
    res = (
        sb.table("events")
          .select("id, event_date, status, details_json")
          .eq("pet_id", pet_id)
          .eq("event_type", "reminder")
          .eq("status", "planned")
          .eq("details_json->>subtype", subtype)
          .limit(1)
          .execute()
    )
    if not res.data:
        raise RuntimeError(f"No planned reminder found for pet_id={pet_id} subtype={subtype}")
    return res.data[0]


def _update_event_external_refs(sb, event_row_id: str, external_refs: Dict[str, Any]) -> None:
    # Merge into details_json.external_refs (create if missing)
    # We do a read-modify-write because JSONB merge operations vary with client versions.
    cur = (
        sb.table("events")
          .select("details_json")
          .eq("id", event_row_id)
          .single()
          .execute()
          .data
    )
    details = cur.get("details_json") or {}
    if not isinstance(details, dict):
        details = {}

    ex = details.get("external_refs") or {}
    if not isinstance(ex, dict):
        ex = {}

    ex.update(external_refs)
    details["external_refs"] = ex

    sb.table("events").update({"details_json": details}).eq("id", event_row_id).execute()


def upsert_calendar_for_librela_reminder() -> Dict[str, Any]:
    sb = get_supabase()

    pet_id = os.environ.get("TOMO_PET_ID", DEFAULT_PET_ID)
    subtype = os.environ.get("TOMO_REMINDER_SUBTYPE", DEFAULT_SUBTYPE)

    calendar_id = os.environ.get("TOMO_GCAL_CALENDAR_ID")
    if not calendar_id:
        raise RuntimeError("Set TOMO_GCAL_CALENDAR_ID to your TomoCare calendar ID.")

    service = get_calendar_service()

    reminder_row = _get_planned_reminder_event(sb, pet_id=pet_id, subtype=subtype)
    reminder_id = reminder_row["id"]
    reminder_date = reminder_row["event_date"]
    details = reminder_row.get("details_json") or {}
    external_refs = (details.get("external_refs") or {}) if isinstance(details, dict) else {}

    # Use stored event id if present to update instead of duplicating.
    gcal_event_id = external_refs.get("google_calendar_event_id")

    due_date = details.get("due_date")
    anchor_date = details.get("anchor_event_date")
    rule_version = details.get("rule_version")

    title = f"Momo — {subtype} due soon"
    desc_lines = [
        f"Reminder: {subtype} upcoming",
        f"Reminder date: {reminder_date} (9:00 AM PT)",
    ]
    if due_date:
        desc_lines.append(f"Due date: {due_date}")
    if anchor_date:
        desc_lines.append(f"Last completed injection: {anchor_date}")
    if rule_version:
        desc_lines.append(f"Rule: {rule_version}")
    desc_lines.append(f"(TomoCare event_id: {reminder_id})")
    description = "\n".join(desc_lines)

    payload = _build_event_payload(
        title=title,
        event_date_str=reminder_date,
        timezone=DEFAULT_TZ,
        start_hour=DEFAULT_START_HOUR,
        start_minute=DEFAULT_START_MINUTE,
        duration_minutes=DEFAULT_DURATION_MINUTES,
        description=description,
    )

    if gcal_event_id:
        updated = service.events().update(calendarId=calendar_id, eventId=gcal_event_id, body=payload).execute()
        action = "updated"
        event = updated
    else:
        created = service.events().insert(calendarId=calendar_id, body=payload).execute()
        action = "created"
        event = created
        gcal_event_id = event.get("id")

    # Persist back to DB for idempotency
    _update_event_external_refs(
        sb,
        event_row_id=reminder_id,
        external_refs={
            "google_calendar_calendar_id": calendar_id,
            "google_calendar_event_id": gcal_event_id,
            "google_calendar_html_link": event.get("htmlLink"),
            "google_calendar_last_synced_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {
        "action": action,
        "reminder_event_row_id": reminder_id,
        "reminder_date": reminder_date,
        "google_calendar_event_id": gcal_event_id,
        "htmlLink": event.get("htmlLink"),
    }


if __name__ == "__main__":
    out = upsert_calendar_for_librela_reminder()
    print(out)