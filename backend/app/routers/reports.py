"""
PDF report download endpoints.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.event import DetectionEvent
from ..models.session import DetectionSession
from ..services.pdf_report import PDFReportGenerator

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{event_id}/pdf")
async def download_event_report(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate and download a PDF report for a single detection event."""
    event = await db.get(DetectionEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    pdf_bytes = PDFReportGenerator.generate_event_report(event)
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="PDF generation failed — reportlab may not be installed")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="roadrepair_incident_{event_id}.pdf"'
        }
    )


@router.get("/session/{session_id}/pdf")
async def download_session_report(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Generate and download a PDF report for an entire detection session."""
    session = await db.get(DetectionSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all events for this session
    result = await db.execute(
        select(DetectionEvent)
        .where(DetectionEvent.session_id == session_id)
        .order_by(DetectionEvent.detected_at)
    )
    events = list(result.scalars().all())

    pdf_bytes = PDFReportGenerator.generate_session_report(session, events)
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="PDF generation failed")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="roadrepair_session_{session_id}.pdf"'
        }
    )
