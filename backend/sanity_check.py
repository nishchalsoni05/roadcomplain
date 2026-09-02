import asyncio
import cv2
import json
from app.ai.pipeline import AIPipeline
from app.ai.video_source import FrameData

async def main():
    print("Initializing pipeline...")
    pipeline = AIPipeline()
    await pipeline.initialize()
    print("Pipeline initialized.")

    image_path = r"C:\Users\Nishchal Soni\Downloads\transport\backend\evidence\uploads\01e4034e39b24065ad5cebcaea8cf94b.jpg"
    frame = cv2.imread(image_path)
    if frame is None:
        print(f"Failed to load image: {image_path}")
        return

    frame_data = FrameData(frame=frame, frame_number=1, timestamp=0.0, source_type="test")
    
    print("Running process_frame...")
    result = await pipeline.process_frame(frame_data)
    
    # We serialize ignoring numpy arrays in detections to just print it out nicely
    out = {
        "detections": [{"class": d.class_name, "conf": d.confidence} for d in result.detections],
        "plates": [p.plate_text for p in result.plate_readings],
        "intel": [e.event_type for e in result.intelligence_events]
    }
    print(json.dumps(out, indent=2))
    print("Sanity check completed successfully.")

if __name__ == "__main__":
    asyncio.run(main())
