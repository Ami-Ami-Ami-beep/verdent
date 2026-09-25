"""E-Mail-Tools ueber IMAP (lesen) und SMTP (senden).

Funktioniert mit praktisch jedem Anbieter (t-online, GMX, Gmail mit App-Passwort, Outlook ...).
Das Passwort steht NICHT in der Config, sondern in einer Umgebungsvariable
(Standard: JARVIS_EMAIL_PASSWORD).
"""

from __future__ import annotations

import email
import imaplib
import os
import smtplib
import ssl
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.utils import parsedate_to_datetime

from . import context
from .registry import CONFIRM, tool
from .web import html_to_text


def _settings() -> dict:
    m = context.cfg.get("email", {})
    if not m.get("imap_host") or not m.get("username"):
        raise RuntimeError("E-Mail ist nicht eingerichtet (email.imap_host / email.username in config.yaml).")
    pw = os.environ.get(m.get("password_env", "JARVIS_EMAIL_PASSWORD"))
    if not pw:
        raise RuntimeError(f"Passwort fehlt: Umgebungsvariable {m.get('password_env')} setzen.")
    return {**m, "password": pw}


def _decode(value: str | None) -> str:
    return str(make_header(decode_header(value))) if value else ""


def _body(msg: email.message.Message) -> str:
    plain, htm = None, None
    for part in msg.walk() if msg.is_multipart() else [msg]:
        if part.get_content_maintype() == "multipart" or part.get("Content-Disposition", "").startswith("attachment"):
            continue
        payload = part.get_payload(decode=True)
        if payload is None:
            continue
        text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
        if part.get_content_type() == "text/plain" and plain is None:
            plain = text
        elif part.get_content_type() == "text/html" and htm is None:
            htm = text
    return plain or (html_to_text(htm) if htm else "")


def _connect() -> imaplib.IMAP4_SSL:
    s = _settings()
    conn = imaplib.IMAP4_SSL(s["imap_host"], int(s["imap_port"]), ssl_context=ssl.create_default_context())
    conn.login(s["username"], s["password"])
    return conn


@tool(
    "check_email",
    "Listet E-Mails aus dem Posteingang (Standard: ungelesene). Gibt ID, Absender, Betreff und Datum zurueck.",
    {
        "type": "object",
        "properties": {
            "only_unread": {"type": "boolean"},
            "limit": {"type": "integer"},
            "folder": {"type": "string", "description": "Standard INBOX"},
            "search": {"type": "string", "description": "Optional: Suchtext in Betreff/Absender"},
        },
    },
)
def check_email(only_unread: bool = True, limit: int = 15, folder: str = "INBOX", search: str | None = None) -> list:
    conn = _connect()
    try:
        conn.select(folder, readonly=True)
        criteria = ["UNSEEN"] if only_unread else ["ALL"]
        if search:
            criteria = ["OR", "SUBJECT", f'"{search}"', "FROM", f'"{search}"'] + (["UNSEEN"] if only_unread else [])
        typ, data = conn.search(None, *criteria)
        ids = data[0].split()[-limit:][::-1]
        mails = []
        for mid in ids:
            typ, msg_data = conn.fetch(mid, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])")
            msg = email.message_from_bytes(msg_data[0][1])
            try:
                date = parsedate_to_datetime(msg["Date"]).isoformat(timespec="minutes")
            except Exception:
                date = msg.get("Date", "")
            mails.append({
                "id": mid.decode(),
                "from": _decode(msg["From"]),
                "subject": _decode(msg["Subject"]),
                "date": date,
            })
        return mails or [{"info": "Keine passenden E-Mails."}]
    finally:
        conn.logout()


@tool(
    "read_email",
    "Liest den vollstaendigen Inhalt einer E-Mail anhand ihrer ID (aus check_email).",
    {
        "type": "object",
        "properties": {"id": {"type": "string"}, "folder": {"type": "string"}},
        "required": ["id"],
    },
)
def read_email(id: str, folder: str = "INBOX") -> dict:
    conn = _connect()
    try:
        conn.select(folder, readonly=True)
        typ, msg_data = conn.fetch(id.encode(), "(BODY.PEEK[])")
        msg = email.message_from_bytes(msg_data[0][1])
        attachments = [_decode(p.get_filename()) for p in msg.walk() if p.get_filename()]
        return {
            "from": _decode(msg["From"]),
            "to": _decode(msg["To"]),
            "subject": _decode(msg["Subject"]),
            "date": msg["Date"],
            "attachments": attachments,
            "body": _body(msg)[:20_000],
        }
    finally:
        conn.logout()


@tool(
    "send_email",
    "Sendet eine E-Mail. Fragt IMMER vorher beim Benutzer nach.",
    {
        "type": "object",
        "properties": {
            "to": {"type": "string"},
            "subject": {"type": "string"},
            "body": {"type": "string"},
        },
        "required": ["to", "subject", "body"],
    },
    risk=CONFIRM,
)
def send_email(to: str, subject: str, body: str) -> str:
    s = _settings()
    if not s.get("smtp_host"):
        raise RuntimeError("email.smtp_host ist nicht eingerichtet.")
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s["username"], to, subject
    msg.set_content(body)
    with smtplib.SMTP_SSL(s["smtp_host"], int(s["smtp_port"]), context=ssl.create_default_context()) as smtp:
        smtp.login(s["username"], s["password"])
        smtp.send_message(msg)
    return f"E-Mail an {to} gesendet."
