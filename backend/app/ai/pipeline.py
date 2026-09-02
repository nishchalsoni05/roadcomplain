"""
AI Pipeline Orchestrator — connects VideoSource → Detection → Tracking → Intelligence → ANPR.
Produces RawDetectionResult objects for the event fusion engine.
"""
import cv2
import os
import time
import uuid
import numpy as np
import logging
import asyncio
from typing import Optional
from dataclasses import dataclass, field
from ..config import settings
from .video_source import VideoSource, FrameData
from .detector import Detector, Detection
from .tracker import ObjectTracker
from .anpr import ANPRPipeline
from .intelligence import IntelligenceLayer, IntelligenceEvent
from .scene_analysis import detect_waterlogging, detect_vehicle_damage

logger = logging.getLogger(__name__)


@dataclass
class RawDetectionResult:
    """
    Output of a single frame's processing through the AI pipeline.
    Contains ONLY real inference results — never fabricated.
    """
    frame_number: int
    timestamp: float
    detections: list[Detection] = field(default_factory=list)
    intelligence_events: list[IntelligenceEvent] = field(default_factory=list)
    plate_readings: list = field(default_factory=list)  # list[PlateReading]
    vehicle_count: int = 0
    pedestrian_count: int = 0
    evidence_paths: dict = field(default_factory=dict)  # event_key -> saved image path

    def to_ws_message(self) -> dict:
        """Serialize for WebSocket transmission to frontend."""
        return {
            "type": "detection_result",
            "frame_number": self.frame_number,
            "timestamp": self.timestamp,
            "detections": [
                {
                    "class_name": d.class_name,
                    "confidence": round(d.confidence, 3),
                    "bbox": list(d.bbox),
                    "track_id": d.track_id,
                }
                for d in self.detections
            ],
            "intelligence_events": [
                {
                    "event_type": e.event_type,
                    "confidence": round(e.confidence, 3),
                    "description": e.description,
                    "involved_track_ids": e.involved_track_ids,
                }
                for e in self.intelligence_events
            ],
            "plate_readings": [
                pr.to_dict() for pr in self.plate_readings
            ],
            "vehicle_count": self.vehicle_count,
            "pedestrian_count": self.pedestrian_count,
        }


