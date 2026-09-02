"""
Application configuration using Pydantic BaseSettings.
All values are loaded from environment variables or .env file.
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://roadrepair:roadrepair@localhost:5432/roadrepair"
    DATABASE_SYNC_URL: str = "postgresql://roadrepair:roadrepair@localhost:5432/roadrepair"

    # Application
    APP_NAME: str = "RoadRepair"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]

    # AI Models
    YOLO_GENERAL_MODEL: str = "yolov8n.pt"
    YOLO_POTHOLE_MODEL: Optional[str] = None  # Path to custom-trained pothole model
    YOLO_ROAD_DAMAGE_MODEL: Optional[str] = None  # Path to custom-trained road damage model
    YOLO_PLATE_MODEL: Optional[str] = None  # Path to custom-trained license plate model
    DETECTION_CONFIDENCE_THRESHOLD: float = 0.35
    TRACKER_TYPE: str = "bytetrack.yaml"

    # Inference
    DEVICE: str = "cpu"  # "cpu" or "cuda" or "0" for GPU
    MAX_FPS: int = 30  # Max frames per second to process
    FRAME_SKIP: int = 1  # Process every Nth frame for performance

    # Evidence storage
    EVIDENCE_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "evidence")

    # Nominatim (OpenStreetMap reverse geocoding)
    NOMINATIM_URL: str = "https://nominatim.openstreetmap.org/reverse"
    NOMINATIM_RATE_LIMIT: float = 1.0  # seconds between requests

    # Road Health Score weights
    RH_WEIGHT_POTHOLE: float = 10.0
    RH_WEIGHT_ROAD_DAMAGE: float = 8.0
    RH_WEIGHT_WATERLOGGING: float = 6.0
    RH_WEIGHT_MISSING_SIGNAGE: float = 7.0
    RH_WEIGHT_DAMAGED_DIVIDER: float = 5.0
    RH_WEIGHT_MISSING_ZEBRA: float = 4.0

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30  # seconds

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
