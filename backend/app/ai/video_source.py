"""
VideoSource abstraction layer.
Provides a unified interface for all video input sources so the AI pipeline
processes frames identically regardless of origin.
"""
import cv2
import numpy as np
import base64
import time
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Optional, AsyncGenerator, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class FrameData:
    """A single video frame with metadata."""
    frame: np.ndarray  # BGR image
    frame_number: int
    timestamp: float  # Unix timestamp
    source_type: str


class VideoSource(ABC):
    """
    Abstract base class for all video sources.
    All implementations yield FrameData objects via the same interface,
    ensuring the AI pipeline is completely agnostic to the source.
    """

    @abstractmethod
    async def get_frame(self) -> Optional[FrameData]:
        """Get the next frame. Returns None if no frame available."""
        pass

    @abstractmethod
    async def start(self):
        """Initialize the video source."""
        pass

    @abstractmethod
    async def stop(self):
        """Release resources."""
        pass

    @property
    @abstractmethod
    def source_type(self) -> str:
        pass

    @property
    @abstractmethod
    def is_active(self) -> bool:
        pass


class WebRTCSource(VideoSource):
    """
    Receives frames from browser WebRTC camera via WebSocket.
    Frames arrive as base64-encoded JPEG from the frontend.
    """

    def __init__(self):
        self._frame_buffer: Optional[FrameData] = None
        self._frame_count = 0
        self._active = False

    async def start(self):
        self._active = True
        self._frame_count = 0
        logger.info("WebRTC video source started")

    async def stop(self):
        self._active = False
        self._frame_buffer = None
        logger.info("WebRTC video source stopped")

    def push_frame(self, base64_jpeg: str) -> Optional[FrameData]:
        """
        Called by WebSocket handler when a frame arrives from the browser.
        Decodes base64 JPEG into an OpenCV frame.
        """
        try:
            # Remove data URL prefix if present
            if "," in base64_jpeg:
                base64_jpeg = base64_jpeg.split(",", 1)[1]

            img_bytes = base64.b64decode(base64_jpeg)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                logger.warning("Failed to decode frame")
                return None

            self._frame_count += 1
            self._frame_buffer = FrameData(
                frame=frame,
                frame_number=self._frame_count,
                timestamp=time.time(),
                source_type="webrtc"
            )
            return self._frame_buffer
        except Exception as e:
            logger.error(f"Error decoding WebRTC frame: {e}")
            return None

    async def get_frame(self) -> Optional[FrameData]:
        return self._frame_buffer

    @property
    def source_type(self) -> str:
        return "webrtc"

    @property
    def is_active(self) -> bool:
        return self._active


class IPCameraSource(VideoSource):
    """
    Connects to an IP camera stream (RTSP/HTTP) via OpenCV.
    The phone runs an IP camera app that exposes a stream URL.
    """

    def __init__(self, stream_url: str):
        self._stream_url = stream_url
        self._capture: Optional[cv2.VideoCapture] = None
        self._frame_count = 0
        self._active = False

    async def start(self):
        """Connect to the IP camera stream."""
        loop = asyncio.get_event_loop()
        self._capture = await loop.run_in_executor(
            None, lambda: cv2.VideoCapture(self._stream_url)
        )
        if not self._capture.isOpened():
            raise ConnectionError(f"Cannot connect to IP camera at {self._stream_url}")
        self._active = True
        self._frame_count = 0
        logger.info(f"IP camera source connected: {self._stream_url}")

    async def stop(self):
        if self._capture:
            self._capture.release()
        self._active = False
        logger.info("IP camera source stopped")

    async def get_frame(self) -> Optional[FrameData]:
        if not self._capture or not self._capture.isOpened():
            return None

        loop = asyncio.get_event_loop()
        ret, frame = await loop.run_in_executor(
            None, self._capture.read
        )
        if not ret:
            return None

        self._frame_count += 1
        return FrameData(
            frame=frame,
            frame_number=self._frame_count,
            timestamp=time.time(),
            source_type="ip_camera"
        )

    @property
    def source_type(self) -> str:
        return "ip_camera"

    @property
    def is_active(self) -> bool:
        return self._active and self._capture is not None and self._capture.isOpened()


class UploadedVideoSource(VideoSource):
    """
    Reads frames from an uploaded video file.
    Used for incident simulation and analysis of recorded footage.
    """

    def __init__(self, video_path: str, target_fps: int = 15):
        self._video_path = video_path
        self._target_fps = target_fps
        self._capture: Optional[cv2.VideoCapture] = None
        self._frame_count = 0
        self._active = False
        self._original_fps = 30.0
        self._total_frames = 0

    async def start(self):
        loop = asyncio.get_event_loop()
        self._capture = await loop.run_in_executor(
            None, lambda: cv2.VideoCapture(self._video_path)
        )
        if not self._capture.isOpened():
            raise FileNotFoundError(f"Cannot open video file: {self._video_path}")

        self._original_fps = self._capture.get(cv2.CAP_PROP_FPS) or 30.0
        self._total_frames = int(self._capture.get(cv2.CAP_PROP_FRAME_COUNT))
        self._active = True
        self._frame_count = 0
        logger.info(f"Uploaded video source opened: {self._video_path} "
                     f"({self._total_frames} frames @ {self._original_fps:.1f} FPS)")

    async def stop(self):
        if self._capture:
            self._capture.release()
        self._active = False
        logger.info("Uploaded video source stopped")

    async def get_frame(self) -> Optional[FrameData]:
        if not self._capture or not self._capture.isOpened():
            return None

        # Calculate frame skip to match target FPS
        skip = max(1, int(self._original_fps / self._target_fps))

        loop = asyncio.get_event_loop()
        for _ in range(skip - 1):
            await loop.run_in_executor(None, self._capture.grab)

        ret, frame = await loop.run_in_executor(None, self._capture.read)
        if not ret:
            self._active = False
            return None

        self._frame_count += 1
        video_time = self._capture.get(cv2.CAP_PROP_POS_MSEC) / 1000.0

        return FrameData(
            frame=frame,
            frame_number=self._frame_count,
            timestamp=video_time,
            source_type="uploaded_video"
        )

    @property
    def source_type(self) -> str:
        return "uploaded_video"

    @property
    def is_active(self) -> bool:
        return self._active

    @property
    def progress(self) -> float:
        """Returns progress as a value between 0 and 1."""
        if not self._capture or self._total_frames == 0:
            return 0.0
        current = self._capture.get(cv2.CAP_PROP_POS_FRAMES)
        return min(current / self._total_frames, 1.0)
