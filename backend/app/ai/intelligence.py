"""
Intelligence Layer — higher-order analysis built on top of detection + tracking.
NOT single-frame classification — all analysis uses trajectory history.
"""
import time
import math
import logging
from typing import Optional
from dataclasses import dataclass, field
from .tracker import ObjectTracker, TrackedObject
from .detector import Detection

logger = logging.getLogger(__name__)


@dataclass
class IntelligenceEvent:
    """A higher-order event detected by the intelligence layer."""
    event_type: str  # "rash_driving", "close_call", "pedestrian_risk", "traffic_bottleneck"
    confidence: float
    description: str
    involved_track_ids: list[int] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


class IntelligenceLayer:
    """
    Analyzes tracked object trajectories over time to detect:
    - Rash driving (erratic movement, high speed, swerving)
    - Hit-and-run (collision event + vehicle departure)
    - Pedestrian risk (proximity analysis)
    - Traffic bottleneck (vehicle density over time)
    """

    # Thresholds for rash driving detection (tuned empirically)
    RASH_SPEED_THRESHOLD = 300.0  # pixels/sec — very fast relative movement
    RASH_DIRECTION_CHANGES_THRESHOLD = 5  # in recent trajectory
    RASH_LATERAL_VARIANCE_THRESHOLD = 2000.0  # high lateral variance = swerving

    # Pedestrian risk thresholds
    PEDESTRIAN_PROXIMITY_THRESHOLD = 150.0  # pixels — danger zone

    # Traffic density thresholds
    BOTTLENECK_VEHICLE_COUNT = 8  # Vehicles in frame = potential bottleneck
    BOTTLENECK_LOW_SPEED = 30.0  # Low average speed among tracked vehicles

    def __init__(self):
        self._recent_events: list[IntelligenceEvent] = []
        self._collision_candidates: dict[int, float] = {}  # track_id -> timestamp of sudden stop
        self._event_cooldown: dict[str, float] = {}  # Prevent spamming same events
        self._vehicle_count_history: list[tuple[float, int]] = []  # (timestamp, count)

    def analyze(self, tracker: ObjectTracker, detections: list[Detection], timestamp: float, frame_w: int = 1920, frame_h: int = 1080) -> list[IntelligenceEvent]:
        """
        Run all intelligence analyses on current tracked state.
        Returns newly detected events (respecting cooldowns).
        """
        events = []

        events.extend(self._detect_rash_driving(tracker, timestamp))
        events.extend(self._detect_pedestrian_risk(tracker, timestamp))
        events.extend(self._detect_traffic_bottleneck(tracker, timestamp, frame_w, frame_h))
        events.extend(self._detect_close_call(tracker, timestamp))
        events.extend(self._detect_static_crash(detections, timestamp))
        events.extend(self._detect_waterlogged_potholes(detections, timestamp))

        # Update recent events list
        self._recent_events.extend(events)
        if len(self._recent_events) > 100:
            self._recent_events = self._recent_events[-50:]

        return events

    def _detect_rash_driving(self, tracker: ObjectTracker, timestamp: float) -> list[IntelligenceEvent]:
        """
        Detect rash driving from trajectory analysis:
        - High relative speed compared to surrounding vehicles
        - Frequent direction changes (swerving/weaving)
        - High lateral variance (lane weaving)
        """
        events = []
        vehicles = tracker.get_vehicles()

        if not vehicles:
            return events

        # Calculate average speed of all vehicles
        speeds = [obj.pixel_speed for obj in vehicles.values() if obj.pixel_speed > 0]
        avg_speed = sum(speeds) / len(speeds) if speeds else 0.0

        for tid, obj in vehicles.items():
            if len(obj.trajectory) < 10:
                continue

            cooldown_key = f"rash_{tid}"
            if cooldown_key in self._event_cooldown:
                if timestamp - self._event_cooldown[cooldown_key] < 10.0:
                    continue

            rash_score = 0.0
            reasons = []

            # Check absolute speed
            if obj.pixel_speed > self.RASH_SPEED_THRESHOLD:
                rash_score += 0.3
                reasons.append(f"high_speed:{obj.pixel_speed:.0f}px/s")

            # Check relative speed (>2x average)
            if avg_speed > 0 and obj.pixel_speed > avg_speed * 2.0:
                rash_score += 0.3
                reasons.append(f"speed_2x_avg")

            # Check direction changes
            dir_changes = obj.direction_changes
            if dir_changes > self.RASH_DIRECTION_CHANGES_THRESHOLD:
                rash_score += 0.2
                reasons.append(f"direction_changes:{dir_changes}")

            # Check lateral variance (swerving)
            lat_var = obj.lateral_variance
            if lat_var > self.RASH_LATERAL_VARIANCE_THRESHOLD:
                rash_score += 0.2
                reasons.append(f"swerving:var={lat_var:.0f}")

            if rash_score >= 0.5:
                events.append(IntelligenceEvent(
                    event_type="rash_driving",
                    confidence=obj.confidence,  # Pure ML confidence of the vehicle
                    description=f"Rash driving detected: {', '.join(reasons)}",
                    involved_track_ids=[tid],
                    metadata={
                        "speed": obj.pixel_speed,
                        "avg_traffic_speed": avg_speed,
                        "direction_changes": dir_changes,
                        "lateral_variance": lat_var,
                        "reasons": reasons,
                        "vehicle_type": obj.class_name
                    }
                ))
                self._event_cooldown[cooldown_key] = timestamp

        return events

    def _detect_pedestrian_risk(self, tracker: ObjectTracker, timestamp: float) -> list[IntelligenceEvent]:
        """
        Detect vulnerable pedestrian situations:
        - Pedestrians in close proximity to moving vehicles
        - Especially at road-crossing zones (near vehicle paths)
        """
        events = []
        vehicles = tracker.get_vehicles()
        pedestrians = tracker.get_pedestrians()

        if not vehicles or not pedestrians:
            return events

        for pid, ped in pedestrians.items():
            cooldown_key = f"ped_risk_{pid}"
            if cooldown_key in self._event_cooldown:
                if timestamp - self._event_cooldown[cooldown_key] < 15.0:
                    continue

            # Child heuristic: significantly shorter than average pedestrian
            is_child = False
            if len(pedestrians) > 1:
                avg_height = sum((p.bbox[3] - p.bbox[1]) for p in pedestrians.values()) / len(pedestrians)
                ped_height = ped.bbox[3] - ped.bbox[1]
                if ped_height < avg_height * 0.75:
                    is_child = True
            elif ped.class_name == "school_child":  # If detected directly by custom model
                is_child = True

            ped_center = ped.center
            closest_vehicle = None
            min_distance = float('inf')

            for vid, veh in vehicles.items():
                veh_center = veh.center
                dist = math.sqrt(
                    (ped_center[0] - veh_center[0]) ** 2 +
                    (ped_center[1] - veh_center[1]) ** 2
                )
                if dist < min_distance:
                    min_distance = dist
                    closest_vehicle = veh

            if min_distance < self.PEDESTRIAN_PROXIMITY_THRESHOLD and closest_vehicle:
                # Higher risk if vehicle is moving fast
                risk_score = max(0, 1.0 - min_distance / self.PEDESTRIAN_PROXIMITY_THRESHOLD)
                if closest_vehicle.pixel_speed > 50:
                    risk_score = min(risk_score + 0.2, 1.0)
                
                # Higher risk if it's a child
                if is_child:
                    risk_score = min(risk_score + 0.2, 1.0)

                if risk_score > 0.4:
                    ml_confidence = (ped.confidence + closest_vehicle.confidence) / 2.0
                    ped_type = "School child" if is_child else "Pedestrian"
                    events.append(IntelligenceEvent(
                        event_type="pedestrian_risk",
                        confidence=ml_confidence,  # Pure ML confidence average
                        description=f"{ped_type} at risk: {min_distance:.0f}px from {closest_vehicle.class_name}",
                        involved_track_ids=[pid, closest_vehicle.track_id],
                        metadata={
                            "distance_pixels": min_distance,
                            "vehicle_speed": closest_vehicle.pixel_speed,
                            "vehicle_type": closest_vehicle.class_name,
                            "is_child": is_child
                        }
                    ))
                    self._event_cooldown[cooldown_key] = timestamp

        return events

    def _detect_traffic_bottleneck(self, tracker: ObjectTracker, timestamp: float, frame_w: int, frame_h: int) -> list[IntelligenceEvent]:
        """Detect traffic bottleneck from vehicle count and average speed over time, or high frame coverage."""
        events = []
        vehicles = tracker.get_vehicles()
        count = len(vehicles)

        self._vehicle_count_history.append((timestamp, count))
        # Keep last 60 seconds of history
        self._vehicle_count_history = [
            (t, c) for t, c in self._vehicle_count_history
            if timestamp - t < 60
        ]

        cooldown_key = "bottleneck"
        if cooldown_key in self._event_cooldown:
            if timestamp - self._event_cooldown[cooldown_key] < 30.0:
                return events

        # Coverage heuristic
        frame_area = frame_w * frame_h
        total_area = sum((v.trajectory[-1].bbox[2] - v.trajectory[-1].bbox[0]) * (v.trajectory[-1].bbox[3] - v.trajectory[-1].bbox[1]) for v in vehicles.values() if v.trajectory)
        coverage = min(total_area / max(frame_area, 1), 1.0)

        is_bottleneck = False
        avg_speed = 0.0
        ml_confidence = 0.0
        reason = ""

        # Condition 1: Lots of cars + low speed (tracked video)
        if count >= self.BOTTLENECK_VEHICLE_COUNT:
            speeds = [obj.pixel_speed for obj in vehicles.values()]
            avg_speed = sum(speeds) / len(speeds) if speeds else 0.0
            if avg_speed < self.BOTTLENECK_LOW_SPEED:
                is_bottleneck = True
                ml_confidence = sum(obj.confidence for obj in vehicles.values()) / max(len(vehicles), 1)
                reason = f"Traffic bottleneck: {count} vehicles, avg speed {avg_speed:.0f}px/s"

        # Condition 2: > 15% coverage OR > 4 vehicles
        if not is_bottleneck and (coverage >= 0.15 or count >= 4):
            is_bottleneck = True
            ml_confidence = min(0.7 + (coverage * 0.3), 0.99)
            reason = f"Traffic bottleneck: {count} vehicles, {coverage*100:.1f}% coverage"

        if is_bottleneck:
            avg_count = sum(c for _, c in self._vehicle_count_history) / max(len(self._vehicle_count_history), 1)
            events.append(IntelligenceEvent(
                event_type="traffic_bottleneck",
                confidence=ml_confidence,
                description=reason,
                involved_track_ids=list(vehicles.keys()),
                metadata={
                    "vehicle_count": count,
                    "avg_speed": avg_speed,
                    "avg_count_60s": avg_count,
                    "coverage": coverage
                }
            ))
            self._event_cooldown[cooldown_key] = timestamp

        return events

    def _detect_close_call(self, tracker: ObjectTracker, timestamp: float) -> list[IntelligenceEvent]:
        """
        Detect vehicle collision / crash:
        - Vehicle suddenly stops (speed drops dramatically from high to near zero)
        - Vehicle is intersecting or in very close proximity to another vehicle at the time of the stop
        """
        events = []
        vehicles = tracker.get_vehicles()

        for tid, obj in vehicles.items():
            if len(obj.trajectory) < 5:
                continue

            # Check for sudden stop (speed drops dramatically)
            recent_speeds = [
                math.sqrt(
                    (obj.trajectory[i].x - obj.trajectory[i - 1].x) ** 2 +
                    (obj.trajectory[i].y - obj.trajectory[i - 1].y) ** 2
                ) for i in range(max(1, len(obj.trajectory) - 5), len(obj.trajectory))
            ]

            if len(recent_speeds) >= 3:
                early_speed = sum(recent_speeds[:2]) / 2
                late_speed = sum(recent_speeds[-2:]) / 2

                # Vehicle went from moving to near-stopped
                if early_speed > 50 and late_speed < 15:
                    if tid not in self._collision_candidates:
                        self._collision_candidates[tid] = (timestamp, early_speed, late_speed)

        # Check if the stopped vehicle is colliding/intersecting with another vehicle
        for stopped_tid, stop_data in list(self._collision_candidates.items()):
            if isinstance(stop_data, tuple):
                stop_time, early_speed, late_speed = stop_data
            else:
                stop_time = stop_data
                early_speed, late_speed = 0, 0

            if timestamp - stop_time > 30.0:
                del self._collision_candidates[stopped_tid]
                continue

            if stopped_tid not in vehicles:
                continue

            stopped_obj = vehicles[stopped_tid]
            stopped_center = stopped_obj.center

            for tid, obj in vehicles.items():
                if tid == stopped_tid:
                    continue

                # Check if this vehicle is very close (collision proximity)
                dist = math.sqrt(
                    (obj.center[0] - stopped_center[0]) ** 2 +
                    (obj.center[1] - stopped_center[1]) ** 2
                )
                
                # If distance is small enough (bounding boxes likely intersecting)
                if dist < 200:
                    cooldown_key = f"crash_{min(stopped_tid, tid)}_{max(stopped_tid, tid)}"
                    if cooldown_key not in self._event_cooldown:
                        # Pure ML confidence average of the two vehicles involved
                        ml_confidence = (stopped_obj.confidence + obj.confidence) / 2.0
                        
                        events.append(IntelligenceEvent(
                            event_type="close_call",
                            confidence=ml_confidence,
                            description=f"Close Call Detected involving vehicles {stopped_tid} and {tid}",
                            involved_track_ids=[stopped_tid, tid],
                            metadata={
                                "vehicle_1_id": stopped_tid,
                                "vehicle_2_id": tid,
                                "crash_speed_drop": f"{early_speed:.0f}px/s -> {late_speed:.0f}px/s" if early_speed else "N/A",
                                "distance": dist,
                            }
                        ))
                        self._event_cooldown[cooldown_key] = timestamp

        return events

    def _detect_waterlogged_potholes(self, detections: list[Detection], timestamp: float) -> list[IntelligenceEvent]:
        """
        Detect if a pothole is filled with water by correlating pothole and waterlogging detections.
        """
        events = []
        potholes = [d for d in detections if d.class_name == 'pothole']
        waterlogs = [d for d in detections if d.class_name == 'waterlogging']

        for p_idx, pothole in enumerate(potholes):
            for water in waterlogs:
                # Calculate Intersection over Pothole Area
                xA = max(pothole.bbox[0], water.bbox[0])
                yA = max(pothole.bbox[1], water.bbox[1])
                xB = min(pothole.bbox[2], water.bbox[2])
                yB = min(pothole.bbox[3], water.bbox[3])
                
                interArea = max(0, xB - xA) * max(0, yB - yA)
                if interArea > 0:
                    pothole_area = (pothole.bbox[2] - pothole.bbox[0]) * (pothole.bbox[3] - pothole.bbox[1])
                    overlap_ratio = interArea / max(1, pothole_area)
                    
                    if overlap_ratio > 0.4:  # If at least 40% of the pothole area intersects with water
                        cooldown_key = f"waterlogged_pothole_{p_idx}"
                        if cooldown_key not in self._event_cooldown or timestamp - self._event_cooldown[cooldown_key] > 5.0:
                            events.append(IntelligenceEvent(
                                event_type="waterlogged_pothole",
                                confidence=round(min(pothole.confidence, water.confidence), 2),  # Pure ML confidence minimum
                                description=f"Waterlogged pothole detected (Overlap: {overlap_ratio*100:.0f}%)",
                                metadata={"overlap": overlap_ratio, "pothole_conf": pothole.confidence, "water_conf": water.confidence}
                            ))
                            self._event_cooldown[cooldown_key] = timestamp
                        break

        return events

    def _detect_static_crash(self, detections: list[Detection], timestamp: float) -> list[IntelligenceEvent]:
        """
        Fallback collision detection for static images where trajectories don't exist.
        DISABLED: 2D bounding box overlap on static images causes massive false positives.
        Parked cars, traffic jams, and waterlogged streets all have overlapping vehicle boxes.
        A proper solution requires 3D depth estimation or damage-specific detection models.
        """
        return []

    def reset(self):
        self._recent_events.clear()
        self._collision_candidates.clear()
        self._event_cooldown.clear()
        self._vehicle_count_history.clear()
