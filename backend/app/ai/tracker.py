"""
Object tracker wrapper using ByteTrack (via Ultralytics built-in tracking).
Maintains trajectory history for each tracked object to enable
speed estimation, rash driving detection, and incident analysis.
"""
import time
import math
import logging
from typing import Optional
from dataclasses import dataclass, field
from collections import defaultdict
from .detector import Detection

logger = logging.getLogger(__name__)


@dataclass
class TrackPoint:
    """A single point in an object's trajectory."""
    x: float  # center x
    y: float  # center y
    timestamp: float
    bbox: tuple
    confidence: float


@dataclass
class TrackedObject:
    """Full tracking state for a single object across frames."""
    track_id: int
    class_name: str
    trajectory: list[TrackPoint] = field(default_factory=list)
    first_seen: float = 0.0
    last_seen: float = 0.0
    is_active: bool = True

    @property
    def center(self) -> tuple:
        if not self.trajectory:
            return (0, 0)
        last = self.trajectory[-1]
        return (last.x, last.y)

    @property
    def age_seconds(self) -> float:
        return self.last_seen - self.first_seen

    @property
    def pixel_speed(self) -> float:
        """Estimate speed in pixels/second from recent trajectory."""
        if len(self.trajectory) < 2:
            return 0.0
        recent = self.trajectory[-5:]  # Last 5 points
        total_dist = 0.0
        for i in range(1, len(recent)):
            dx = recent[i].x - recent[i - 1].x
            dy = recent[i].y - recent[i - 1].y
            total_dist += math.sqrt(dx * dx + dy * dy)
        time_span = recent[-1].timestamp - recent[0].timestamp
        if time_span <= 0:
            return 0.0
        return total_dist / time_span

    @property
    def direction_changes(self) -> int:
        """Count significant direction changes — indicator of erratic driving."""
        if len(self.trajectory) < 3:
            return 0
        changes = 0
        for i in range(2, len(self.trajectory)):
            prev_dx = self.trajectory[i - 1].x - self.trajectory[i - 2].x
            prev_dy = self.trajectory[i - 1].y - self.trajectory[i - 2].y
            curr_dx = self.trajectory[i].x - self.trajectory[i - 1].x
            curr_dy = self.trajectory[i].y - self.trajectory[i - 1].y

            # Compute angle change
            prev_angle = math.atan2(prev_dy, prev_dx)
            curr_angle = math.atan2(curr_dy, curr_dx)
            angle_diff = abs(curr_angle - prev_angle)
            if angle_diff > math.pi:
                angle_diff = 2 * math.pi - angle_diff

            # Consider > 30 degrees as a significant direction change
            if angle_diff > math.radians(30):
                changes += 1
        return changes

    @property
    def lateral_variance(self) -> float:
        """Compute lateral movement variance — high values indicate swerving."""
        if len(self.trajectory) < 3:
            return 0.0
        xs = [p.x for p in self.trajectory[-10:]]
        mean_x = sum(xs) / len(xs)
        variance = sum((x - mean_x) ** 2 for x in xs) / len(xs)
        return variance


class ObjectTracker:
    """
    Manages tracked objects using ByteTrack results from YOLO.
    Maintains trajectory history for intelligence analysis.
    """

    def __init__(self, max_inactive_time: float = 5.0):
        self._tracked_objects: dict[int, TrackedObject] = {}
        self._max_inactive_time = max_inactive_time

    def update(self, detections: list[Detection], timestamp: float) -> dict[int, TrackedObject]:
        """
        Update tracker with new detections from a frame.
        Expects detections to already have track_id from YOLO's built-in ByteTrack.
        """
        active_ids = set()

        for det in detections:
            if det.track_id is None:
                continue

            active_ids.add(det.track_id)
            cx = (det.bbox[0] + det.bbox[2]) / 2
            cy = (det.bbox[1] + det.bbox[3]) / 2

            point = TrackPoint(
                x=cx, y=cy,
                timestamp=timestamp,
                bbox=det.bbox,
                confidence=det.confidence
            )

            if det.track_id not in self._tracked_objects:
                self._tracked_objects[det.track_id] = TrackedObject(
                    track_id=det.track_id,
                    class_name=det.class_name,
                    first_seen=timestamp,
                    last_seen=timestamp,
                    trajectory=[point]
                )
            else:
                obj = self._tracked_objects[det.track_id]
                obj.trajectory.append(point)
                obj.last_seen = timestamp
                obj.is_active = True
                # Limit trajectory length to prevent memory bloat
                if len(obj.trajectory) > 200:
                    obj.trajectory = obj.trajectory[-100:]

        # Mark inactive objects
        for tid, obj in self._tracked_objects.items():
            if tid not in active_ids:
                if timestamp - obj.last_seen > self._max_inactive_time:
                    obj.is_active = False

        return self._tracked_objects

    def get_active_objects(self) -> dict[int, TrackedObject]:
        return {tid: obj for tid, obj in self._tracked_objects.items() if obj.is_active}

    def get_vehicles(self) -> dict[int, TrackedObject]:
        vehicle_names = {"car", "motorcycle", "bus", "truck"}
        return {
            tid: obj for tid, obj in self._tracked_objects.items()
            if obj.class_name in vehicle_names and obj.is_active
        }

    def get_pedestrians(self) -> dict[int, TrackedObject]:
        return {
            tid: obj for tid, obj in self._tracked_objects.items()
            if obj.class_name == "pedestrian" and obj.is_active
        }

    def get_vehicle_count(self) -> int:
        return len(self.get_vehicles())

    def reset(self):
        self._tracked_objects.clear()
