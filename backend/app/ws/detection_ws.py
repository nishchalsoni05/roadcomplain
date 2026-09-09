"""
Live Detection WebSocket endpoint.
Receives camera frames + GPS data from browser, runs AI pipeline,
and sends back real-time detection results.
"""
import json
import uuid
import time
import logging
import asyncio
from datetime import datetime, timezone
from fastapi import WebSocket, WebSocketDisconnect
from ..database import AsyncSessionLocal
from ..models.session import DetectionSession, SourceType, SessionStatus
from ..ai.pipeline import AIPipeline
from ..ai.video_source import WebRTCSource, IPCameraSource
from ..ai.location_provider import BrowserGeolocationProvider
from ..services.event_fusion import EventFusionEngine
from ..services.geocoder import ReverseGeocoder

logger = logging.getLogger(__name__)

# Shared AI pipeline (loaded once, reused)
_pipeline: AIPipeline = None


async def get_pipeline() -> AIPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = AIPipeline()
        await _pipeline.initialize()
    return _pipeline


async def detection_websocket(websocket: WebSocket):
    """
    Main WebSocket endpoint for live detection.

    Protocol:
    Client sends JSON messages:
    - {"type": "frame", "data": "<base64 JPEG>"}
    - {"type": "location", "latitude": ..., "longitude": ..., "accuracy": ..., ...}
    - {"type": "start", "source_type": "phone_camera"|"webcam"}
    - {"type": "stop"}

    Server sends JSON messages:
    - {"type": "detection_result", ...}
    - {"type": "new_event", ...}
    - {"type": "session_started", "session_id": "..."}
    - {"type": "error", "message": "..."}
    """
    await websocket.accept()

    pipeline = await get_pipeline()
    video_source = WebRTCSource()
    location_provider = BrowserGeolocationProvider()
    geocoder = ReverseGeocoder()
    fusion = EventFusionEngine(geocoder)

    session_id = None
    processing = False
    video_source = None
    ip_camera_task = None

    # Register WS callback for pushing new events
    async def push_event(event_msg):
        try:
            await websocket.send_json(event_msg)
        except Exception:
            pass

    fusion.register_ws_callback(push_event)

    try:
        while True:
            # Block until at least one message arrives
            data = await websocket.receive_text()
            pending_messages = [data]

            # Drain any additional pending messages in the buffer to prevent latency buildup
            while True:
                try:
                    next_data = await asyncio.wait_for(websocket.receive_text(), timeout=0.005)
                    pending_messages.append(next_data)
                except asyncio.TimeoutError:
                    break

            last_frame_msg = None

            # Process all messages in order
            for d in pending_messages:
                msg = json.loads(d)
                msg_type = msg.get("type")

                if msg_type == "start":
                    # Start a new detection session
                    source_type = msg.get("source_type", "webcam")
                    
                    if source_type == "ip_camera":
                        stream_url = msg.get("url")
                        video_source = IPCameraSource(stream_url)
                    else:
                        video_source = WebRTCSource()

                    async with AsyncSessionLocal() as db:
                        session = DetectionSession(
                            source_type=SourceType(source_type) if source_type != "ip_camera" else SourceType.IP_CAMERA,
                            name=f"Live session {datetime.now().strftime('%H:%M:%S')}",
                        )
                        db.add(session)
                        await db.commit()
                        await db.refresh(session)
                        session_id = session.id

                    await video_source.start()
                    pipeline.reset()
                    processing = True
                    await websocket.send_json({
                        "type": "session_started",
                        "session_id": str(session_id),
                    })

                    # If IP Camera, we need to actively poll it since frames don't come via WebSocket
                    if source_type == "ip_camera":
                        async def poll_ip_camera():
                            import cv2
                            import base64
                            while processing and video_source.is_active:
                                frame_data = await video_source.get_frame()
                                if frame_data:
                                    result = await pipeline.process_frame(frame_data)
                                    ws_msg = result.to_ws_message()
                                    
                                    # Encode frame to send back to UI
                                    _, buffer = cv2.imencode('.jpg', frame_data.frame, [int(cv2.IMWRITE_JPEG_QUALITY), 60])
                                    ws_msg["frame_image"] = base64.b64encode(buffer).decode('utf-8')
                                    
                                    try:
                                        await websocket.send_json(ws_msg)
                                    except Exception:
                                        break
                                        
                                    if result.detections or result.intelligence_events or result.plate_readings:
                                        location = location_provider.get_current()
                                        async with AsyncSessionLocal() as db_session:
                                            await fusion.fuse_and_persist(result, location, session_id, db_session)
                                            
                                await asyncio.sleep(0.1) # Max 10 FPS
                        
                        ip_camera_task = asyncio.create_task(poll_ip_camera())

                elif msg_type == "stop":
                    processing = False
                    if video_source:
                        await video_source.stop()
                    if ip_camera_task:
                        ip_camera_task.cancel()
                    if session_id:
                        async with AsyncSessionLocal() as db:
                            session = await db.get(DetectionSession, session_id)
                            if session:
                                session.status = SessionStatus.COMPLETED
                                session.ended_at = datetime.now(timezone.utc)
                                await db.commit()
                    await websocket.send_json({"type": "session_stopped"})

                elif msg_type == "location":
                    # Update location from browser Geolocation API
                    location_provider.update_from_dict(msg)

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": time.time()})

                elif msg_type == "frame":
                    # Keep track of the latest frame, drop the older ones
                    last_frame_msg = msg

            # Finally, if we received any frames in this batch, process only the freshest one!
            if last_frame_msg and processing:
                frame_data = video_source.push_frame(last_frame_msg.get("data", ""))
                if frame_data:
                    # Run AI pipeline
                    result = await pipeline.process_frame(frame_data)

                    # Send detection results back to client
                    ws_msg = result.to_ws_message()
                    await websocket.send_json(ws_msg)

                    # Fuse with location and persist significant events
                    if result.detections or result.intelligence_events or result.plate_readings:
                        location = location_provider.get_current()
                        async with AsyncSessionLocal() as db:
                            await fusion.fuse_and_persist(
                                result, location, session_id, db
                            )

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
    finally:
        fusion.unregister_ws_callback(push_event)
        if ip_camera_task:
            ip_camera_task.cancel()
        if video_source:
            await video_source.stop()
        await geocoder.close()
        if session_id:
            try:
                async with AsyncSessionLocal() as db:
                    session = await db.get(DetectionSession, session_id)
                    if session and session.status == SessionStatus.ACTIVE:
                        session.status = SessionStatus.COMPLETED
                        session.ended_at = datetime.now(timezone.utc)
                        await db.commit()
            except:
                pass
