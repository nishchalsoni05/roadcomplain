"""
Analytics API routes — summary stats, road health, trends, distribution.
All data derived from real detection events.
"""
from datetime import datetime, timezone, timedelta
import os
import csv
import random
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
from ..database import get_db
from ..models.event import DetectionEvent, EventType
from ..models.session import DetectionSession, SessionStatus
from ..schemas.analytics import SummaryStats, RoadHealthResponse, TrendDataPoint, DistributionItem, AnalyticsTrends
from ..services.road_health import RoadHealthService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=SummaryStats)
async def get_summary_stats(db: AsyncSession = Depends(get_db)):
    """
    Get real-time summary statistics from actual detection data.
    Returns zeros/None if no detections exist yet — never fabricated numbers.
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Total events today
    today_count = await db.execute(
        select(func.count(DetectionEvent.id)).where(
            DetectionEvent.detected_at >= today_start
        )
    )
    total_today = today_count.scalar() or 0

    # Active sessions
    active_sessions = await db.execute(
        select(func.count(DetectionSession.id)).where(
            DetectionSession.status == SessionStatus.ACTIVE
        )
    )
    active_count = active_sessions.scalar() or 0

    # Total sessions
    total_sessions = await db.execute(select(func.count(DetectionSession.id)))
    total_sess = total_sessions.scalar() or 0

    # Road health score from real data
    rh_service = RoadHealthService()
    health_score = await rh_service.compute_overall_score(db)

    # Specific counts
    counts = {}
    for et in [EventType.POTHOLE, EventType.ROAD_DAMAGE,
               EventType.CLOSE_CALL, EventType.RASH_DRIVING,
               EventType.PEDESTRIAN_RISK]:
        result = await db.execute(
            select(func.count(DetectionEvent.id)).where(
                DetectionEvent.event_type == et
            )
        )
        counts[et.value] = result.scalar() or 0

    return SummaryStats(
        total_events_today=total_today,
        active_sessions=active_count,
        total_sessions=total_sess,
        current_road_health_score=health_score,
        total_potholes=counts.get("pothole", 0),
        total_road_damage=counts.get("road_damage", 0),
        total_incidents=counts.get("close_call", 0) + counts.get("rash_driving", 0),
        total_pedestrian_risks=counts.get("pedestrian_risk", 0),
    )


@router.get("/road-health")
async def get_road_health(db: AsyncSession = Depends(get_db)):
    """Get road health scores — computed from real detection data."""
    rh_service = RoadHealthService()
    scores = await rh_service.get_recent_scores(db, limit=20)
    defect_counts = await rh_service.get_defect_counts(db)
    overall = await rh_service.compute_overall_score(db)

    return {
        "overall_score": overall,
        "area_scores": [
            RoadHealthResponse(
                id=s.id, area_name=s.area_name, score=s.score,
                center_lat=s.center_lat, center_lng=s.center_lng,
                pothole_count=s.pothole_count, damage_count=s.damage_count,
                waterlog_count=s.waterlog_count, signage_issues=s.signage_issues,
                divider_issues=s.divider_issues, zebra_issues=s.zebra_issues,
                computation_details=s.computation_details, computed_at=s.computed_at
            ) for s in scores
        ],
        "defect_counts": defect_counts,
    }


@router.get("/trends", response_model=AnalyticsTrends)
async def get_trends(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detection trends over time — built from real accumulated data.
    Returns empty lists if no data exists.
    """
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    # Daily event counts
    daily_query = select(
        func.date(DetectionEvent.detected_at).label("date"),
        func.count(DetectionEvent.id).label("count")
    ).where(
        DetectionEvent.detected_at >= start_date
    ).group_by(
        func.date(DetectionEvent.detected_at)
    ).order_by(
        func.date(DetectionEvent.detected_at)
    )

    daily_result = await db.execute(daily_query)
    daily_rows = daily_result.all()

    trends = [
        TrendDataPoint(
            date=str(row.date),
            count=row.count,
        )
        for row in daily_rows
    ]

    # Type distribution
    dist_query = select(
        DetectionEvent.event_type,
        func.count(DetectionEvent.id).label("count")
    ).where(
        DetectionEvent.detected_at >= start_date
    ).group_by(
        DetectionEvent.event_type
    )

    dist_result = await db.execute(dist_query)
    dist_rows = dist_result.all()

    total_events = sum(r.count for r in dist_rows) or 1
    distribution = [
        DistributionItem(
            event_type=r.event_type.value if hasattr(r.event_type, 'value') else str(r.event_type),
            count=r.count,
            percentage=round(r.count / total_events * 100, 1)
        )
        for r in dist_rows
    ]

    return AnalyticsTrends(
        trends=trends,
        distribution=distribution,
        period=f"{days}d"
    )

@router.get("/metrics")
async def get_model_metrics():
    """
    Read real training metrics from model_metrics.json (populated from results.csv).
    Returns metrics for all loaded models.
    """
    metrics_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "model_metrics.json")
    
    if not os.path.exists(metrics_path):
        # Fallback to local dir if running directly from backend
        metrics_path = os.path.join(os.getcwd(), "model_metrics.json")

    if not os.path.exists(metrics_path):
        return {
            "status": "unavailable",
            "message": "model_metrics.json not found",
            "metrics": None
        }

    try:
        import json
        with open(metrics_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        return {
            "status": "available",
            "metrics": data
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "metrics": None}


@router.get("/dataset-samples")
async def get_dataset_samples():
    """
    Get a random sample of images from the raw datasets.
    """
    datasets = [
        ("pothole", "Pothole-Detection--9", "dataset_potholes"),
        ("road_damage", "Road-Damage-1", "dataset_road_damage"),
        ("license_plate", "indian-license-plates-1", "dataset_license_plates")
    ]
    
    samples = {}
    
    for key, dir_name, mount_name in datasets:
        dataset_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), dir_name)
        if not os.path.exists(dataset_path):
            dataset_path = os.path.join(os.getcwd(), dir_name)
            
        train_images_dir = os.path.join(dataset_path, "train", "images")
        
        if os.path.exists(train_images_dir):
            try:
                files = [f for f in os.listdir(train_images_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
                # Pick 20 random images
                selected = random.sample(files, min(20, len(files)))
                samples[key] = [f"/api/datasets/{mount_name}/train/images/{f}" for f in selected]
            except Exception as e:
                samples[key] = []
        else:
            samples[key] = []
            
    return samples

