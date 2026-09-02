"""
API routes for detection sessions.
"""
from uuid import UUID
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, delete
from ..database import get_db
from ..models.session import DetectionSession, SourceType, SessionStatus
from ..schemas.session import SessionResponse, SessionCreate, SessionListResponse

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse)
async def create_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new detection session."""
    session = DetectionSession(
        source_type=SourceType(data.source_type),
        name=data.name,
        description=data.description,
        source_info=data.source_info,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return _to_response(session)


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List detection sessions."""
    query = select(DetectionSession)
    count_query = select(func.count(DetectionSession.id))

    if status:
        query = query.where(DetectionSession.status == SessionStatus(status))
        count_query = count_query.where(DetectionSession.status == SessionStatus(status))

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.order_by(desc(DetectionSession.started_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    sessions = result.scalars().all()

    return SessionListResponse(
        sessions=[_to_response(s) for s in sessions],
        total=total,
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a session by ID."""
    session = await db.get(DetectionSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _to_response(session)


@router.patch("/{session_id}/end")
async def end_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """End an active detection session."""
    session = await db.get(DetectionSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = SessionStatus.COMPLETED
    session.ended_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ended": True, "session_id": str(session_id)}


@router.delete("/{session_id}")
async def delete_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a session and all its associated events."""
    from ..models.event import DetectionEvent
    session = await db.get(DetectionSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete associated events
    await db.execute(delete(DetectionEvent).where(DetectionEvent.session_id == session_id))
    # Delete session
    await db.delete(session)
    await db.commit()
    return {"deleted": True, "session_id": str(session_id)}


@router.delete("")
async def delete_all_sessions(db: AsyncSession = Depends(get_db)):
    """Delete ALL sessions and their events. Used to clear test history."""
    from ..models.event import DetectionEvent
    await db.execute(delete(DetectionEvent))
    await db.execute(delete(DetectionSession))
    await db.commit()
    return {"deleted": True, "message": "All test history cleared"}


def _to_response(session: DetectionSession) -> SessionResponse:
    return SessionResponse(
        id=session.id,
        source_type=session.source_type.value,
        status=session.status.value,
        name=session.name,
        description=session.description,
        source_info=session.source_info,
        total_detections=session.total_detections,
        total_frames_processed=session.total_frames_processed,
        started_at=session.started_at,
        ended_at=session.ended_at,
        created_at=session.created_at,
    )
