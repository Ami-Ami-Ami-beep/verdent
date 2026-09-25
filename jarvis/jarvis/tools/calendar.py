"""Kalender-Tool: liest Termine aus iCal/ICS-Links oder -Dateien.

Google Kalender: Einstellungen -> Kalender -> "Privatadresse im iCal-Format".
Outlook: Einstellungen -> Kalender -> Freigegebene Kalender -> "Kalender veroeffentlichen" (ICS-Link).
iCloud: Kalender teilen -> "Oeffentlicher Kalender".
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import icalendar
import recurring_ical_events

from . import context
from .registry import tool


def _load_calendars() -> list[icalendar.Calendar]:
    c = context.cfg.get("calendar", {})
    raw: list[bytes] = []
    for url in c.get("ics_urls", []):
        url = url.replace("webcal://", "https://", 1)
        r = httpx.get(url, follow_redirects=True, timeout=30)
        r.raise_for_status()
        raw.append(r.content)
    for f in c.get("ics_files", []):
        raw.append(Path(f).expanduser().read_bytes())
    if not raw:
        raise RuntimeError("Kein Kalender eingerichtet (calendar.ics_urls oder calendar.ics_files in config.yaml).")
    return [icalendar.Calendar.from_ical(b) for b in raw]


def _as_dt(value, tz: ZoneInfo) -> datetime:
    if isinstance(value, datetime):
        return value.astimezone(tz) if value.tzinfo else value.replace(tzinfo=tz)
    return datetime.combine(value, time.min, tzinfo=tz)


def events_between(calendars: list[icalendar.Calendar], start: datetime, end: datetime, tz: ZoneInfo) -> list[dict]:
    events = []
    for cal in calendars:
        for ev in recurring_ical_events.of(cal).between(start, end):
            dtstart = ev.get("DTSTART").dt
            dtend = ev.get("DTEND").dt if ev.get("DTEND") else dtstart
            all_day = isinstance(dtstart, date) and not isinstance(dtstart, datetime)
            events.append({
                "title": str(ev.get("SUMMARY", "(ohne Titel)")),
                "start": _as_dt(dtstart, tz),
                "end": _as_dt(dtend, tz),
                "all_day": all_day,
                "location": str(ev.get("LOCATION", "")) or None,
                "description": (str(ev.get("DESCRIPTION", "")) or None),
            })
    events.sort(key=lambda e: e["start"])
    return events


@tool(
    "get_calendar_events",
    "Zeigt Termine aus dem Kalender. Standard: heute + die naechsten 7 Tage. "
    "Datumsangaben im Format YYYY-MM-DD.",
    {
        "type": "object",
        "properties": {
            "start_date": {"type": "string", "description": "YYYY-MM-DD, Standard heute"},
            "days": {"type": "integer", "description": "Anzahl Tage ab start_date, Standard 7"},
            "search": {"type": "string", "description": "Optional: nur Termine mit diesem Text"},
        },
    },
)
def get_calendar_events(start_date: str | None = None, days: int = 7, search: str | None = None) -> list:
    tz = ZoneInfo(context.cfg.get("calendar", {}).get("timezone", "Europe/Berlin"))
    day = date.fromisoformat(start_date) if start_date else datetime.now(tz).date()
    start = datetime.combine(day, time.min, tzinfo=tz)
    end = start + timedelta(days=days)
    events = events_between(_load_calendars(), start, end, tz)
    if search:
        s = search.lower()
        events = [e for e in events if s in e["title"].lower() or s in (e["description"] or "").lower()]
    out = []
    for e in events:
        when = e["start"].strftime("%a %d.%m.%Y") + (
            " (ganztaegig)" if e["all_day"] else f" {e['start']:%H:%M}-{e['end']:%H:%M}"
        )
        item = {"wann": when, "titel": e["title"]}
        if e["location"]:
            item["ort"] = e["location"]
        if e["description"]:
            item["notiz"] = e["description"][:300]
        out.append(item)
    return out or [{"info": f"Keine Termine zwischen {start:%d.%m.} und {end:%d.%m.%Y}."}]
