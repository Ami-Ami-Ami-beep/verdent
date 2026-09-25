"""Beispiel-Plugin: Wetter ueber die kostenlose Open-Meteo-API (kein API-Key noetig).

Zum Aktivieren nach ~/.jarvis/plugins/ kopieren und in Jarvis /neu eingeben
(oder Jarvis bitten, die Plugins neu zu laden).
"""

import httpx

from jarvis.tools import tool


@tool(
    "weather",
    "Aktuelles Wetter und Vorhersage fuer einen Ort.",
    {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
)
def weather(city: str) -> dict:
    geo = httpx.get("https://geocoding-api.open-meteo.com/v1/search",
                    params={"name": city, "count": 1, "language": "de"}, timeout=20).json()
    if not geo.get("results"):
        return {"fehler": f"Ort '{city}' nicht gefunden"}
    place = geo["results"][0]
    data = httpx.get("https://api.open-meteo.com/v1/forecast", params={
        "latitude": place["latitude"], "longitude": place["longitude"],
        "current": "temperature_2m,weather_code,wind_speed_10m",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "timezone": "auto", "forecast_days": 3,
    }, timeout=20).json()
    return {"ort": f"{place['name']}, {place.get('country', '')}", "aktuell": data["current"], "vorhersage": data["daily"]}
