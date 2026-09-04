"""
Video upload endpoint — processes uploaded video through the same AI pipeline as live mode.
"""
import os
import uuid
import aiofiles
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, WebSocket
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db, AsyncSessionLocal
from ..models.session import DetectionSession, SourceType, SessionStatus
from ..ai.pipeline import AIPipeline
from ..ai.video_source import UploadedVideoSource
from ..ai.location_provider import BrowserGeolocationProvider, LocationReading
from ..services.event_fusion import EventFusionEngine
from ..services.geocoder import ReverseGeocoder
from ..config import settings
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/upload", tags=["upload"])

# Shared pipeline instance
_pipeline: AIPipeline = None


async def get_pipeline() -> AIPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = AIPipeline()
        await _pipeline.initialize()
    return _pipeline


@router.post("/video")
async def upload_video(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a video or image file for AI analysis.
    Runs the same AI pipeline as live detection mode.
    Returns session ID — results stream via WebSocket or can be polled.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Save uploaded file
    upload_dir = os.path.join(settings.EVIDENCE_DIR, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1] or ".mp4"
    saved_filename = f"{uuid.uuid4().hex}{file_ext}"
    saved_path = os.path.join(upload_dir, saved_filename)

    async with aiofiles.open(saved_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    # Create session
    session = DetectionSession(
        source_type=SourceType.UPLOADED_VIDEO,
        name=file.filename,
        status=SessionStatus.PROCESSING,
        source_info={"filename": file.filename, "saved_path": saved_path},
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return {
        "session_id": str(session.id),
        "filename": file.filename,
        "status": "processing",
        "message": "Video uploaded. Connect to /ws/process/{session_id} for real-time results."
    }


@router.websocket("/ws/process/{session_id}")
async def process_uploaded_video_ws(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint to process an uploaded video and stream results.
    Client connects here after uploading to receive real-time detection results.
    """
    await websocket.accept()

    try:
        async with AsyncSessionLocal() as db:
            session = await db.get(DetectionSession, uuid.UUID(session_id))
            if not session or not session.source_info:
                await websocket.send_json({"type": "error", "message": "Session not found"})
                return

            saved_path = session.source_info.get("saved_path")
            if not saved_path or not os.path.exists(saved_path):
                await websocket.send_json({"type": "error", "message": "Video file not found"})
                return

            # Initialize pipeline
            pipeline = await get_pipeline()
            pipeline.reset()

            # Set up video or image source
            is_image = saved_path.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))
            
            # Setup services
            geocoder = ReverseGeocoder()
            fusion = EventFusionEngine(geocoder)
            
            if is_image:
                import cv2
                import time
                from ..ai.video_source import FrameData
                from ..ai.scene_analysis import (
                    detect_waterlogging, detect_vehicle_damage,
                    detect_missing_zebra, detect_damaged_divider, detect_damaged_signboard
                )
                from ..ai.detector import Detection
                from ..ai.intelligence import IntelligenceEvent
                
                frame = cv2.imread(saved_path)
                if frame is None:
                    await websocket.send_json({"type": "error", "message": "Failed to read image"})
                    return
                
                logger.info(f"Processing uploaded image: {saved_path} shape={frame.shape}")
                    
                frame_data = FrameData(
                    frame=frame,
                    frame_number=1,
                    timestamp=time.time(),
                    source_type="uploaded_image"
                )
                
                # For single images, use detect() directly (not tracking)
                # Tracking is designed for video sequences and can fail on single frames
                detections = pipeline.detector.detect(frame)
                logger.info(f"YOLO detections: {len(detections)} - types: {[d.class_name for d in detections]}")
                
                # Run scene analysis fallbacks
                yolo_types = {d.class_name for d in detections}
                
                # Waterlogging scene analysis
                if 'waterlogging' not in yolo_types:
                    scene_water = detect_waterlogging(frame)
                    for sw in scene_water:
                        det = Detection(
                            class_id=900,
                            class_name=sw.class_name,
                            confidence=sw.confidence,
                            bbox=sw.bbox,
                            model_source="scene_analysis_cv"
                        )
                        detections.append(det)
                        logger.info(f"Scene analysis added: {sw.class_name} ({sw.confidence})")
                
                # Vehicle damage scene analysis
                vehicle_dets = [d for d in detections if d.class_name in ('car', 'truck', 'bus', 'motorcycle')]
                intel_events = []
                if vehicle_dets:
                    scene_damage = detect_vehicle_damage(frame, vehicle_dets)
                    for sd in scene_damage:
                        intel_events.append(IntelligenceEvent(
                            event_type="close_call",
                            confidence=sd.confidence,
                            description=sd.description,
                            metadata={"source": "scene_analysis", "type": "vehicle_damage"}
                        ))
                        logger.info(f"Scene analysis added: vehicle_damage ({sd.confidence})")
                
                # Missing Zebra Crossing fallback
                traffic_light_dets = [d for d in detections if d.class_name == 'traffic_light']
                if traffic_light_dets and 'missing_zebra' not in yolo_types:
                    missing_zebras = detect_missing_zebra(frame, traffic_light_dets)
                    for mz in missing_zebras:
                        detections.append(Detection(
                            class_id=901, class_name=mz.class_name,
                            confidence=mz.confidence, bbox=mz.bbox, model_source="scene_analysis_cv"
                        ))
                        logger.info(f"Scene analysis added: {mz.class_name}")

                # Damaged Divider fallback
                if 'damaged_divider' not in yolo_types:
                    damaged_dividers = detect_damaged_divider(frame)
                    for dd in damaged_dividers:
                        detections.append(Detection(
                            class_id=902, class_name=dd.class_name,
                            confidence=dd.confidence, bbox=dd.bbox, model_source="scene_analysis_cv"
                        ))
                        logger.info(f"Scene analysis added: {dd.class_name}")

                # Damaged Signboard fallback
                sign_dets = [d for d in detections if d.class_name in ('traffic_light', 'stop_sign', 'traffic_object')]
                if sign_dets and 'damaged_signboard' not in yolo_types:
                    damaged_signs = detect_damaged_signboard(frame, sign_dets)
                    for ds in damaged_signs:
                        detections.append(Detection(
                            class_id=903, class_name=ds.class_name,
                            confidence=ds.confidence, bbox=ds.bbox, model_source="scene_analysis_cv"
                        ))
                        logger.info(f"Scene analysis added: {ds.class_name}")
                
                # Run ANPR for image
                plate_readings = []
                if pipeline.anpr.is_available:
                    plate_dets = [d for d in detections if d.class_name == "license_plate"]
                    if plate_dets:
                        plate_readings = pipeline.anpr.process_frame(frame, plate_dets)
                        logger.info(f"ANPR read {len(plate_readings)} plates from image")

                # Build result manually
                from ..ai.pipeline import RawDetectionResult
                result = RawDetectionResult(
                    frame_number=1,
                    timestamp=frame_data.timestamp,
                    detections=detections,
                    intelligence_events=intel_events,
                    plate_readings=plate_readings,
                    vehicle_count=len(vehicle_dets),
                    pedestrian_count=len([d for d in detections if d.class_name == 'pedestrian']),
                )
                
                # Save evidence
                evidence_paths = {}
                for det in detections:
                    if is_image or det.class_name in ("pothole", "road_damage", "waterlogging",
                                          "missing_signage", "damaged_signboard", "damaged_divider", "missing_zebra"):
                        evidence_path = pipeline._save_evidence(frame, det.class_name, frame_data.timestamp)
                        if evidence_path:
                            evidence_paths[f"{det.class_name}_1"] = evidence_path
                for evt in intel_events:
                    evidence_path = pipeline._save_evidence(frame, evt.event_type, frame_data.timestamp)
                    if evidence_path:
                        evidence_paths[f"{evt.event_type}_1"] = evidence_path
                result.evidence_paths = evidence_paths
                
                logger.info(f"Final result: {len(result.detections)} detections, {len(result.intelligence_events)} intel events")
                
                total_events = 0
                if result.detections or result.intelligence_events or result.plate_readings:
                    await websocket.send_json(result.to_ws_message())
                    events = await fusion.fuse_and_persist(result, None, session.id, db, skip_debounce=True, persist_all=True)
                    if events:
                        event_types = list(set([e.event_type.value for e in events]))
                        session.description = ", ".join(event_types).replace('_', ' ')
                    total_events += len(events)
                    logger.info(f"Persisted {total_events} events to database from image upload")
                
                await websocket.send_json({
                    "type": "progress",
                    "progress": 100.0,
                    "frame": 1,
                    "events_found": total_events,
                })
                
                session.status = SessionStatus.COMPLETED
                session.ended_at = datetime.now(timezone.utc)
                session.total_detections = total_events
                await db.commit()
                await geocoder.close()
                
                await websocket.send_json({
                    "type": "complete",
                    "total_events": total_events,
                    "session_id": session_id,
                })
                return

            # Set up video source for videos (High FPS for rapid capturing)
            video_source = UploadedVideoSource(saved_path, target_fps=30)
            await video_source.start()

            # Process frames
            total_events = 0
            while video_source.is_active:
                frame_data = await video_source.get_frame()
                if frame_data is None:
                    break

                # Run AI pipeline
                result = await pipeline.process_frame(frame_data)

                # Send detection results to client
                if result.detections or result.intelligence_events or result.plate_readings:
                    await websocket.send_json(result.to_ws_message())

                    # Persist events (no GPS for uploaded video unless provided)
                    events = await fusion.fuse_and_persist(
                        result, None, session.id, db
                    )
                    total_events += len(events)

                # Send progress
                progress = video_source.progress
                await websocket.send_json({
                    "type": "progress",
                    "progress": round(progress * 100, 1),
                    "frame": frame_data.frame_number,
                    "events_found": total_events,
                })

            # Complete
            session.status = SessionStatus.COMPLETED
            session.ended_at = datetime.now(timezone.utc)
            session.total_detections = total_events
            await db.commit()

            await video_source.stop()
            await geocoder.close()

            await websocket.send_json({
                "type": "complete",
                "total_events": total_events,
                "session_id": session_id,
            })

    except Exception as e:
        logger.error(f"Video processing error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass
