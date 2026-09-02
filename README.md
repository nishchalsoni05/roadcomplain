# Mobile Urban Sensing Intelligence Platform 🚌📹 

An Edge-AI powered onboard and centralized software platform that transforms public transport buses into mobile urban sensing units. By leveraging existing bus-mounted cameras, this system provides real-time situational awareness for city authorities, identifying road defects, traffic bottlenecks, vulnerable pedestrians, and critical incidents like hit-and-runs.

---

## 🎯 The Problem Statement Addressed
Urban public transport buses traverse almost every major road in a city every day, yet their onboard cameras are underutilized as intelligent sensing platforms. City authorities rely on fixed CCTVs, manual inspections, and citizen complaints, leading to delayed responses and inefficient maintenance planning.

**This solution provides:**
1. **Infrastructure Health Monitoring:** Detects potholes, damaged roads, missing dividers, missing zebra crossings, missing signboards, and waterlogging.
2. **Traffic Analytics:** Vehicle detection, classification, counting, and bottleneck identification.
3. **Public Safety:** Detection of vulnerable pedestrian situations (e.g., school children crossing).
4. **Critical Incident Tracking:** Detection of Hit-and-Run, Rash Driving, and Vehicle Collisions with automatic tracking of the offending vehicle, license plate extraction (ANPR) with confidence scores, timestamps, and GPS locations.
5. **Centralized GIS Dashboard:** Aggregates edge-processed alerts onto an interactive GIS map for transport authorities to visualize events, generate congestion heatmaps, and plan proactive maintenance.

---

## 🧠 AI Pipeline & Workflow Architecture

The core of the system is the **AI Intelligence Pipeline**, designed to minimize bandwidth through intelligent edge processing before sending alerts to the centralized platform.

### 1. Data Ingestion (Edge)
- Consumes video streams via RTSP (IP Cameras), WebRTC (Phone/Dashcams), or uploaded video files.
- Processes frames locally on the edge device to save bandwidth.

### 2. Detection & Classification Layer (`detector.py`)
Utilizes a multi-model YOLOv8 ensemble:
- **General Model (COCO):** Tracks vehicles (cars, buses, trucks, motorcycles) and pedestrians.
- **Custom Road Defect Models:** Dedicated YOLOv8 models trained specifically for Potholes, Waterlogging, missing signage, and damaged dividers.
- **ANPR Model:** Custom YOLOv8 model for License Plate Detection.

### 3. Multi-Object Tracking (`pipeline.py`)
- Uses **ByteTrack** for persistent multi-object tracking.
- Assigns unique `track_id`s to vehicles and pedestrians across frames to establish continuous movement trajectories.

### 4. Intelligence & Event Fusion Layer (`intelligence.py` & `event_fusion.py`)
This is the "Brain" of the operation. It analyzes the trajectories over time rather than just looking at static frames:
- **Collision / Hit-and-Run:** Monitors vehicle speeds. If a vehicle's speed drops abruptly from > 50px/sec to < 15px/sec while its bounding box intersects with another vehicle, a **Vehicle Collision** is triggered.
- **Rash Driving:** Calculates lateral variance (swerving) over 20+ frames.
- **Event Fusion (Debouncing):** Prevents spamming the database. If a pothole is in the camera view for 5 seconds, the `EventFusionEngine` ensures it is only logged as a single, high-confidence incident rather than 150 separate events.

### 5. Centralized Reporting & Dashboard
- Confirmed incidents are dispatched to the PostgreSQL database with GPS coordinates, timestamps, severity ratings, and confidence scores.
- The React frontend pulls this data in real-time, plotting it on a Leaflet GIS Map and generating dynamic, filterable Test History reports.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Framer Motion, Leaflet.js, Recharts |
| **Backend** | FastAPI (Python), WebSocket, SQLAlchemy |
| **AI/ML** | Ultralytics (YOLOv8), ByteTrack, OpenCV, PyTorch (CUDA) |
| **Database** | PostgreSQL + JSONB (for dynamic event metadata) |
| **Maps & GIS**| OpenStreetMap + Leaflet.js |

---

## 🚀 Setup & Installation

### 1. Database Setup
Ensure PostgreSQL is running. You can use the provided docker-compose:
```bash
docker-compose up -d
```

### 2. Backend & AI Environment
*Note: A CUDA-enabled Nvidia GPU is highly recommended for real-time edge processing.*
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt

# Install PyTorch with GPU support
pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### 3. Model Training & Integration
The system relies on custom-trained models. We have provided automated training scripts using Roboflow datasets.
1. Run `pip install roboflow ultralytics`
2. Execute the training scripts:
   - `python train_potholes.py`
   - `python train_license_plates.py`
   - `python train_road_damage.py`
3. The scripts will automatically download the datasets, train on your GPU, and place the compiled `.pt` weights in `backend/models/`.

### 4. Start the Application
**Backend:**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser to access the GIS Command Dashboard.

---

## 📊 Pages & Navigation

- `/` **Overview:** Real-time summary stats and quick navigation.
- `/detect` **Live Detection:** Connect edge cameras and view the AI detection overlay in real-time.
- `/map` **GIS Command Map:** Interactive Leaflet map with colored event pins mapping out city-wide infrastructure deficiencies.
- `/history` **Test History:** Interactive popup reports sorting incidents by problem-statement priority (Hit & Run > Potholes > General Damage), displaying confidence scores and metadata.
- `/analytics` **Analytics:** Congestion heatmaps and overall road health scores.
