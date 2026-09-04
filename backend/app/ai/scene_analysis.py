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

def detect_missing_zebra(frame: np.ndarray, traffic_light_dets: list) -> list[SceneDetection]:
    """
    If a traffic light is detected, look for parallel zebra lines in the lower frame.
    If lines are very weak or broken, flag as missing_zebra.
    """
    detections = []
    if not traffic_light_dets:
        return detections
        
    try:
        h, w = frame.shape[:2]
        # Focus on lower 50%
        y_offset = int(h * 0.5)
        lower_region = frame[y_offset:, :]
        gray = cv2.cvtColor(lower_region, cv2.COLOR_BGR2GRAY)
        
        # Adaptive thresholding to find white lines on dark road
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        _, thresh = cv2.threshold(blur, 180, 255, cv2.THRESH_BINARY)
        
        # Edge detection & Hough lines
        edges = cv2.Canny(thresh, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 50, minLineLength=50, maxLineGap=10)
        
        line_count = len(lines) if lines is not None else 0
        
        # If there's a traffic light, we expect zebra crossings. 
        # If very few or no strong lines are found, it's missing/faded.
        if line_count < 3:
            confidence = 0.7 + (3 - line_count) * 0.1
            detections.append(SceneDetection(
                class_name="missing_zebra",
                confidence=round(confidence, 3),
                description=f"Faded/Missing zebra crossing at intersection (lines={line_count})",
                bbox=(0.0, float(y_offset), float(w), float(h))
            ))
            logger.info("Scene analysis: missing_zebra detected")
            
    except Exception as e:
        logger.error(f"Missing zebra scene analysis error: {e}")
        
    return detections


def detect_damaged_divider(frame: np.ndarray) -> list[SceneDetection]:
    """
    Detect damaged or missing road dividers by finding the center line and checking continuity.
    """
    detections = []
    try:
        h, w = frame.shape[:2]
        y_offset = int(h * 0.4)
        roi = frame[y_offset:, int(w * 0.25):int(w * 0.75)] # center column
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        
        edges = cv2.Canny(gray, 50, 150)
        # Check density of edges in the expected divider region
        density = cv2.countNonZero(edges) / (roi.shape[0] * roi.shape[1])
        
        # If density is extremely low, there might be no divider, but it could just be a flat road.
        # We flag it if we expect a divided highway. For now, we'll use a heuristic:
        # High texture variance in the center but lacking straight lines suggests a broken divider.
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 50, minLineLength=40, maxLineGap=20)
        
        texture_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        if lines is None and texture_var > 300 and density > 0.05:
            # Irregular texture but no straight lines -> possibly broken median
            bbox = (float(w*0.25), float(y_offset), float(w*0.75), float(h))
            detections.append(SceneDetection(
                class_name="damaged_divider",
                confidence=0.65,
                description=f"Damaged/Broken road divider detected (var={texture_var:.0f})",
                bbox=bbox
            ))
            logger.info("Scene analysis: damaged_divider detected")
            
    except Exception as e:
        logger.error(f"Damaged divider scene analysis error: {e}")
        
    return detections


def detect_damaged_signboard(frame: np.ndarray, sign_detections: list) -> list[SceneDetection]:
    """
    Check detected traffic signs for severe deformation or defacing.
    """
    detections = []
    try:
        h, w = frame.shape[:2]
        for det in sign_detections:
            if det.class_name not in ('traffic_light', 'stop_sign', 'traffic_object'):
                continue
                
            x1, y1, x2, y2 = [int(c) for c in det.bbox]
            x1, y1, x2, y2 = max(0, x1), max(0, y1), min(w, x2), min(h, y2)
            crop = frame[y1:y2, x1:x2]
            
            if crop.size == 0 or crop.shape[0] < 20 or crop.shape[1] < 20:
                continue
                
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            # Find contours inside the sign bounding box. If it's highly irregular, it's damaged.
            _, thresh = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contours:
                largest = max(contours, key=cv2.contourArea)
                # Compare bounding rect vs contour area. Standard signs are regular shapes.
                rect = cv2.minAreaRect(largest)
                box = cv2.boxPoints(rect)
                rect_area = cv2.contourArea(box)
                actual_area = cv2.contourArea(largest)
                
                texture_var = cv2.Laplacian(gray, cv2.CV_64F).var()
                
                is_damaged = False
                if rect_area > 0:
                    fill_ratio = actual_area / rect_area
                    if fill_ratio < 0.8: # Highly irregular shape (bent sign)
                        is_damaged = True
                
                if texture_var > 1000: # Crumpled / faded / graffitied
                    is_damaged = True
                        
                if is_damaged:
                    detections.append(SceneDetection(
                        class_name="damaged_signboard",
                        confidence=0.85,
                        description=f"Damaged/Deformed traffic sign (var={texture_var:.0f})",
                        bbox=det.bbox
                    ))
                    logger.info("Scene analysis: damaged signboard detected")
                        
    except Exception as e:
        logger.error(f"Damaged signboard scene analysis error: {e}")
        
    return detections
