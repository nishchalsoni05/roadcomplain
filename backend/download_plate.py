import os
import urllib.request

model_dir = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(model_dir, exist_ok=True)
plate_path = os.path.join(model_dir, 'plate.pt')

if not os.path.exists(plate_path):
    print("Downloading fallback plate.pt model for ANPR...")
    # Downloading a standard nano model as a fallback so the backend doesn't crash
    # If the user has a real license plate model, they can replace this file.
    url = "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt"
    urllib.request.urlretrieve(url, plate_path)
    print("Downloaded successfully to", plate_path)
else:
    print("plate.pt already exists.")
