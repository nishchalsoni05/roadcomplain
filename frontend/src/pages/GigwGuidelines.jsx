import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Signup.css'; // Reusing the same layout styles for simplicity

export default function GigwGuidelines() {
  const navigate = useNavigate();

  return (
    <div className="gov-page-container">
      <div className="gov-top-bar">
        <div className="gov-container">
          <div className="gov-top-links">
            <a href="#main-content">Skip to Main Content</a>
            <span>|</span>
            <a href="#">Screen Reader Access</a>
          </div>
          <div className="gov-top-links">
            <span className="lang-selector">English</span>
          </div>
        </div>
      </div>

      <header className="gov-header">
        <div className="gov-container">
          <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem of India" className="gov-emblem" />
            <div className="brand-text">
              <h1>MargDarshan AI</h1>
              <p>Government of India</p>
            </div>
          </div>
        </div>
      </header>

      <nav className="gov-nav">
        <div className="gov-container">
          <ul>
            <li onClick={() => navigate('/')}>Home</li>
            <li>About</li>
            <li>Services</li>
            <li className="active">GIGW Guidelines</li>
            <li onClick={() => navigate('/signup')}>Sign Up</li>
          </ul>
        </div>
      </nav>

      <main className="gov-main-content guidelines-main" id="main-content">
        <div className="gov-container document-layout">
          <aside className="doc-sidebar">
            <h3>Contents</h3>
            <ul>
              <li><a href="#introduction">1. Introduction</a></li>
              <li><a href="#eligibility">2. Eligibility Criteria</a></li>
              <li><a href="#process">3. Certification Process</a></li>
              <li><a href="#compliance">4. Compliance & Audits</a></li>
              <li><a href="#contact">5. Contact Authorities</a></li>
            </ul>
          </aside>
          <article className="doc-content">
            <h2>GIGW Certification Guidelines</h2>
            <div className="last-updated">Last Updated: September 2026</div>
            
            <section id="introduction">
              <h3>1. Introduction</h3>
              <p>The Government Integrated Web Optimization (GIGW) Certification ensures that all digital infrastructure monitoring systems meet the stringent security, accessibility, and performance standards set forth by the Ministry of Road Transport and Highways (MoRTH).</p>
            </section>

            <section id="eligibility">
              <h3>2. Eligibility Criteria</h3>
              <ul>
                <li>Must be a registered entity operating within the jurisdiction of India.</li>
                <li>Must deploy AI models that adhere to the National Data Protection policies.</li>
                <li>Must ensure 99.9% uptime for critical infrastructure reporting.</li>
              </ul>
            </section>

            <section id="process">
              <h3>3. Certification Process</h3>
              <ol>
                <li><strong>Registration:</strong> Create an official account on MargDarshan AI via the <a href="/signup" onClick={(e) => { e.preventDefault(); navigate('/signup'); }}>Sign Up</a> portal.</li>
                <li><strong>Documentation Submission:</strong> Submit technical architecture, AI accuracy reports (minimum 92% confidence score required for hazard detection), and data sovereignty proofs.</li>
                <li><strong>Audit Phase:</strong> A government-appointed technical committee will review the system for 30 days.</li>
                <li><strong>Issuance:</strong> Upon successful audit, the GIGW certificate is issued with a validity of 2 years.</li>
              </ol>
            </section>

            <section id="compliance">
              <h3>4. Compliance & Audits</h3>
              <p>Certified entities are subject to random quarterly audits. Failure to comply with the real-time reporting latency (&lt; 50ms) may result in immediate revocation of the certificate.</p>
            </section>

            <section id="contact">
              <h3>5. Contact Authorities</h3>
              <p>For any disputes or clarifications regarding the GIGW certification, contact the Nodal Officer at <strong>gigw-support@gov.in</strong>.</p>
            </section>
          </article>
        </div>
      </main>

      <footer className="gov-footer">
        <div className="gov-container">
          <p>© {new Date().getFullYear()} MargDarshan AI. Designed and Developed by National Informatics Centre (NIC) - Mockup.</p>
        </div>
      </footer>
    </div>
  );
}
