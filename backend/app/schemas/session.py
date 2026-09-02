"""
Pydantic schemas for DetectionSession API.
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class SessionCreate(BaseModel):
    source_type: str
    name: Optional[str] = None
    description: Optional[str] = None
    source_info: Optional[dict] = None


class SessionResponse(BaseModel):
    id: UUID
    source_type: str
    status: str
    name: Optional[str] = None
    description: Optional[str] = None
    source_info: Optional[dict] = None
    total_detections: int
    total_frames_processed: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]
    total: int
