"""
LocationProvider abstraction layer.
Provides a unified interface for all location sources so event fusion
attaches coordinates identically regardless of GPS source.
"""
import time
import logging
from abc import ABC, abstractmethod
from typing import Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class LocationReading:
    """A single location reading with metadata."""
    latitude: float
    longitude: float
    accuracy_meters: float  # Accuracy radius in meters
    source_type: str  # "gps", "wifi", "ip"
    timestamp: float = field(default_factory=time.time)
    altitude: Optional[float] = None
    speed: Optional[float] = None  # m/s
    heading: Optional[float] = None  # degrees

    @property
    def is_high_accuracy(self) -> bool:
        """GPS-quality accuracy (< 30m)."""
        return self.accuracy_meters < 30.0

    def to_dict(self) -> dict:
        return {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "accuracy_meters": self.accuracy_meters,
            "source_type": self.source_type,
            "timestamp": self.timestamp,
            "altitude": self.altitude,
            "speed": self.speed,
            "heading": self.heading,
            "is_high_accuracy": self.is_high_accuracy,
        }


class LocationProvider(ABC):
    """
    Abstract base class for all location sources.
    All implementations provide LocationReading objects via the same interface.
    """

    @abstractmethod
    def update(self, reading: LocationReading):
        """Update with a new location reading."""
        pass

    @abstractmethod
    def get_current(self) -> Optional[LocationReading]:
        """Get the most recent location reading."""
        pass

    @property
    @abstractmethod
    def source_type(self) -> str:
        pass


class BrowserGeolocationProvider(LocationProvider):
    """
    Receives location data from the browser's Geolocation API via WebSocket.
    Works for both phone GPS (high accuracy) and laptop WiFi/IP geolocation (lower accuracy).
    """

    def __init__(self):
        self._current_reading: Optional[LocationReading] = None
        self._history: list[LocationReading] = []
        self._max_history = 100

    def update(self, reading: LocationReading):
        """Called by WebSocket handler when location data arrives from browser."""
        self._current_reading = reading
        self._history.append(reading)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

    def update_from_dict(self, data: dict):
        """Parse location data from WebSocket JSON message."""
        reading = LocationReading(
            latitude=data["latitude"],
            longitude=data["longitude"],
            accuracy_meters=data.get("accuracy", 999.0),
            source_type=self._classify_source(data.get("accuracy", 999.0)),
            timestamp=data.get("timestamp", time.time()),
            altitude=data.get("altitude"),
            speed=data.get("speed"),
            heading=data.get("heading"),
        )
        self.update(reading)
        return reading

    def get_current(self) -> Optional[LocationReading]:
        if self._current_reading is None:
            return None
        # Only return reading if it's recent (within 30 seconds)
        age = time.time() - self._current_reading.timestamp
        if age > 30:
            logger.warning(f"Location reading is stale ({age:.0f}s old)")
        return self._current_reading

    def get_trajectory(self, last_n: int = 10) -> list[LocationReading]:
        """Get recent location history for trajectory analysis."""
        return self._history[-last_n:]

    @property
    def source_type(self) -> str:
        if self._current_reading:
            return self._current_reading.source_type
        return "unknown"

    @staticmethod
    def _classify_source(accuracy_meters: float) -> str:
        """Classify the location source based on accuracy."""
        if accuracy_meters < 30:
            return "gps"
        elif accuracy_meters < 100:
            return "wifi"
        else:
            return "ip"
