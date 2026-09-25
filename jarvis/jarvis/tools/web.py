"""Web-Tools: Webseiten abrufen und im Internet suchen (ohne API-Key)."""

from __future__ import annotations

import html
import re
from urllib.parse import parse_qs, unquote, urlparse

import httpx

from .registry import tool

UA = "Mozilla/5.0 (Jarvis local assistant)"


def html_to_text(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style|noscript|svg).*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr)>", "\n", raw)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


@tool(
    "fetch_url",
    "Laedt eine Webseite und gibt den lesbaren Text zurueck (z.B. Doku, Plugin-Seiten, Anleitungen).",
    {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]},
)
def fetch_url(url: str) -> str:
    r = httpx.get(url, headers={"User-Agent": UA}, follow_redirects=True, timeout=30)
    r.raise_for_status()
    if "html" in r.headers.get("content-type", ""):
        return html_to_text(r.text)
    return r.text


def _clean_ddg_link(href: str) -> str:
    if href.startswith("//"):
        href = "https:" + href
    q = parse_qs(urlparse(href).query)
    return unquote(q["uddg"][0]) if "uddg" in q else href


@tool(
    "web_search",
    "Sucht im Internet (DuckDuckGo) und gibt Titel, Link und Kurzbeschreibung der Treffer zurueck.",
    {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "max_results": {"type": "integer"},
        },
        "required": ["query"],
    },
)
def web_search(query: str, max_results: int = 8) -> str:
    r = httpx.post(
        "https://html.duckduckgo.com/html/",
        data={"q": query},
        headers={"User-Agent": UA},
        follow_redirects=True,
        timeout=30,
    )
    r.raise_for_status()
    links = re.findall(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>', r.text, re.S)
    snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>', r.text, re.S)
    out = []
    for i, (href, title) in enumerate(links[:max_results]):
        snippet = html_to_text(snippets[i]) if i < len(snippets) else ""
        out.append(f"{i + 1}. {html_to_text(title)}\n   {_clean_ddg_link(href)}\n   {snippet}")
    return "\n".join(out) or "Keine Treffer."
