"""
DetectionEvent model — stores every individual AI detection with geospatial data.
"""
import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Enum, Text, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geography
from ..database import Base


class EventType(str, enum.Enum):
    POTHOLE = "pothole"
    ROAD_DAMAGE = "road_damage"
    WATERLOGGING = "waterlogging"
    VEHICLE = "vehicle"
    PEDESTRIAN = "pedestrian"
    RASH_DRIVING = "rash_driving"
    CLOSE_CALL = "close_call"
    MISSING_SIGNAGE = "missing_signage"
    DAMAGED_DIVIDER = "damaged_divider"
    MISSING_ZEBRA = "missing_zebra"
    LICENSE_PLATE = "license_plate"
    TRAFFIC_BOTTLENECK = "traffic_bottleneck"
    PEDESTRIAN_RISK = "pedestrian_risk"


class SeverityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DetectionEvent(Base):
    __tablename__ = "detection_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # Detection data — all from real AI inference
    event_type = Column(Enum(EventType), nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    severity = Column(Enum(SeverityLevel), nullable=False, default=SeverityLevel.MEDIUM)
    bbox = Column(JSONB, nullable=True)  # {"x1": ..., "y1": ..., "x2": ..., "y2": ...}

    # Geospatial — real GPS/geolocation coordinates
    location = Column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_accuracy = Column(Float, nullable=True)  # meters
    location_source = Column(String(50), nullable=True)  # "gps", "wifi", "ip"
    address = Column(Text, nullable=True)  # Reverse-geocoded address

    # Evidence — real frame crop from actual video
    evidence_path = Column(String(500), nullable=True)

    is_favorite = Column(Boolean, nullable=False, default=False)

    # Flexible metadata (plate number, speed, tracking IDs, etc.)
    event_metadata = Column(JSONB, nullable=True, default=dict)

    # Timestamps
    detected_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    # Indexes for geospatial queries
    __table_args__ = (
        Index("idx_events_location", location, postgresql_using="gist"),
        Index("idx_events_detected_at", detected_at),
        Index("idx_events_type_date", event_type, detected_at),
    )

    def __repr__(self):
        return f"<DetectionEvent {self.event_type.value} conf={self.confidence:.2f}>"
