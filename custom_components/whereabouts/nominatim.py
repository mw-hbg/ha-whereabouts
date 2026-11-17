"""Reverse geocoding with OpenStreetMap Nominatim (optional).

Follows the usage policy (https://operations.osmfoundation.org/policies/nominatim/):
at most one request per 1.5 s, own user agent, results cached in a file.
After a 403/429 answer, no request is sent for one hour.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import NOMINATIM_MIN_GAP_SECONDS, NOMINATIM_PAUSE_SECONDS, NOMINATIM_URL, PROJECT_URL
from .storage import clean_text

_LOGGER = logging.getLogger(__name__)

_STREET_KEYS = ("road", "pedestrian", "footway", "path", "cycleway", "square", "residential", "place")
_CITY_KEYS = ("city", "town", "village", "municipality", "suburb", "hamlet")
_CACHE_LIMIT = 20000


def format_address(answer: object, home_country: str) -> str:
    """'Street No, City[, Country]' - the country only outside the home country."""
    if not isinstance(answer, dict):
        return ""
    address = answer.get("address") or {}
    street = next((address[k] for k in _STREET_KEYS if address.get(k)), "")
    if street and address.get("house_number"):
        street += " " + address["house_number"]
    city = next((address[k] for k in _CITY_KEYS if address.get(k)), "")
    city = re.sub(r"\s*\(.*\)\s*$", "", city)  # "Springfield (Stadt)" -> "Springfield"
    parts = [p for p in (street, city) if p]
    country = address.get("country", "")
    if country and str(address.get("country_code", "")).upper() != home_country.upper():
        parts.append(country)
    return clean_text(", ".join(parts))


class Nominatim:
    """Throttled, cached reverse geocoding."""

    def __init__(self, hass: HomeAssistant, cache_path: str, version: str) -> None:
        self._hass = hass
        self._cache_path = cache_path
        self._user_agent = f"HomeAssistant-Whereabouts/{version} (+{PROJECT_URL})"
        self._cache: dict[str, str] | None = None
        self._lock = asyncio.Lock()
        self._last_request = 0.0
        self._paused_at = 0.0

    def _load(self) -> dict[str, str]:
        try:
            with open(self._cache_path, encoding="utf-8") as file:
                data = json.load(file)
            return {k: v for k, v in data.items() if isinstance(v, str)} if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def _save(self, cache: dict[str, str]) -> None:
        if len(cache) > _CACHE_LIMIT:  # drop the oldest entries
            for key in list(cache)[: len(cache) - _CACHE_LIMIT]:
                del cache[key]
        os.makedirs(os.path.dirname(self._cache_path), mode=0o700, exist_ok=True)
        temp = self._cache_path + ".tmp"
        with open(temp, "w", encoding="utf-8") as file:
            json.dump(cache, file, ensure_ascii=False)
        os.chmod(temp, 0o600)
        os.replace(temp, self._cache_path)

    @property
    def paused(self) -> bool:
        return bool(self._paused_at) and time.monotonic() - self._paused_at < NOMINATIM_PAUSE_SECONDS

    async def reverse(self, lat: float, lon: float) -> str:
        """Address for a position ("" if unknown or not reachable). Never raises."""
        key = f"{lat:.4f},{lon:.4f}"  # ~10 m
        async with self._lock:
            if self._cache is None:
                self._cache = await self._hass.async_add_executor_job(self._load)
            if key in self._cache:
                return self._cache[key]
            if self.paused:
                return ""
            wait = self._last_request + NOMINATIM_MIN_GAP_SECONDS - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
            try:
                answer = await self._request(lat, lon)
            finally:
                self._last_request = time.monotonic()
            if answer is None:
                return ""  # errors are not cached, try again next time
            address = format_address(answer, self._hass.config.country or "")
            self._cache[key] = address
            await self._hass.async_add_executor_job(self._save, dict(self._cache))
            return address

    async def _request(self, lat: float, lon: float) -> dict | None:
        session = async_get_clientsession(self._hass)
        params = {
            "format": "jsonv2",
            "lat": f"{lat:.6f}",
            "lon": f"{lon:.6f}",
            "zoom": "18",
            "addressdetails": "1",
        }
        headers = {"User-Agent": self._user_agent, "Accept-Language": self._hass.config.language or "en"}
        try:
            async with session.get(
                f"{NOMINATIM_URL}/reverse",
                params=params,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as response:
                if response.status in (403, 429):
                    self._paused_at = time.monotonic()
                    _LOGGER.warning("OpenStreetMap refused the request (%s), pausing for one hour", response.status)
                    return None
                if response.status != 200:
                    return None
                data = await response.json(content_type=None)
                return data if isinstance(data, dict) else None
        except (TimeoutError, aiohttp.ClientError, ValueError) as err:
            _LOGGER.debug("OpenStreetMap request failed: %s", err)
            return None