class AIPipeline:
    """
    Main AI pipeline orchestrator.
    Processes video frames through the full detection → tracking → intelligence → ANPR chain.
    """

    def __init__(self):
        self.detector = Detector()
        self.tracker = ObjectTracker()
        self.intelligence = IntelligenceLayer()
        self.anpr: Optional[ANPRPipeline] = None
        self._frame_count = 0
        self._initialized = False

    async def initialize(self):
        """Load all AI models."""
        logger.info("Initializing AI pipeline...")
        await self.detector.load_models()
        self.anpr = ANPRPipeline(self.detector)
        await self.anpr.initialize()
        self._initialized = True
        logger.info("AI pipeline initialized")

    async def process_frame(self, frame_data: FrameData) -> RawDetectionResult:
        """
        Process a single frame through the full AI pipeline.
        Returns ONLY real inference results.
        """
        if not self._initialized:
            return RawDetectionResult(
                frame_number=frame_data.frame_number,
                timestamp=frame_data.timestamp
            )

        self._frame_count += 1
        frame = frame_data.frame

        # Skip frames for performance (process every Nth frame)
        if self._frame_count % settings.FRAME_SKIP != 0:
            return RawDetectionResult(
                frame_number=frame_data.frame_number,
                timestamp=frame_data.timestamp
            )

        loop = asyncio.get_event_loop()

        # Step 1 & 2: Detection with tracking (runs in thread pool to not block event loop)
        detections = await loop.run_in_executor(
            None, self.detector.detect_with_tracking, frame
        )

        # Step 3: Update tracker with new detections
        tracked_objects = self.tracker.update(detections, frame_data.timestamp)

        # Step 4: Run intelligence analysis on tracked state and raw detections
        intel_events = self.intelligence.analyze(self.tracker, detections, frame_data.timestamp)

        # Step 5: Run ANPR if hit-and-run or on-demand
        plate_readings = []
        hit_run_events = [e for e in intel_events if e.event_type == "close_call"]
        if hit_run_events and self.anpr and self.anpr.is_available:
            plate_detections = [d for d in detections if d.class_name == "license_plate"]
            if plate_detections:
                plate_readings = await loop.run_in_executor(
                    None, self.anpr.process_frame, frame, plate_detections
                )

        # Step 6a: Scene analysis fallbacks (OpenCV heuristics for what YOLO misses)
        # Only run if YOLO didn't already detect these types
        yolo_types = {d.class_name for d in detections}
        
        if 'waterlogging' not in yolo_types:
            scene_water = await loop.run_in_executor(
                None, detect_waterlogging, frame
            )
            for sw in scene_water:
                det = Detection(
                    class_id=900,
                    class_name=sw.class_name,
                    confidence=sw.confidence,
                    bbox=sw.bbox,
                    model_source="scene_analysis_cv"
                )
                detections.append(det)
                logger.info(f"Scene analysis added: {sw.class_name} ({sw.confidence:.2f})")
        
        # Check for vehicle damage on detected vehicles
        vehicle_dets = [d for d in detections if d.class_name in ('car', 'truck', 'bus', 'motorcycle')]
        if vehicle_dets:
            scene_damage = await loop.run_in_executor(
                None, detect_vehicle_damage, frame, vehicle_dets
            )
            for sd in scene_damage:
                # Create an intelligence event for vehicle damage
                intel_events.append(IntelligenceEvent(
                    event_type="close_call",
                    confidence=sd.confidence,
                    description=sd.description,
                    metadata={"source": "scene_analysis", "type": "vehicle_damage"}
                ))
                logger.info(f"Scene analysis added: vehicle_damage ({sd.confidence:.2f})")

        # Step 7: Save evidence crops for significant detections
        evidence_paths = {}
        for event in intel_events:
            evidence_path = await loop.run_in_executor(
                None, self._save_evidence, frame, event.event_type, frame_data.timestamp
            )
            if evidence_path:
                evidence_paths[f"{event.event_type}_{frame_data.frame_number}"] = evidence_path

        # Save evidence for road defect detections
        for det in detections:
            if det.class_name in ("pothole", "road_damage", "waterlogging",
                                  "missing_signage", "damaged_divider", "missing_zebra"):
                evidence_path = await loop.run_in_executor(
                    None, self._save_evidence_crop, frame, det
                )
                if evidence_path:
                    evidence_paths[f"{det.class_name}_{frame_data.frame_number}"] = evidence_path

        # Compute counts from tracked objects
        vehicle_count = self.tracker.get_vehicle_count()
        pedestrian_count = len(self.tracker.get_pedestrians())

        # Step 8: Calculate smart AI scores
        self._calculate_smart_scores(detections, frame.shape)

        return RawDetectionResult(
            frame_number=frame_data.frame_number,
            timestamp=frame_data.timestamp,
            detections=detections,
            intelligence_events=intel_events,
            plate_readings=plate_readings,
            vehicle_count=vehicle_count,
            pedestrian_count=pedestrian_count,
            evidence_paths=evidence_paths,
        )

    def _save_evidence(self, frame: np.ndarray, event_type: str, timestamp: float) -> Optional[str]:
        """Save the full frame as evidence for an intelligence event."""
        try:
            os.makedirs(settings.EVIDENCE_DIR, exist_ok=True)
            filename = f"{event_type}_{int(timestamp)}_{uuid.uuid4().hex[:8]}.jpg"
            filepath = os.path.join(settings.EVIDENCE_DIR, filename)
            cv2.imwrite(filepath, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return filename
        except Exception as e:
            logger.error(f"Error saving evidence: {e}")
            return None

    def _save_evidence_crop(self, frame: np.ndarray, detection: Detection) -> Optional[str]:
        """Save the full frame with a bounding box drawn around the detection for maximum context."""
        try:
            os.makedirs(settings.EVIDENCE_DIR, exist_ok=True)
            x1, y1, x2, y2 = [int(c) for c in detection.bbox]
            
            # Create a copy of the full frame so we don't modify the original array being used elsewhere
            evidence_img = frame.copy()
            
            # Draw a highly visible bounding box on the full frame
            cv2.rectangle(evidence_img, (x1, y1), (x2, y2), (0, 0, 255), 4)  # Red box
            
            # Draw label background
            label = f"{detection.class_name} {int(detection.confidence*100)}%"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)
            cv2.rectangle(evidence_img, (x1, y1 - 30), (x1 + tw + 10, y1), (0, 0, 255), -1)
            
            # Draw label text
            cv2.putText(evidence_img, label, (x1 + 5, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

            filename = f"{detection.class_name}_{int(time.time())}_{uuid.uuid4().hex[:8]}.jpg"
            filepath = os.path.join(settings.EVIDENCE_DIR, filename)
            cv2.imwrite(filepath, evidence_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return filename
        except Exception as e:
            logger.error(f"Error saving evidence image: {e}")
            return None

    def _calculate_smart_scores(self, detections: list[Detection], frame_shape: tuple):
        """
        Enhance raw YOLO confidence scores using tracking history and spatial heuristics.
        """
        frame_area = frame_shape[0] * frame_shape[1]
        active_objects = self.tracker.get_active_objects()
        
        for det in detections:
            # 1. Dynamic Tracked Objects
            if det.track_id is not None and det.track_id in active_objects:
                obj = active_objects[det.track_id]
                base_conf = det.confidence
                history_len = len(obj.trajectory)
                
                # Persistence Bonus (max 0.15 for 15+ frames)
                persistence_bonus = min(history_len / 15.0, 1.0) * 0.15
                
                # Historical Average
                avg_conf = sum(p.confidence for p in obj.trajectory) / history_len if history_len > 0 else base_conf
                
                # Smart Blend
                smart_score = (base_conf * 0.50) + (avg_conf * 0.35) + persistence_bonus
                det.confidence = min(smart_score, 0.99)
                
            # 2. Static Road Defects (Size heuristic)
            elif det.class_name in ("pothole", "road_damage", "waterlogging", "waterlogged_pothole"):
                box_area = (det.bbox[2] - det.bbox[0]) * (det.bbox[3] - det.bbox[1])
                size_ratio = box_area / max(frame_area, 1)
                
                # Size bonus (max 0.15 for defects taking up >10% of screen)
                size_bonus = min(size_ratio * 10, 1.0) * 0.15
                det.confidence = min(det.confidence + size_bonus, 0.99)

    def reset(self):
        """Reset pipeline state for a new session."""
        self.tracker.reset()
        self.intelligence.reset()
        self._frame_count = 0

    @property
    def model_info(self) -> dict:
        return {
            **self.detector.model_info,
            "anpr_available": self.anpr.is_available if self.anpr else False,
            "pipeline_initialized": self._initialized,
        }
