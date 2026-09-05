import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Cpu, ScanSearch, MapPin } from 'lucide-react';
import './Signup.css'; // Reusing base layout styles
import './LandingPage.css';
import './HowItWorks.css';

export default function HowItWorks() {
  const navigate = useNavigate();

  return (
    <div className="gov-page-container">
      {/* Top Bar */}
      <div className="gov-top-bar">
        <div className="gov-container">
          <div className="gov-top-links">
            <a href="#main-content">Skip to Main Content</a>
            <span>|</span>
            <a href="#">Screen Reader Access</a>
            <span>|</span>
            <a href="#">A+</a> <a href="#">A</a> <a href="#">A-</a>
          </div>
          <div className="gov-top-links">
            <span className="lang-selector">English</span>
            <span>|</span>
            <a href="#">हिन्दी</a>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="gov-header">
        <div className="gov-container">
          <div className="brand" onClick={() => navigate('/')} style={{cursor: 'pointer'}}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem of India" className="gov-emblem" />
            <div className="brand-text">
              <h1>MargDarshan AI</h1>
              <p>Ministry of Road Transport & Highways, Government of India</p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="gov-nav">
        <div className="gov-container">
          <ul>
            <li onClick={() => navigate('/')}>Home</li>
            <li onClick={() => navigate('/about-ministry')}>About Ministry</li>
            <li className="active">How It Works</li>
            <li onClick={() => navigate('/signup')}>Sign Up / Register</li>
            <li onClick={() => navigate('/login')}>Login (Dashboard)</li>
          </ul>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="gov-main-content" id="main-content" style={{ backgroundColor: 'var(--bg-primary)', paddingBottom: '60px' }}>
        
        {/* How It Works - AI Pipeline Section */}
        <section className="gov-pipeline-section">
          <div className="gov-container">
            <h2 className="section-title">AI Processing Pipeline</h2>
            <p className="section-subtitle">Real-time edge computing for instantaneous infrastructure damage detection</p>
            
            <div className="pipeline-container">
              
              <div className="pipeline-step">
                <div className="step-icon-wrapper pulse-blue">
                  <Video className="step-icon" />
                </div>
                <h3>1. Data Ingestion</h3>
                <p><strong>Source:</strong> Drones, CCTVs, & Dashcams</p>
                <p>High-resolution RTSP video streams are ingested in real-time across edge devices.</p>
              </div>

              <div className="pipeline-connector">
                <div className="animated-line"></div>
              </div>

              <div className="pipeline-step">
                <div className="step-icon-wrapper pulse-orange">
                  <Cpu className="step-icon" />
                </div>
                <h3>2. Edge Pre-Processing</h3>
                <p><strong>Process:</strong> Frame stabilization</p>
                <p>Images undergo noise reduction, lighting correction, and spatial down-sampling at the edge.</p>
              </div>

              <div className="pipeline-connector">
                <div className="animated-line"></div>
              </div>

              <div className="pipeline-step">
                <div className="step-icon-wrapper pulse-red">
                  <ScanSearch className="step-icon" />
                </div>
                <h3>3. AI Inference (YOLOv8)</h3>
                <p><strong>Action:</strong> Anomaly detection</p>
                <p>Custom-trained YOLOv8 neural networks apply bounding boxes to potholes and structural defects.</p>
              </div>

              <div className="pipeline-connector">
                <div className="animated-line"></div>
              </div>

              <div className="pipeline-step">
                <div className="step-icon-wrapper pulse-green">
                  <MapPin className="step-icon" />
                </div>
                <h3>4. GIS & Dispatch</h3>
                <p><strong>Output:</strong> Geotagged Alerts</p>
                <p>Defects are mapped onto the GIS dashboard with priority tiers for immediate repair dispatch.</p>
              </div>

            </div>

            <div className="detailed-technical-text">
              <h3>Technical Architecture Overview</h3>
              <p>
                MargDarshan AI utilizes a hybrid edge-to-cloud architecture designed to meet the strict demands of the Ministry of Road Transport & Highways. 
                Instead of sending raw, heavy 4K video feeds over expensive cellular networks, our system relies on <strong>Edge Computing Nodes</strong> installed directly on highway gantries and inspection drones.
              </p>
              
              <h3>Deep Learning & Computer Vision</h3>
              <p>
                At the core of our inference engine is a highly optimized version of <strong>YOLOv8 (You Only Look Once)</strong>, fine-tuned on millions of images of Indian road conditions. This model can detect over 15 different classes of road anomalies, including macro-texture degradation, alligator cracking, deep potholes, and faded lane markings. 
                Running on specialized TensorRT hardware, the model processes up to 60 frames per second (FPS) locally, ensuring that detection occurs in milliseconds.
              </p>

              <h3>Geospatial Integration (GIS)</h3>
              <p>
                Once an anomaly is detected, the bounding box data is paired with precise RTK-GPS coordinates. This lightweight JSON payload (usually under 5KB) is transmitted securely via MQTT to our central GIS Command Center. 
                Here, the anomaly is dynamically plotted on our interactive map. Using historical data and traffic flow metrics, our predictive algorithms automatically assign a severity score (Critical, High, Medium, Low) and instantly alert the nearest NHAI maintenance dispatch unit.
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="gov-footer-expanded">
        <div className="gov-container footer-grid">
          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#">MoRTH Official Site</a></li>
              <li><a href="#">National Informatics Centre</a></li>
              <li><a href="#">Digital India</a></li>
              <li><a href="#">MyGov.in</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Policies</h4>
            <ul>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Use</a></li>
              <li><a href="#">Copyright Policy</a></li>
              <li><a href="#">Hyperlinking Policy</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Contact Us</h4>
            <p>MargDarshan AI Nodal Office<br/>
               Ministry of Road Transport & Highways<br/>
               Transport Bhawan, 1, Parliament Street<br/>
               New Delhi-110001
            </p>
          </div>
        </div>
        <div className="gov-footer-bottom">
          <div className="gov-container">
            <p>Content Owned and Managed by Ministry of Road Transport & Highways, Government of India.<br/>
            Designed, Developed and Hosted by National Informatics Centre (NIC).</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
