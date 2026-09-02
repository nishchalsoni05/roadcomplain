"""
Reverse geocoding via OpenStreetMap Nominatim.
Rate-limited per Nominatim's usage policy (1 request/second).
"""
import time
import asyncio
import logging
import httpx
from typing import Optional
from ..config import settings

logger = logging.getLogger(__name__)


class ReverseGeocoder:
    """
    Reverse geocoder using OpenStreetMap Nominatim (free, no API key needed).
    Includes a local cache to minimize API calls and respect rate limits.
    """

    def __init__(self):
        self._cache: dict[str, str] = {}  # "lat,lng" -> address
        self._last_request_time = 0.0
        self._client = httpx.AsyncClient(
            timeout=10.0,
            headers={"User-Agent": "RoadRepair/1.0 (AI Urban Intelligence Platform)"}
        )

    async def reverse_geocode(self, latitude: float, longitude: float) -> Optional[str]:
        """
        Convert GPS coordinates to a human-readable address.
        Uses cache to avoid redundant API calls.
        """
        # Round to ~11m precision for cache key
        cache_key = f"{latitude:.4f},{longitude:.4f}"

        if cache_key in self._cache:
            return self._cache[cache_key]

        # Rate limiting — 1 request per second per Nominatim policy
        elapsed = time.time() - self._last_request_time
        if elapsed < settings.NOMINATIM_RATE_LIMIT:
            await asyncio.sleep(settings.NOMINATIM_RATE_LIMIT - elapsed)

        try:
            response = await self._client.get(
                settings.NOMINATIM_URL,
                params={
                    "lat": latitude,
                    "lon": longitude,
                    "format": "json",
                    "addressdetails": 1,
                    "zoom": 18,
                }
            )
            self._last_request_time = time.time()

            if response.status_code == 200:
                data = response.json()
                address = data.get("display_name", "")
                if address:
                    self._cache[cache_key] = address
                    # Limit cache size
                    if len(self._cache) > 1000:
                        keys = list(self._cache.keys())
                        for k in keys[:500]:
                            del self._cache[k]
                    return address
            else:
                logger.warning(f"Nominatim returned {response.status_code}")

        except Exception as e:
            logger.error(f"Reverse geocoding error: {e}")

        return None

    async def close(self):
        await self._client.aclose()
