"""
YOLOv8 Detection wrapper.
Loads pretrained and custom models, runs inference, and returns standardized results.
"""
import logging
import numpy as np
import torch
from typing import Optional
from dataclasses import dataclass, field
from ..config import settings

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    """A single object detection result from real AI inference."""
    class_id: int
    class_name: str
    confidence: float
    bbox: tuple  # (x1, y1, x2, y2) pixel coordinates
    track_id: Optional[int] = None
    model_source: str = "yolov8"  # Which model produced this detection


class Detector:
    """
    YOLOv8 detection wrapper that loads multiple models for different detection tasks.
    Uses pretrained COCO model for vehicles/pedestrians and custom models for road defects.
    """

    # COCO class IDs relevant to this application
    VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
    PERSON_CLASS = {0: "person"}
    TRAFFIC_CLASSES = {9: "traffic_light", 11: "stop_sign"}

    # Whitelist of VALID class IDs from the custom road damage model.
    # The new dataset has 5 classes: crack, damage, pothole, pothole_water, pothole_water_m
    VALID_ROAD_DAMAGE_CLASSES = {
        0: 'road_damage',     # crack -> map to road_damage
        1: 'road_damage',     # damage -> map to road_damage
        2: 'pothole',         # pothole
        3: 'waterlogging',    # pothole_water -> map to waterlogging
        4: 'waterlogging',    # pothole_water_m -> map to waterlogging
    }

    def __init__(self):
        self._general_model = None
        self._pothole_model = None
        self._road_damage_model = None
        self._plate_model = None
        self._models_loaded = False
        
        # Check for CUDA availability to support CPU fallback
        self._device = settings.DEVICE
        if self._device != "cpu" and not torch.cuda.is_available():
            logger.warning("CUDA is not available but device is set to GPU. Falling back to CPU for YOLO inference.")
            self._device = "cpu"

    async def load_models(self):
        """Load all AI models. Runs in thread pool to not block the event loop."""
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._load_models_sync)

    def _load_models_sync(self):
        """Synchronous model loading."""
        try:
            from ultralytics import YOLO

            # Load pretrained general model (vehicles, pedestrians, traffic signs)
            logger.info(f"Loading general YOLO model: {settings.YOLO_GENERAL_MODEL}")
            self._general_model = YOLO(settings.YOLO_GENERAL_MODEL)
            logger.info("General model loaded successfully")

            # Load custom pothole model if available
            if settings.YOLO_POTHOLE_MODEL:
                try:
                    logger.info(f"Loading pothole model: {settings.YOLO_POTHOLE_MODEL}")
                    self._pothole_model = YOLO(settings.YOLO_POTHOLE_MODEL)
                    logger.info("Pothole model loaded")
                except Exception as e:
                    logger.warning(f"Pothole model not available: {e}")

            # Load custom road damage model if available
            if settings.YOLO_ROAD_DAMAGE_MODEL:
                try:
                    logger.info(f"Loading road damage model: {settings.YOLO_ROAD_DAMAGE_MODEL}")
                    self._road_damage_model = YOLO(settings.YOLO_ROAD_DAMAGE_MODEL)
                    logger.info("Road damage model loaded")
                except Exception as e:
                    logger.warning(f"Road damage model not available: {e}")

            # Load license plate detection model if available
            if settings.YOLO_PLATE_MODEL:
                try:
                    logger.info(f"Loading plate model: {settings.YOLO_PLATE_MODEL}")
                    self._plate_model = YOLO(settings.YOLO_PLATE_MODEL)
                    logger.info("Plate detection model loaded")
                except Exception as e:
                    logger.warning(f"Plate model not available: {e}")

            self._models_loaded = True
            logger.info("All available models loaded")

        except ImportError:
            logger.error("ultralytics package not installed. AI detection will not work.")
        except Exception as e:
            logger.error(f"Error loading models: {e}")



    @staticmethod
    def _overlap_metrics(box1, box2) -> tuple[float, float]:
        """
        Calculate both Intersection over Union (IoU) and 
        Intersection over Area of the smaller box (IoMin).
        IoMin is crucial for suppressing small boxes that are entirely contained within larger ones.
        """
        xA = max(box1[0], box2[0])
        yA = max(box1[1], box2[1])
        xB = min(box1[2], box2[2])
        yB = min(box1[3], box2[3])
        
        inter = max(0, xB - xA) * max(0, yB - yA)
        area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
        area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
        
        union = area1 + area2 - inter
        min_area = min(area1, area2)
        
        iou = inter / union if union > 0 else 0
        io_min = inter / min_area if min_area > 0 else 0
        
        return iou, io_min

    def _deduplicate(self, detections: list) -> list:
        """Remove duplicate detections of the same class across models using NMS + Containment checks."""
        if len(detections) <= 1:
            return detections
        
        def get_priority(d):
            # Prioritize road_damage over pothole only if confidences are similar
            score = d.confidence
            if d.class_name == "road_damage":
                score += 0.05
            return score

        # Sort by confidence/priority descending
        sorted_dets = sorted(detections, key=get_priority, reverse=True)
        keep = []
        
        for det in sorted_dets:
            is_dup = False
            for kept in keep:
                # Treat all vehicles as the same super-class for deduplication to prevent 
                # double-counting if the AI confuses a car for a truck and draws 2 boxes
                is_same_class = det.class_name == kept.class_name
                
                vehicle_types = {'car', 'truck', 'bus', 'motorcycle'}
                if not is_same_class and det.class_name in vehicle_types and kept.class_name in vehicle_types:
                    is_same_class = True
                
                # Treat pothole and road_damage as the same super-class for deduplication
                is_road_defect = det.class_name in {"pothole", "road_damage"} and kept.class_name in {"pothole", "road_damage"}

                if is_same_class or is_road_defect:
                    iou, io_min = self._overlap_metrics(det.bbox, kept.bbox)
                    # Duplicate if they overlap significantly (IoU > 0.35) 
                    # OR if one is mostly inside the other (IoMin > 0.6)
                    if iou > 0.35 or io_min > 0.6:
                        is_dup = True
                        break
            if not is_dup:
                keep.append(det)
        
        if len(keep) < len(detections):
            logger.info(f"Dedup: {len(detections)} -> {len(keep)} detections")
        return keep

    def _normalize_class_name(self, cls_id: int, raw_name: str) -> str:
        """Map class ID to standardized name using whitelist. Returns None for invalid classes."""
        if cls_id in self.VALID_ROAD_DAMAGE_CLASSES:
            return self.VALID_ROAD_DAMAGE_CLASSES[cls_id]
        return None  # Invalid class — skip this detection

    def detect(self, frame: np.ndarray) -> list[Detection]:
        """
        Run detection on a single frame using all loaded models.
        Returns a list of Detection objects from REAL inference — never fabricated.
        """
        if not self._models_loaded or self._general_model is None:
            return []

        detections = []

        # Run general model (vehicles, pedestrians, traffic objects)
        try:
            results = self._general_model(
                frame,
                conf=settings.DETECTION_CONFIDENCE_THRESHOLD,
                device=self._device,
                verbose=False
            )
            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    bbox = tuple(box.xyxy[0].cpu().numpy().tolist())

                    # Map COCO class to our application-relevant name
                    if cls_id in self.VEHICLE_CLASSES:
                        class_name = self.VEHICLE_CLASSES[cls_id]
                    elif cls_id in self.PERSON_CLASS:
                        class_name = "pedestrian"
                    elif cls_id in self.TRAFFIC_CLASSES:
                        class_name = self.TRAFFIC_CLASSES.get(cls_id, "traffic_object")
                    else:
                        continue  # Skip irrelevant COCO classes

                    detections.append(Detection(
                        class_id=cls_id,
                        class_name=class_name,
                        confidence=conf,
                        bbox=bbox,
                        model_source="yolov8_general"
                    ))
        except Exception as e:
            logger.error(f"General model inference error: {e}")

        # Run pothole model if loaded
        if self._pothole_model:
            try:
                results = self._pothole_model(
                    frame,
                    conf=0.30,  # Balanced threshold for pothole detection
                    device=self._device,
                    verbose=False
                )
                for r in results:
                    for box in r.boxes:
                        cls_id = int(box.cls[0])
                        # 0: Drain Hole, 1: Pothole, 2: Sewer Cover
                        if cls_id == 1:
                            detections.append(Detection(
                                class_id=100,
                                class_name="pothole",
                                confidence=float(box.conf[0]),
                                bbox=tuple(box.xyxy[0].cpu().numpy().tolist()),
                                model_source="yolov8_pothole"
                            ))
            except Exception as e:
                logger.error(f"Pothole model inference error: {e}")

        # Run road damage model if loaded
        if self._road_damage_model:
            try:
                results = self._road_damage_model(
                    frame,
                    conf=0.30,  # Balanced threshold for road damage
                    device=self._device,
                    verbose=False
                )
                for r in results:
                    for box in r.boxes:
                        cls_id = int(box.cls[0])
                        # Only accept whitelisted valid classes
                        raw_name = self._road_damage_model.names.get(cls_id, "unknown")
                        class_name = self._normalize_class_name(cls_id, raw_name)
                        if class_name is None:
                            continue  # Skip garbage Roboflow metadata classes
                        
                        detections.append(Detection(
                            class_id=200 + cls_id,
                            class_name=class_name,
                            confidence=float(box.conf[0]),
                            bbox=tuple(box.xyxy[0].cpu().numpy().tolist()),
                            model_source="yolov8_road_damage"
                        ))
            except Exception as e:
                logger.error(f"Road damage model inference error: {e}")
        # Run license plate model if loaded
        if self._plate_model:
            try:
                results = self._plate_model(
                    frame,
                    conf=0.3,
                    device=self._device,
                    verbose=False
                )
                for r in results:
                    for box in r.boxes:
                        detections.append(Detection(
                            class_id=300,
                            class_name="license_plate",
                            confidence=float(box.conf[0]),
                            bbox=tuple(box.xyxy[0].cpu().numpy().tolist()),
                            model_source="yolov8_plate"
                        ))
            except Exception as e:
                logger.error(f"Plate model inference error: {e}")



        return self._deduplicate(detections)

    def detect_with_tracking(self, frame: np.ndarray) -> list[Detection]:
        """
        Run detection + ByteTrack tracking on a frame.
        Returns detections with persistent track_id for multi-object tracking.
        """
        if not self._models_loaded or self._general_model is None:
            return []

        detections = []

        try:
            results = self._general_model.track(
                frame,
                conf=0.35, # Reasonable threshold — scene_analysis handles damage detection now
                tracker=settings.TRACKER_TYPE,
                persist=True,
                device=self._device,
                verbose=False
            )
            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    bbox = tuple(box.xyxy[0].cpu().numpy().tolist())
                    track_id = int(box.id[0]) if box.id is not None else None

                    if cls_id in self.VEHICLE_CLASSES:
                        class_name = self.VEHICLE_CLASSES[cls_id]
                    elif cls_id in self.PERSON_CLASS:
                        class_name = "pedestrian"
                    elif cls_id in self.TRAFFIC_CLASSES:
                        class_name = self.TRAFFIC_CLASSES.get(cls_id, "traffic_object")
                    else:
                        continue

                    detections.append(Detection(
                        class_id=cls_id,
                        class_name=class_name,
                        confidence=conf,
                        bbox=bbox,
                        track_id=track_id,
                        model_source="yolov8_tracked"
                    ))
        except Exception as e:
            logger.error(f"Tracking inference error: {e}")

        # Also run custom models (without tracking)
        if self._pothole_model:
            try:
                results = self._pothole_model(
                    frame,
                    conf=0.30,  # Balanced threshold
                    device=self._device,
                    verbose=False
                )
                for r in results:
                    for box in r.boxes:
                        cls_id = int(box.cls[0])
                        if cls_id == 1:
                            detections.append(Detection(
                                class_id=100,
                                class_name="pothole",
                                confidence=float(box.conf[0]),
                                bbox=tuple(box.xyxy[0].cpu().numpy().tolist()),
                                model_source="yolov8_pothole"
                            ))
            except Exception as e:
                logger.error(f"Pothole detection error during tracking: {e}")

        if self._road_damage_model:
            try:
                results = self._road_damage_model(
                    frame,
                    conf=0.30,  # Balanced threshold
                    device=self._device,
                    verbose=False
                )
                for r in results:
                    for box in r.boxes:
                        cls_id = int(box.cls[0])
                        raw_name = self._road_damage_model.names.get(cls_id, "unknown")
                        class_name = self._normalize_class_name(cls_id, raw_name)
                        if class_name is None:
                            continue  # Skip garbage classes
                        
                        detections.append(Detection(
                            class_id=200 + cls_id,
                            class_name=class_name,
                            confidence=float(box.conf[0]),
                            bbox=tuple(box.xyxy[0].cpu().numpy().tolist()),
                            model_source="yolov8_road_damage"
                        ))
            except Exception as e:
                logger.error(f"Road damage detection error during tracking: {e}")
        if self._plate_model:
            try:
                results = self._plate_model(
                    frame,
                    conf=0.3,
                    device=self._device,
                    verbose=False
                )
                for r in results:
                    for box in r.boxes:
                        detections.append(Detection(
                            class_id=300,
                            class_name="license_plate",
                            confidence=float(box.conf[0]),
                            bbox=tuple(box.xyxy[0].cpu().numpy().tolist()),
                            model_source="yolov8_plate"
                        ))
            except Exception as e:
                logger.error(f"Plate detection error during tracking: {e}")



        return self._deduplicate(detections)

    @property
    def model_info(self) -> dict:
        """Return info about loaded models for the settings page."""
        return {
            "general_model": {
                "loaded": self._general_model is not None,
                "path": settings.YOLO_GENERAL_MODEL,
                "description": "YOLOv8 pretrained on COCO (vehicles, pedestrians, traffic objects)"
            },
            "pothole_model": {
                "loaded": self._pothole_model is not None,
                "path": settings.YOLO_POTHOLE_MODEL,
                "description": "Custom-trained pothole detection model"
            },
            "road_damage_model": {
                "loaded": self._road_damage_model is not None,
                "path": settings.YOLO_ROAD_DAMAGE_MODEL,
                "description": "Custom-trained road damage/waterlogging/signage model"
            },
            "plate_model": {
                "loaded": self._plate_model is not None,
                "path": settings.YOLO_PLATE_MODEL,
                "description": "License plate detection model for ANPR"
            }
        }
