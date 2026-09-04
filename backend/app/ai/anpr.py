"""
ANPR Pipeline — Automatic Number Plate Recognition.
Two-stage: YOLOv8 plate detection → PaddleOCR text extraction.
Used for hit-and-run identification.
"""
import re
import cv2
import numpy as np
import logging
from typing import Optional
from dataclasses import dataclass
from .detector import Detector, Detection

logger = logging.getLogger(__name__)


@dataclass
class PlateReading:
    """Result of license plate recognition from real OCR inference."""
    plate_text: str
    confidence: float  # OCR confidence
    detection_confidence: float  # Plate detection confidence
    bbox: tuple  # Plate bounding box
    plate_crop: Optional[np.ndarray] = None  # Cropped plate image

    def to_dict(self) -> dict:
        return {
            "plate_text": self.plate_text,
            "confidence": self.confidence,
            "detection_confidence": self.detection_confidence,
            "bbox": list(self.bbox),
        }


# Indian license plate pattern: XX 00 XX 0000
INDIAN_PLATE_PATTERN = re.compile(
    r'^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{1,4}$'
)


class ANPRPipeline:
    """
    Two-stage ANPR pipeline:
    1. Detect license plates in frame (YOLOv8 custom model)
    2. Extract text via OCR (PaddleOCR or EasyOCR fallback)
    """

    def __init__(self, detector: Detector):
        self._detector = detector
        self._ocr = None
        self._ocr_type = None
        self._initialized = False

    async def initialize(self):
        """Load OCR engine. Tries PaddleOCR first, falls back to EasyOCR."""
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._init_ocr)

    def _init_ocr(self):
        """Try loading PaddleOCR, fallback to EasyOCR."""
        # Try PaddleOCR
        try:
            from paddleocr import PaddleOCR
            self._ocr = PaddleOCR(
                use_angle_cls=True,
                lang='en',
                show_log=False,
                use_gpu=False
            )
            self._ocr_type = "paddleocr"
            self._initialized = True
            logger.info("ANPR: PaddleOCR loaded successfully")
            return
        except ImportError:
            logger.info("PaddleOCR not available, trying EasyOCR...")
        except Exception as e:
            logger.warning(f"PaddleOCR init failed: {e}, trying EasyOCR...")

        # Fallback to EasyOCR
        try:
            import easyocr
            self._ocr = easyocr.Reader(['en'], gpu=False)
            self._ocr_type = "easyocr"
            self._initialized = True
            logger.info("ANPR: EasyOCR loaded as fallback")
            return
        except ImportError:
            logger.error("Neither PaddleOCR nor EasyOCR available. ANPR OCR will not work.")
        except Exception as e:
            logger.error(f"EasyOCR init failed: {e}")

    def process_frame(self, frame: np.ndarray, plate_detections: list[Detection]) -> list[PlateReading]:
        """
        Run full ANPR pipeline on a frame using provided plate detections.
        Extracts text via OCR and validates format.
        """
        if not self._initialized or not plate_detections:
            return []

        readings = []
        for det in plate_detections:
            # Step 2: Crop plate region
            x1, y1, x2, y2 = [int(c) for c in det.bbox]
            # Add small padding
            h, w = frame.shape[:2]
            pad = 5
            x1 = max(0, x1 - pad)
            y1 = max(0, y1 - pad)
            x2 = min(w, x2 + pad)
            y2 = min(h, y2 + pad)
            plate_crop = frame[y1:y2, x1:x2]

            if plate_crop.size == 0:
                continue

            # Step 3: Preprocess for OCR
            plate_processed = self._preprocess_plate(plate_crop)

            # Step 4: Run OCR
            text, conf = self._run_ocr(plate_processed)
            if text and conf > 0.3:
                # Step 5: Post-process and validate
                cleaned = self._clean_plate_text(text)
                if cleaned:
                    readings.append(PlateReading(
                        plate_text=cleaned,
                        confidence=conf,
                        detection_confidence=det.confidence,
                        bbox=det.bbox,
                        plate_crop=plate_crop
                    ))

        return readings

    def process_vehicle_crop(self, vehicle_crop: np.ndarray) -> list[PlateReading]:
        """Run ANPR on a cropped vehicle image (used in hit-and-run pipeline)."""
        if not self._initialized:
            return []

        # Run OCR directly on the crop (when plate detection model isn't available)
        text, conf = self._run_ocr(self._preprocess_plate(vehicle_crop))
        if text and conf > 0.3:
            cleaned = self._clean_plate_text(text)
            if cleaned:
                return [PlateReading(
                    plate_text=cleaned,
                    confidence=conf,
                    detection_confidence=0.0,
                    bbox=(0, 0, vehicle_crop.shape[1], vehicle_crop.shape[0]),
                    plate_crop=vehicle_crop
                )]
        return []

    def _preprocess_plate(self, plate_img: np.ndarray) -> np.ndarray:
        """Preprocess plate image for better OCR accuracy."""
        # Resize to consistent height
        target_h = 64
        h, w = plate_img.shape[:2]
        if h == 0:
            return plate_img
        scale = target_h / h
        plate_img = cv2.resize(plate_img, (int(w * scale), target_h))

        # Convert to grayscale
        gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)

        # Apply CLAHE for contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # Threshold
        _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        return binary

    def _run_ocr(self, image: np.ndarray) -> tuple[str, float]:
        """Run OCR and return (text, confidence). Uses whichever engine is loaded."""
        if self._ocr is None:
            return ("", 0.0)

        try:
            if self._ocr_type == "paddleocr":
                results = self._ocr.ocr(image, cls=True)
                if results and results[0]:
                    texts = []
                    confs = []
                    for line in results[0]:
                        text = line[1][0]
                        conf = line[1][1]
                        texts.append(text)
                        confs.append(conf)
                    full_text = " ".join(texts)
                    avg_conf = sum(confs) / len(confs) if confs else 0.0
                    return (full_text, avg_conf)

            elif self._ocr_type == "easyocr":
                results = self._ocr.readtext(image)
                if results:
                    texts = [r[1] for r in results]
                    confs = [r[2] for r in results]
                    full_text = " ".join(texts)
                    avg_conf = sum(confs) / len(confs) if confs else 0.0
                    return (full_text, avg_conf)

        except Exception as e:
            logger.error(f"OCR error: {e}")

        return ("", 0.0)

    @staticmethod
    def _clean_plate_text(text: str) -> str:
        """Clean and validate extracted plate text."""
        # Remove special characters, keep alphanumeric and spaces
        cleaned = re.sub(r'[^A-Za-z0-9\s]', '', text.upper().strip())
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        if len(cleaned) < 4:
            return ""

        # Check if it matches Indian plate pattern
        if INDIAN_PLATE_PATTERN.match(cleaned):
            return cleaned

        # Even if it doesn't match the Indian pattern exactly,
        # return it if it has a reasonable length (could be non-Indian plate)
        if 4 <= len(cleaned) <= 15:
            return cleaned

        return ""

    @property
    def is_available(self) -> bool:
        return self._initialized
