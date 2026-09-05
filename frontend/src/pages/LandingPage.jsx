import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ShieldCheck, Map, Users, AlertTriangle, Video, Cpu, ScanSearch, MapPin, ChevronDown } from 'lucide-react';
import './Signup.css'; // Reusing base layout styles
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();

  const highwayImages = [
    '/images/ai_traffic.jpg',
    '/images/drone_inspection.jpg',
    '/images/gis_command_center.jpg'
  ];
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % highwayImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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
          <div className="brand">
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
            <li className="active">Home</li>
            <li onClick={() => navigate('/about-ministry')}>About Ministry</li>
            <li onClick={() => navigate('/how-it-works')}>How It Works</li>
            <li onClick={() => navigate('/signup')}>Sign Up / Register</li>
            <li onClick={() => navigate('/login')}>Login (Dashboard)</li>
          </ul>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="gov-main-content" id="main-content">
        
        {/* Hero Section */}
        <section className="gov-hero-section">
          <div className="gov-container hero-grid">
            <div className="hero-text-content">
              <h2>Next-Generation Autonomous Traffic & Incident Intelligence</h2>
              <p>Empowering Smart Cities to detect, map, and repair infrastructure instantly using state-of-the-art AI. Certified under the GIGW Guidelines.</p>
              <div className="hero-actions">
                <button className="gov-btn-primary" onClick={() => navigate('/signup')}>Register Department</button>
                <button className="btn-outline" onClick={() => navigate('/gigw-guidelines')}>View Guidelines</button>
              </div>
            </div>
            <div className="hero-image-placeholder">
              <div className="hero-banner-image" style={{ background: 'none' }}>
                <img 
                  src={highwayImages[currentImageIndex]} 
                  alt="Indian Highway" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 0, transition: 'opacity 0.5s ease' }} 
                />
              </div>
            </div>
          </div>
        </section>





        {/* Services & Features Section */}
        <section className="gov-services-section">
          <div className="gov-container">
            <h2 className="section-title">Key Initiatives & Core Features</h2>
            <div className="services-grid">
              <div className="service-card">
                <Activity className="service-icon" />
                <h3>Live AI Detection</h3>
                <p>Connect CCTV and drone feeds for real-time monitoring of road conditions and traffic flow.</p>

              </div>
              <div className="service-card">
                <ShieldCheck className="service-icon" />
                <h3>GIGW Compliance</h3>
                <p>Ensure all systems meet the strict Government Integrated Web Optimization standards.</p>

              </div>
              <div className="service-card">
                <Map className="service-icon" />
                <h3>GIS Command Center</h3>
                <p>Interactive mapping of incident hotspots, structural damages, and repair statuses.</p>

              </div>
              <div className="service-card">
                <AlertTriangle className="service-icon" />
                <h3>Incident Analytics</h3>
                <p>Deep data insights on accident-prone zones and predictive analytics for prevention.</p>

              </div>
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
