"""
FastAPI main application entry point.
"""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config import settings
from .database import init_db
from .routers import events_router, sessions_router, analytics_router, upload_router, reports_router
from .ws.detection_ws import detection_websocket

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    # Initialize database tables
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        logger.warning("Continuing without database — some features will not work")

    # Create evidence directory
    os.makedirs(settings.EVIDENCE_DIR, exist_ok=True)

    yield

    logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Powered Urban Intelligence Platform for real-time road condition monitoring",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount evidence directory for serving saved images
if os.path.exists(settings.EVIDENCE_DIR):
    app.mount("/api/evidence", StaticFiles(directory=settings.EVIDENCE_DIR), name="evidence")

# Mount dataset directories for Trained Data Dashboard
for dataset_dir, name in [
    ("Pothole-Detection--9", "dataset_potholes"),
    ("Road-Damage-1", "dataset_road_damage"),
    ("indian-license-plates-1", "dataset_license_plates")
]:
    dataset_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), dataset_dir)
    if not os.path.exists(dataset_path):
        dataset_path = os.path.join(os.getcwd(), dataset_dir)
    if os.path.exists(dataset_path):
        app.mount(f"/api/datasets/{name}", StaticFiles(directory=dataset_path), name=name)

# Register API routers
app.include_router(events_router)
app.include_router(sessions_router)
app.include_router(analytics_router)
app.include_router(upload_router)
app.include_router(reports_router)

# Register WebSocket endpoints
app.websocket("/ws/detect")(detection_websocket)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/api/models/info")
async def get_model_info():
    """Get information about loaded AI models."""
    from .ws.detection_ws import get_pipeline
    try:
        pipeline = await get_pipeline()
        return pipeline.model_info
    except Exception as e:
        return {"error": str(e), "pipeline_initialized": False}
