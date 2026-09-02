"""
API routes for detection events — CRUD operations with filtering.
All data comes from real AI detections stored in PostGIS.
"""
from uuid import UUID
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from ..database import get_db
from ..models.event import DetectionEvent, EventType
from ..schemas.event import EventResponse, EventListResponse, EventSyncRequest
from ..services.event_fusion import EventFusionEngine
from ..services.geocoder import ReverseGeocoder

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=EventListResponse)
async def list_events(
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    session_id: Optional[UUID] = None,
    min_confidence: Optional[float] = None,
    min_lat: Optional[float] = None,
    max_lat: Optional[float] = None,
    min_lng: Optional[float] = None,
    max_lng: Optional[float] = None,
    is_favorite: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List detection events with filtering. All results from real detections."""
    query = select(DetectionEvent)
    count_query = select(func.count(DetectionEvent.id))
    conditions = []

    if event_type:
        try:
            et = EventType(event_type)
            conditions.append(DetectionEvent.event_type == et)
        except ValueError:
            pass

    if severity:
        conditions.append(DetectionEvent.severity == severity)

    if date_from:
        conditions.append(DetectionEvent.detected_at >= date_from)

    if date_to:
        conditions.append(DetectionEvent.detected_at <= date_to)

    if session_id:
        conditions.append(DetectionEvent.session_id == session_id)

    if min_confidence:
        conditions.append(DetectionEvent.confidence >= min_confidence)

    if min_lat is not None and max_lat is not None:
        conditions.append(DetectionEvent.latitude.between(min_lat, max_lat))

    if min_lng is not None and max_lng is not None:
        conditions.append(DetectionEvent.longitude.between(min_lng, max_lng))

    if is_favorite is not None:
        conditions.append(DetectionEvent.is_favorite == is_favorite)

    if conditions:
        query = query.where(and_(*conditions))
        count_query = count_query.where(and_(*conditions))

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    offset = (page - 1) * page_size
    query = query.order_by(desc(DetectionEvent.detected_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    events = result.scalars().all()

    return EventListResponse(
        events=[_to_response(e) for e in events],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a single detection event by ID."""
    event = await db.get(DetectionEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _to_response(event)


@router.post("/sync")
async def sync_offline_events(
    request: EventSyncRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Sync events from offline queue.
    The frontend caches events when offline and sends them here on reconnect.
    """
    geocoder = ReverseGeocoder()
    fusion = EventFusionEngine(geocoder)

    events_data = [e.model_dump() for e in request.events]
    created = await fusion.sync_offline_events(events_data, db)

    await geocoder.close()
    return {"synced": len(created), "message": f"Successfully synced {len(created)} offline events"}


@router.delete("/{event_id}")
async def delete_event(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a detection event."""
    event = await db.get(DetectionEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event)
    await db.commit()
    return {"deleted": True}


@router.patch("/{event_id}/favorite")
async def toggle_favorite(event_id: UUID, is_favorite: bool, db: AsyncSession = Depends(get_db)):
    """Toggle the favorite status of a detection event."""
    event = await db.get(DetectionEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.is_favorite = is_favorite
    await db.commit()
    return {"id": event.id, "is_favorite": event.is_favorite}


def _to_response(event: DetectionEvent) -> EventResponse:
    """Convert ORM model to response schema."""
    evidence_url = f"/api/evidence/{event.evidence_path}" if event.evidence_path else None
    return EventResponse(
        id=event.id,
        session_id=event.session_id,
        event_type=event.event_type.value if hasattr(event.event_type, 'value') else str(event.event_type),
        confidence=event.confidence,
        severity=event.severity.value if hasattr(event.severity, 'value') else str(event.severity),
        bbox=event.bbox,
        latitude=event.latitude,
        longitude=event.longitude,
        location_accuracy=event.location_accuracy,
        location_source=event.location_source,
        address=event.address,
        evidence_url=evidence_url,
        metadata=event.event_metadata,
        detected_at=event.detected_at,
        created_at=event.created_at,
        is_favorite=event.is_favorite,
    )
