"""
Road Health Score computation service.
Documented scoring formula — NOT a hardcoded number.

Score = 100 - Σ(severity_weight[i] × count[i] × recency_factor[i]) / area_normalization
Clamped to [0, 100].
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from ..models.event import DetectionEvent, EventType
from ..models.road_health import RoadHealthRecord
from ..config import settings

logger = logging.getLogger(__name__)

# Severity weights by event type — determines how much each defect type
# impacts the road health score
SEVERITY_WEIGHTS = {
    EventType.POTHOLE: settings.RH_WEIGHT_POTHOLE,          # 10 — most dangerous
    EventType.ROAD_DAMAGE: settings.RH_WEIGHT_ROAD_DAMAGE,  # 8
    EventType.WATERLOGGING: settings.RH_WEIGHT_WATERLOGGING,     # 8
    EventType.MISSING_SIGNAGE: settings.RH_WEIGHT_MISSING_SIGNAGE, # 7
    EventType.DAMAGED_SIGNBOARD: settings.RH_WEIGHT_DAMAGED_SIGNBOARD, # 7
    EventType.DAMAGED_DIVIDER: settings.RH_WEIGHT_DAMAGED_DIVIDER, # 5
    EventType.MISSING_ZEBRA: settings.RH_WEIGHT_MISSING_ZEBRA,     # 4
}

# Only these event types affect road health (infrastructure defects)
ROAD_DEFECT_TYPES = list(SEVERITY_WEIGHTS.keys())


def compute_recency_factor(detected_at: datetime) -> float:
    """
    Newer detections have more weight.
    < 7 days: 1.0 (full weight)
    7-30 days: 0.5
    > 30 days: 0.2
    """
    now = datetime.now(timezone.utc)
    age = now - detected_at
    if age < timedelta(days=7):
        return 1.0
    elif age < timedelta(days=30):
        return 0.5
    else:
        return 0.2


class RoadHealthService:
    """
    Computes Road Health Scores from REAL accumulated detection event data.
    Every score displayed is computed from actual detections, never fabricated.
    """

    # Normalization constant — baseline for a ~1km road segment
    AREA_NORMALIZATION = 50.0

    async def compute_overall_score(self, db: AsyncSession) -> Optional[float]:
        """
        Compute the overall road health score from all detection events.
        Returns None if no relevant events exist (no data = no score).
        """
        events = await self._get_defect_events(db)
        if not events:
            return None  # No data — show empty state, not a fake number

        total_penalty = 0.0
        for event in events:
            weight = SEVERITY_WEIGHTS.get(event.event_type, 0.0)
            recency = compute_recency_factor(event.detected_at)
            total_penalty += weight * recency

        score = max(0.0, min(100.0, 100.0 - (total_penalty / self.AREA_NORMALIZATION)))
        return round(score, 1)

    async def compute_area_score(
        self, db: AsyncSession, area_name: str,
        center_lat: float, center_lng: float, radius_km: float = 1.0
    ) -> RoadHealthRecord:
        """
        Compute road health score for a specific area around a GPS point.
        Uses PostGIS spatial queries for accurate geofencing.
        """
        # Query events within the radius using PostGIS
        radius_meters = radius_km * 1000
        point = func.ST_SetSRID(func.ST_MakePoint(center_lng, center_lat), 4326)
        geog_point = func.ST_Transform(point, 4326)

        query = select(DetectionEvent).where(
            and_(
                DetectionEvent.event_type.in_(ROAD_DEFECT_TYPES),
                DetectionEvent.location.isnot(None),
                func.ST_DWithin(
                    func.cast(DetectionEvent.location, func.Geography),
                    func.cast(point, func.Geography),
                    radius_meters
                )
            )
        )

        try:
            result = await db.execute(query)
            events = result.scalars().all()
        except Exception as e:
            logger.warning(f"PostGIS spatial query failed, falling back to lat/lng filter: {e}")
            # Fallback: simple bounding box filter
            events = await self._get_defect_events_bbox(
                db, center_lat, center_lng, radius_km
            )

        # Count by type
        counts = {t: 0 for t in ROAD_DEFECT_TYPES}
        total_penalty = 0.0

        for event in events:
            if event.event_type in counts:
                counts[event.event_type] += 1
                weight = SEVERITY_WEIGHTS.get(event.event_type, 0.0)
                recency = compute_recency_factor(event.detected_at)
                total_penalty += weight * recency

        score = max(0.0, min(100.0, 100.0 - (total_penalty / self.AREA_NORMALIZATION)))

        record = RoadHealthRecord(
            area_name=area_name,
            center_lat=center_lat,
            center_lng=center_lng,
            score=round(score, 1),
            pothole_count=counts.get(EventType.POTHOLE, 0),
            damage_count=counts.get(EventType.ROAD_DAMAGE, 0),
            waterlog_count=counts.get(EventType.WATERLOGGING, 0),
            signage_issues=counts.get(EventType.MISSING_SIGNAGE, 0) + counts.get(EventType.DAMAGED_SIGNBOARD, 0),
            divider_issues=counts.get(EventType.DAMAGED_DIVIDER, 0),
            zebra_issues=counts.get(EventType.MISSING_ZEBRA, 0),
            computation_details={
                "formula": "Score = 100 - Σ(weight × recency) / normalization",
                "weights": {k.value: v for k, v in SEVERITY_WEIGHTS.items()},
                "normalization": self.AREA_NORMALIZATION,
                "total_events": len(events),
                "total_penalty": round(total_penalty, 2),
                "recency_rules": {
                    "< 7 days": 1.0,
                    "7-30 days": 0.5,
                    "> 30 days": 0.2
                }
            }
        )

        # Save to database
        db.add(record)
        await db.commit()
        await db.refresh(record)

        return record

    async def get_recent_scores(self, db: AsyncSession, limit: int = 10) -> list[RoadHealthRecord]:
        """Get recent road health score records."""
        query = select(RoadHealthRecord).order_by(
            RoadHealthRecord.computed_at.desc()
        ).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_defect_counts(self, db: AsyncSession) -> dict:
        """Get counts of each road defect type."""
        counts = {}
        for defect_type in ROAD_DEFECT_TYPES:
            query = select(func.count()).where(
                DetectionEvent.event_type == defect_type
            )
            result = await db.execute(query)
            counts[defect_type.value] = result.scalar() or 0
        return counts

    async def _get_defect_events(self, db: AsyncSession) -> list[DetectionEvent]:
        """Get all road defect detection events."""
        query = select(DetectionEvent).where(
            DetectionEvent.event_type.in_(ROAD_DEFECT_TYPES)
        ).order_by(DetectionEvent.detected_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    async def _get_defect_events_bbox(
        self, db: AsyncSession,
        center_lat: float, center_lng: float, radius_km: float
    ) -> list[DetectionEvent]:
        """Fallback: get events within a bounding box (no PostGIS spatial query)."""
        # Approximate degrees per km at the given latitude
        lat_range = radius_km / 111.0
        lng_range = radius_km / (111.0 * abs(max(0.01, __import__("math").cos(__import__("math").radians(center_lat)))))

        query = select(DetectionEvent).where(
            and_(
                DetectionEvent.event_type.in_(ROAD_DEFECT_TYPES),
                DetectionEvent.latitude.isnot(None),
                DetectionEvent.latitude.between(center_lat - lat_range, center_lat + lat_range),
                DetectionEvent.longitude.between(center_lng - lng_range, center_lng + lng_range),
            )
        )
        result = await db.execute(query)
        return list(result.scalars().all())
