"""
Scene Analysis — OpenCV-based visual heuristics for detecting conditions
that the YOLO models miss (waterlogging, vehicle damage).
These run as fallbacks when the trained models don't fire.
"""
import cv2
import numpy as np
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SceneDetection:
    """A detection produced by scene analysis heuristics."""
    class_name: str
    confidence: float
    description: str
    bbox: tuple  # (x1, y1, x2, y2)


def detect_waterlogging(frame: np.ndarray) -> list[SceneDetection]:
    """
    Detect waterlogging/flooding by analyzing color distribution.
    Flooded scenes have large areas of brownish/murky water with reflections.
    
    Method:
    1. Convert to HSV
    2. Look for large contiguous regions of water-like colors (brown/murky/blue water)
    3. Require >50% coverage AND one large contiguous blob to confirm flooding
    """
    detections = []
    try:
        h, w = frame.shape[:2]
        
        # Focus on the lower 60% of the image (where water/road would be)
        lower_region = frame[int(h * 0.4):, :]
        lh, lw = lower_region.shape[:2]
        
        hsv = cv2.cvtColor(lower_region, cv2.COLOR_BGR2HSV)
        
        # STRICT water color ranges — only match actual water, not roads/sky/concrete:
        # 1. Brown/murky flood water: narrow hue range, must have moderate saturation
        mask_brown = cv2.inRange(hsv, np.array([10, 40, 50]), np.array([25, 170, 170]))
        # 2. Blue/teal water: distinct blue hue with saturation (not gray sky)
        mask_blue = cv2.inRange(hsv, np.array([90, 40, 50]), np.array([130, 180, 200]))
        # NOTE: No gray mask — gray matches roads, concrete, overcast sky, buildings
        
        water_mask = cv2.bitwise_or(mask_brown, mask_blue)
        
        # Aggressive morphological cleanup — remove small scattered patches
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
        water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_CLOSE, kernel)
        water_mask = cv2.morphologyEx(water_mask, cv2.MORPH_OPEN, kernel)
        
        water_pixels = cv2.countNonZero(water_mask)
        total_pixels = lh * lw
        water_ratio = water_pixels / total_pixels
        
        # STRICT: require >50% water coverage (actual floods cover most of the ground)
        if water_ratio > 0.50:
            # EXTRA CHECK: the water must form ONE large contiguous blob
            # (not many small patches scattered around — that's just color noise)
            contours, _ = cv2.findContours(water_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                largest = max(contours, key=cv2.contourArea)
                largest_ratio = cv2.contourArea(largest) / total_pixels
                
                # The largest blob must cover at least 30% of the lower region
                if largest_ratio > 0.30:
                    confidence = min(0.92, 0.5 + (water_ratio - 0.5))
                    
                    x, y, cw, ch = cv2.boundingRect(largest)
                    y_offset = int(h * 0.4)
                    bbox = (float(x), float(y + y_offset), float(x + cw), float(y + y_offset + ch))
                    
                    detections.append(SceneDetection(
                        class_name="waterlogging",
                        confidence=round(confidence, 3),
                        description=f"Waterlogging detected: {water_ratio*100:.0f}% water coverage",
                        bbox=bbox
                    ))
                    logger.info(f"Scene analysis: waterlogging detected (coverage={water_ratio:.2f}, blob={largest_ratio:.2f})")
        
    except Exception as e:
        logger.error(f"Waterlogging scene analysis error: {e}")
    
    return detections


def detect_vehicle_damage(frame: np.ndarray, vehicle_detections: list) -> list[SceneDetection]:
    """
    Detect vehicle damage by analyzing the texture/edges within detected vehicle bounding boxes.
    Damaged vehicles have:
    - Irregular edges (crumpled metal)
    - Higher edge density than normal vehicles
    - More texture variation
    """
    detections = []
    try:
        h, w = frame.shape[:2]
        
        for det in vehicle_detections:
            if det.class_name not in ('car', 'truck', 'bus', 'motorcycle'):
                continue
            
            x1, y1, x2, y2 = [int(c) for c in det.bbox]
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(w, x2)
            y2 = min(h, y2)
            
            crop = frame[y1:y2, x1:x2]
            if crop.size == 0 or crop.shape[0] < 30 or crop.shape[1] < 30:
                continue
            
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            ch, cw = gray.shape
            
            # Edge density analysis
            edges = cv2.Canny(gray, 50, 150)
            edge_density = cv2.countNonZero(edges) / (ch * cw)
            
            # Texture variance (damaged cars have high local variance from crumpled surfaces)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            texture_variance = laplacian.var()
            
            # Color irregularity (damaged cars often show exposed metal, rust, etc.)
            hsv_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
            saturation_std = hsv_crop[:, :, 1].std()
            
            # Scoring
            damage_score = 0.0
            
            if edge_density > 0.12:
                damage_score += 0.3
            if texture_variance > 800:
                damage_score += 0.3
            if saturation_std > 50:
                damage_score += 0.2
            # Low confidence detection itself hints at unusual appearance
            if det.confidence < 0.3:
                damage_score += 0.2
            
            if damage_score >= 0.5:
                confidence = min(0.90, damage_score)
                detections.append(SceneDetection(
                    class_name="vehicle_damage",
                    confidence=round(confidence, 3),
                    description=f"Damaged vehicle detected (edge_density={edge_density:.3f}, texture_var={texture_variance:.0f})",
                    bbox=det.bbox
                ))
                logger.info(f"Scene analysis: vehicle damage detected (score={damage_score:.2f})")
    
    except Exception as e:
        logger.error(f"Vehicle damage scene analysis error: {e}")
    
    return detections
