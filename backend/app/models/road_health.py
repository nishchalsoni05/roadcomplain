"""
RoadHealthRecord model — stores computed road health scores per area.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry
from ..database import Base


class RoadHealthRecord(Base):
    __tablename__ = "road_health_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Area definition
    area_name = Column(String(255), nullable=False, index=True)
    area_geom = Column(Geometry(geometry_type="POLYGON", srid=4326), nullable=True)
    center_lat = Column(Float, nullable=True)
    center_lng = Column(Float, nullable=True)

    # Health score — computed from real detection data
    score = Column(Float, nullable=False)  # 0-100, higher = healthier

    # Breakdown counts — from real detections in this area
    pothole_count = Column(Integer, nullable=False, default=0)
    damage_count = Column(Integer, nullable=False, default=0)
    waterlog_count = Column(Integer, nullable=False, default=0)
    signage_issues = Column(Integer, nullable=False, default=0)
    divider_issues = Column(Integer, nullable=False, default=0)
    zebra_issues = Column(Integer, nullable=False, default=0)

    # Computation metadata
    computation_details = Column(JSONB, nullable=True)  # Full formula breakdown
    computed_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<RoadHealthRecord {self.area_name} score={self.score:.1f}>"
