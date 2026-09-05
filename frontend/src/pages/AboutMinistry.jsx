import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import './Signup.css'; // Reusing base layout styles
import './LandingPage.css'; // Reusing footer styles
import './AboutMinistry.css';

export default function AboutMinistry() {
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
            <li className="active">About Ministry</li>
            <li onClick={() => navigate('/how-it-works')}>How It Works</li>
            <li onClick={() => navigate('/signup')}>Sign Up / Register</li>
            <li onClick={() => navigate('/login')}>Login (Dashboard)</li>
          </ul>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="gov-main-content" id="main-content">
        
        {/* Hero Section */}
        <section className="ministry-hero">
          <div className="gov-container">
            <h2>Governing Bodies & Technology Partners</h2>
            <p>MargDarshan AI is a collaborative digital infrastructure initiative spearheaded by the apex road transport bodies of India, powered by state-of-the-art national digital infrastructure.</p>
          </div>
        </section>

        {/* Content Section */}
        <section className="ministry-section">
          <div className="gov-container">
            
            {/* MoRTH Card */}
            <div className="ministry-card">
              <div className="ministry-image">
                <img src="/images/morth_building.jpg" alt="MoRTH Headquarters" />
              </div>
              <div className="ministry-content">
                <h3>Ministry of Road Transport and Highways (MoRTH)</h3>
                <div className="ministry-subtitle">Apex Policy Maker & Governing Body</div>
                <p>The Ministry of Road Transport and Highways (MoRTH) is the apex body for formulation and administration of the rules, regulations and laws relating to road transport, transport research and in also to increase the mobility and efficiency of the road transport system in India.</p>
                <p>For the MargDarshan AI initiative, MoRTH acts as the central policy-maker, defining the safety standards, compliance requirements, and nationwide deployment strategies for AI-driven infrastructure monitoring.</p>
                <a href="https://morth.nic.in/" target="_blank" rel="noopener noreferrer" className="ministry-link">
                  Visit MoRTH Website <ExternalLink />
                </a>
              </div>
            </div>

            {/* NHAI Card */}
            <div className="ministry-card">
              <div className="ministry-image">
                <img src="/images/nhai_highway.jpg" alt="NHAI Highway Project" />
              </div>
              <div className="ministry-content">
                <h3>National Highways Authority of India (NHAI)</h3>
                <div className="ministry-subtitle">Operational Arm & Infrastructure Developer</div>
                <p>NHAI was constituted by an Act of Parliament, the National Highways Authority of India Act, 1988. It is responsible for the development, maintenance and management of National Highways entrusted to it and/or matters connected or incidental thereto.</p>
                <p>NHAI is the primary operational beneficiary of MargDarshan AI. Their on-ground toll plazas, inspection drones, and highway patrolling vehicles utilize our real-time AI inferences to dispatch rapid repair units and manage structural damages before they escalate.</p>
                <a href="https://nhai.gov.in/" target="_blank" rel="noopener noreferrer" className="ministry-link">
                  Visit NHAI Website <ExternalLink />
                </a>
              </div>
            </div>

            {/* NIC Card */}
            <div className="ministry-card">
              <div className="ministry-image">
                <img src="/images/nic_servers.jpg" alt="NIC Data Center" />
              </div>
              <div className="ministry-content">
                <h3>National Informatics Centre (NIC)</h3>
                <div className="ministry-subtitle">Technology Partner & Digital Backbone</div>
                <p>The National Informatics Centre under the Ministry of Electronics and Information Technology (MeitY) is the technology partner of the Government of India. NIC provides network backbone and e-Governance support to Central Government, State Governments, and UT Administrations.</p>
                <p>The MargDarshan AI platform is hosted on NIC's highly secure, scalable MeghRaj cloud infrastructure. NIC ensures that all data ingestion, AI processing, and GIS mapping comply with stringent Government Integrated Web Optimization (GIGW) and data localization laws.</p>
                <a href="https://www.nic.in/" target="_blank" rel="noopener noreferrer" className="ministry-link">
                  Visit NIC Website <ExternalLink />
                </a>
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
