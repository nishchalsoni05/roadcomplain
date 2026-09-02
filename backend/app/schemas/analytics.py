"""
Pydantic schemas for analytics endpoints.
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class SummaryStats(BaseModel):
    total_events_today: int = 0
    active_sessions: int = 0
    total_sessions: int = 0
    current_road_health_score: Optional[float] = None
    total_potholes: int = 0
    total_road_damage: int = 0
    total_incidents: int = 0
    total_pedestrian_risks: int = 0


class RoadHealthResponse(BaseModel):
    id: UUID
    area_name: str
    score: float
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    pothole_count: int = 0
    damage_count: int = 0
    waterlog_count: int = 0
    signage_issues: int = 0
    divider_issues: int = 0
    zebra_issues: int = 0
    computation_details: Optional[dict] = None
    computed_at: datetime

    model_config = {"from_attributes": True}


class TrendDataPoint(BaseModel):
    date: str
    count: int
    road_health_score: Optional[float] = None


class DistributionItem(BaseModel):
    event_type: str
    count: int
    percentage: float


class AnalyticsTrends(BaseModel):
    trends: list[TrendDataPoint]
    distribution: list[DistributionItem]
    period: str = "30d"
