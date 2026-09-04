"""
Event Fusion Engine — fuses AI detection results with real GPS location and timestamp.
Creates DetectionEvent database records from real data only.
"""
import uuid
import logging
import base64
import os
from datetime import datetime, timezone
from typing import Optional
import math
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from ..models.event import DetectionEvent, EventType, SeverityLevel
from ..models.session import DetectionSession
from ..ai.pipeline import RawDetectionResult
from ..ai.location_provider import LocationReading
from ..ai.detector import Detection
from ..ai.intelligence import IntelligenceEvent
from .geocoder import ReverseGeocoder
from ..config import settings

logger = logging.getLogger(__name__)

# Mapping from AI class names to EventType enum
CLASS_TO_EVENT_TYPE = {
    "car": EventType.VEHICLE,
    "motorcycle": EventType.VEHICLE,
    "bus": EventType.VEHICLE,
    "truck": EventType.VEHICLE,
    "pedestrian": EventType.PEDESTRIAN,
    "pothole": EventType.POTHOLE,
    "road_damage": EventType.ROAD_DAMAGE,
    "waterlogging": EventType.WATERLOGGING,
    "missing_signage": EventType.MISSING_SIGNAGE,
    "damaged_signboard": EventType.DAMAGED_SIGNBOARD,
    "damaged_divider": EventType.DAMAGED_DIVIDER,
    "missing_zebra": EventType.MISSING_ZEBRA,
    "license_plate": EventType.LICENSE_PLATE,
}

INTELLIGENCE_EVENT_MAP = {
    "rash_driving": EventType.RASH_DRIVING,
    "close_call": EventType.CLOSE_CALL,
    "pedestrian_risk": EventType.PEDESTRIAN_RISK,
    "traffic_bottleneck": EventType.TRAFFIC_BOTTLENECK,
}

# High priority real-world defects (need logging even with 1 frame)
HIGH_PRIORITY_TYPES = {
    "pothole", "road_damage", "waterlogging", "missing_signage", "damaged_signboard",
    "damaged_divider", "missing_zebra", "rash_driving", "close_call",
    "traffic_bottleneck", "pedestrian_risk"
}

# Event types that we want to persist individually
PERSIST_TYPES = {
    "pothole", "road_damage", "waterlogging", "missing_signage", "damaged_signboard",
    "damaged_divider", "missing_zebra", "license_plate"
}


