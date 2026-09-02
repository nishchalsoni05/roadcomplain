"""Test scene analysis on multiple images to verify no false positives."""
import cv2
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.ai.scene_analysis import detect_waterlogging

upload_dir = os.path.join("evidence", "uploads")
files = sorted(os.listdir(upload_dir))[-10:]

for f in files:
    fp = os.path.join(upload_dir, f)
    frame = cv2.imread(fp)
    if frame is None:
        print(f"  {f}: SKIP (can't read)")
        continue
    
    results = detect_waterlogging(frame)
    if results:
        for r in results:
            print(f"  {f}: ** {r.class_name} ** conf={r.confidence} - {r.description}")
    else:
        print(f"  {f}: No waterlogging detected")
