"""
Pydantic schemas for DetectionEvent API request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from uuid import UUID


class BBoxSchema(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class LocationSchema(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    source: Optional[str] = None  # "gps", "wifi", "ip"


class EventCreate(BaseModel):
    session_id: Optional[UUID] = None
    event_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    severity: str = "medium"
    bbox: Optional[dict] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    location_source: Optional[str] = None
    address: Optional[str] = None
    evidence_base64: Optional[str] = None  # For offline sync
    metadata: Optional[dict] = None
    detected_at: Optional[datetime] = None


class EventResponse(BaseModel):
    id: UUID
    session_id: Optional[UUID] = None
    event_type: str
    confidence: float
    severity: str
    bbox: Optional[dict] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    location_source: Optional[str] = None
    address: Optional[str] = None
    evidence_url: Optional[str] = None
    metadata: Optional[dict] = None
    detected_at: datetime
    created_at: datetime
    is_favorite: bool = False

    model_config = {"from_attributes": True}


class EventListResponse(BaseModel):
    events: list[EventResponse]
    total: int
    page: int = 1
    page_size: int = 50


class EventFilter(BaseModel):
    event_type: Optional[str] = None
    severity: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    min_lat: Optional[float] = None
    max_lat: Optional[float] = None
    min_lng: Optional[float] = None
    max_lng: Optional[float] = None
    session_id: Optional[UUID] = None
    min_confidence: Optional[float] = None


class EventSyncRequest(BaseModel):
    """Batch of events from offline queue."""
    events: list[EventCreate]
