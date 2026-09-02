"""
DetectionSession model — represents a single test/detection run.
"""
import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Enum, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from ..database import Base


class SourceType(str, enum.Enum):
    PHONE_CAMERA = "phone_camera"
    WEBCAM = "webcam"
    IP_CAMERA = "ip_camera"
    UPLOADED_VIDEO = "uploaded_video"


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ERROR = "error"
    PROCESSING = "processing"


class DetectionSession(Base):
    __tablename__ = "detection_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type = Column(Enum(SourceType), nullable=False)
    status = Column(Enum(SessionStatus), nullable=False, default=SessionStatus.ACTIVE)

    # Session metadata
    name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    source_info = Column(JSONB, nullable=True)  # e.g., {"url": "rtsp://...", "filename": "dash.mp4"}

    # Computed stats — updated in real-time from actual detections
    total_detections = Column(Integer, nullable=False, default=0)
    total_frames_processed = Column(Integer, nullable=False, default=0)

    # Timestamps
    started_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<DetectionSession {self.source_type.value} detections={self.total_detections}>"