def _classify_severity(confidence: float, event_type: str) -> SeverityLevel:
    """Determine severity based on confidence and event type."""
    if event_type in ("close_call", "rash_driving"):
        if confidence > 0.8:
            return SeverityLevel.CRITICAL
        return SeverityLevel.HIGH
    elif event_type in ("pedestrian_risk",):
        if confidence > 0.7:
            return SeverityLevel.HIGH
        return SeverityLevel.MEDIUM
    elif event_type in ("pothole", "road_damage"):
        if confidence > 0.8:
            return SeverityLevel.HIGH
        elif confidence > 0.5:
            return SeverityLevel.MEDIUM
        return SeverityLevel.LOW
    else:
        if confidence > 0.8:
            return SeverityLevel.MEDIUM
        return SeverityLevel.LOW


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two lat/lon points."""
    R = 6371000  # radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


class EventFusionEngine:
    """
    Fuses AI detection output + real GPS coordinates + real timestamp + real evidence
    into DetectionEvent database records.
    """

    def __init__(self, geocoder: ReverseGeocoder):
        self.geocoder = geocoder
        self._ws_callbacks: list = []  # Callbacks for real-time WebSocket push
        self._last_event_times: dict[str, float] = {}
        # List of (event_type_str, lat, lon, timestamp)
        self._spatial_history: list[tuple[str, float, float, float]] = []
        self._cooldown_seconds: float = 2.0
        self._spatial_threshold_meters: float = 5.0  # Ignore same event within 5 meters

    def register_ws_callback(self, callback):
        """Register a callback to push events to WebSocket clients."""
        self._ws_callbacks.append(callback)

    def unregister_ws_callback(self, callback):
        if callback in self._ws_callbacks:
            self._ws_callbacks.remove(callback)

    async def fuse_and_persist(
        self,
        result: RawDetectionResult,
        location: Optional[LocationReading],
        session_id: Optional[uuid.UUID],
        db: AsyncSession,
        skip_debounce: bool = False,
        persist_all: bool = False
    ) -> list[DetectionEvent]:
        """
        Fuse AI results with location data and persist to database.
        Only creates records from REAL detections.
        """
        created_events = []

        # Get address via reverse geocoding (if location available)
        address = None
        if location:
            address = await self.geocoder.reverse_geocode(location.latitude, location.longitude)

        # Persist significant individual detections (road defects, plates)
        for det in result.detections:
            if not persist_all and det.class_name not in PERSIST_TYPES:
                continue

            event_type = CLASS_TO_EVENT_TYPE.get(det.class_name)
            if not event_type:
                continue

            # Debounce check to prevent capturing the same event many times in video
            event_key = event_type.value if hasattr(event_type, "value") else event_type
            
            is_spatial_dup = False
            if location and not skip_debounce:
                # Spatial Deduplication: Check if we already logged this event type within 20 meters recently
                for hist_event, hist_lat, hist_lon, hist_time in reversed(self._spatial_history):
                    if hist_event == event_key:
                        dist = _haversine_distance(location.latitude, location.longitude, hist_lat, hist_lon)
                        if dist < self._spatial_threshold_meters:
                            is_spatial_dup = True
                            break
            
            if is_spatial_dup:
                continue

            last_time = self._last_event_times.get(event_key, 0)
            if not location and not skip_debounce and result.timestamp - last_time < self._cooldown_seconds:
                # Fallback to pure temporal debounce if no GPS
                continue
            
            self._last_event_times[event_key] = result.timestamp
            if location:
                self._spatial_history.append((event_key, location.latitude, location.longitude, result.timestamp))
                # Keep history size manageable
                if len(self._spatial_history) > 100:
                    self._spatial_history.pop(0)

            evidence_key = f"{det.class_name}_{result.frame_number}"
            evidence_path = result.evidence_paths.get(evidence_key)

            event = DetectionEvent(
                id=uuid.uuid4(),
                session_id=session_id,
                event_type=event_type,
                confidence=det.confidence,
                severity=_classify_severity(det.confidence, det.class_name),
                bbox={
                    "x1": det.bbox[0], "y1": det.bbox[1],
                    "x2": det.bbox[2], "y2": det.bbox[3]
                },
                latitude=location.latitude if location else None,
                longitude=location.longitude if location else None,
                location_accuracy=location.accuracy_meters if location else None,
                location_source=location.source_type if location else None,
                address=address,
                evidence_path=evidence_path,
                event_metadata={
                    "model_source": det.model_source,
                    "track_id": det.track_id,
                    "frame_number": result.frame_number,
                },
                detected_at=datetime.fromtimestamp(result.timestamp, tz=timezone.utc),
            )
            # Use PostGIS point if coordinates are available
            if location:
                event.location = func.ST_SetSRID(
                    func.ST_MakePoint(location.longitude, location.latitude), 4326
                )

            db.add(event)
            created_events.append(event)

        # Persist intelligence events
        for intel_event in result.intelligence_events:
            event_type = INTELLIGENCE_EVENT_MAP.get(intel_event.event_type)
            if not event_type:
                continue

            # Debounce check
            event_key = event_type.value if hasattr(event_type, "value") else event_type
            
            is_spatial_dup = False
            if location and not skip_debounce:
                # Spatial Deduplication: Check if we already logged this event type within 20 meters recently
                for hist_event, hist_lat, hist_lon, hist_time in reversed(self._spatial_history):
                    if hist_event == event_key:
                        dist = _haversine_distance(location.latitude, location.longitude, hist_lat, hist_lon)
                        if dist < self._spatial_threshold_meters:
                            is_spatial_dup = True
                            break
            
            if is_spatial_dup:
                continue

            last_time = self._last_event_times.get(event_key, 0)
            if not location and not skip_debounce and result.timestamp - last_time < self._cooldown_seconds:
                continue
            
            self._last_event_times[event_key] = result.timestamp
            if location:
                self._spatial_history.append((event_key, location.latitude, location.longitude, result.timestamp))
                if len(self._spatial_history) > 100:
                    self._spatial_history.pop(0)

            evidence_key = f"{intel_event.event_type}_{result.frame_number}"
            evidence_path = result.evidence_paths.get(evidence_key)

            event = DetectionEvent(
                id=uuid.uuid4(),
                session_id=session_id,
                event_type=event_type,
                confidence=intel_event.confidence,
                severity=_classify_severity(intel_event.confidence, intel_event.event_type),
                latitude=location.latitude if location else None,
                longitude=location.longitude if location else None,
                location_accuracy=location.accuracy_meters if location else None,
                location_source=location.source_type if location else None,
                address=address,
                evidence_path=evidence_path,
                event_metadata={
                    **intel_event.metadata,
                    "description": intel_event.description,
                    "involved_track_ids": intel_event.involved_track_ids,
                    "frame_number": result.frame_number,
                },
                detected_at=datetime.fromtimestamp(result.timestamp, tz=timezone.utc),
            )
            if location:
                event.location = func.ST_SetSRID(
                    func.ST_MakePoint(location.longitude, location.latitude), 4326
                )

            db.add(event)
            created_events.append(event)

        # Persist plate readings (linked to hit-and-run if applicable)
        for plate in result.plate_readings:
            event = DetectionEvent(
                id=uuid.uuid4(),
                session_id=session_id,
                event_type=EventType.LICENSE_PLATE,
                confidence=plate.confidence,
                severity=SeverityLevel.MEDIUM,
                bbox={"x1": plate.bbox[0], "y1": plate.bbox[1],
                      "x2": plate.bbox[2], "y2": plate.bbox[3]},
                latitude=location.latitude if location else None,
                longitude=location.longitude if location else None,
                location_accuracy=location.accuracy_meters if location else None,
                location_source=location.source_type if location else None,
                address=address,
                evidence_path=result.evidence_paths.get(f"license_plate_{result.frame_number}"),
                event_metadata={
                    "plate_text": plate.plate_text,
                    "ocr_confidence": plate.confidence,
                    "detection_confidence": plate.detection_confidence,
                    "frame_number": result.frame_number,
                },
                detected_at=datetime.fromtimestamp(result.timestamp, tz=timezone.utc),
            )
            if location:
                event.location = func.ST_SetSRID(
                    func.ST_MakePoint(location.longitude, location.latitude), 4326
                )
            db.add(event)
            created_events.append(event)

        # Update session detection count
        if session_id and created_events:
            session = await db.get(DetectionSession, session_id)
            if session:
                session.total_detections += len(created_events)
                session.total_frames_processed = result.frame_number

        if created_events:
            await db.commit()

            # Push events to WebSocket clients
            for event in created_events:
                ws_msg = self._event_to_ws(event)
                for callback in self._ws_callbacks:
                    try:
                        await callback(ws_msg)
                    except Exception as e:
                        logger.error(f"WebSocket callback error: {e}")

        return created_events

    async def sync_offline_events(
        self, events_data: list[dict], db: AsyncSession
    ) -> list[DetectionEvent]:
        """
        Sync events that were cached offline on the client.
        These events have pre-computed coordinates and evidence.
        """
        created = []
        for data in events_data:
            try:
                event_type = EventType(data["event_type"])
                event = DetectionEvent(
                    id=uuid.uuid4(),
                    session_id=uuid.UUID(data["session_id"]) if data.get("session_id") else None,
                    event_type=event_type,
                    confidence=data["confidence"],
                    severity=SeverityLevel(data.get("severity", "medium")),
                    latitude=data.get("latitude"),
                    longitude=data.get("longitude"),
                    location_accuracy=data.get("location_accuracy"),
                    location_source=data.get("location_source"),
                    address=data.get("address"),
                    event_metadata=data.get("metadata", {}),
                    detected_at=datetime.fromisoformat(data["detected_at"]) if data.get("detected_at") else datetime.now(timezone.utc),
                )

                # Save evidence if base64 is provided
                if data.get("evidence_base64"):
                    evidence_path = self._save_base64_evidence(data["evidence_base64"], event_type.value)
                    event.evidence_path = evidence_path

                if event.latitude and event.longitude:
                    event.location = func.ST_SetSRID(
                        func.ST_MakePoint(event.longitude, event.latitude), 4326
                    )
                    # Get address if not provided
                    if not event.address:
                        event.address = await self.geocoder.reverse_geocode(
                            event.latitude, event.longitude
                        )

                db.add(event)
                created.append(event)
            except Exception as e:
                logger.error(f"Error syncing offline event: {e}")

        if created:
            await db.commit()

        return created

    def _save_base64_evidence(self, base64_data: str, event_type: str) -> Optional[str]:
        """Save base64-encoded evidence image to disk."""
        try:
            if "," in base64_data:
                base64_data = base64_data.split(",", 1)[1]

            img_bytes = base64.b64decode(base64_data)
            filename = f"offline_{event_type}_{uuid.uuid4().hex[:8]}.jpg"
            filepath = os.path.join(settings.EVIDENCE_DIR, filename)
            os.makedirs(settings.EVIDENCE_DIR, exist_ok=True)
            with open(filepath, "wb") as f:
                f.write(img_bytes)
            return filename
        except Exception as e:
            logger.error(f"Error saving base64 evidence: {e}")
            return None

    @staticmethod
    def _event_to_ws(event: DetectionEvent) -> dict:
        """Convert a persisted event to a WebSocket message."""
        return {
            "type": "new_event",
            "event": {
                "id": str(event.id),
                "event_type": event.event_type.value if isinstance(event.event_type, EventType) else event.event_type,
                "confidence": event.confidence,
                "severity": event.severity.value if isinstance(event.severity, SeverityLevel) else event.severity,
                "latitude": event.latitude,
                "longitude": event.longitude,
                "location_accuracy": event.location_accuracy,
                "address": event.address,
                "evidence_path": event.evidence_path,
                "metadata": event.event_metadata,
                "detected_at": event.detected_at.isoformat() if event.detected_at else None,
            }
        }
