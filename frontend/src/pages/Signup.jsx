import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Signup.css';

export default function Signup() {
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate signup success, no backend changes
    alert("Registration Successful. Please check your email for verification.");
    navigate('/');
  };

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
              <p>Ministry of Road Transport & Highways, Government of India</p>
            </div>
          </div>
        </div>
      </header>

      <nav className="gov-nav">
        <div className="gov-container">
          <ul>
            <li onClick={() => navigate('/')}>Home</li>
            <li onClick={() => navigate('/about-ministry')}>About Ministry</li>
            <li onClick={() => navigate('/how-it-works')}>How It Works</li>
            <li className="active">Sign Up / Register</li>
            <li onClick={() => navigate('/login')}>Login (Dashboard)</li>
          </ul>
        </div>
      </nav>

      <main className="gov-main-content signup-main" id="main-content">
        <div className="signup-card">
          <div className="signup-header">
            <h2>Official Registration</h2>
            <p>Register your department or organization on MargDarshan AI</p>
          </div>
          <form className="signup-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input type="text" id="fullName" required placeholder="Enter your full name" />
            </div>
            
            <div className="form-group">
              <label htmlFor="organization">Organization / Department</label>
              <input type="text" id="organization" required placeholder="e.g. NHAI, PWD" />
            </div>

            <div className="form-group">
              <label htmlFor="officialEmail">Official Email ID</label>
              <input type="email" id="officialEmail" required placeholder="name@gov.in or name@nic.in" />
            </div>

            <div className="form-group">
              <label htmlFor="password">Create Password</label>
              <input type="password" id="password" required placeholder="Minimum 8 characters" />
            </div>

            <div className="form-group checkbox-group">
              <input type="checkbox" id="terms" required />
              <label htmlFor="terms">I agree to the <a href="#">Terms & Conditions</a> and <a href="#">Privacy Policy</a> of the Government of India.</label>
            </div>

            <button type="submit" className="gov-btn-primary">Register</button>
          </form>
          <div className="signup-footer">
            <p>Already have an account? <span onClick={() => navigate('/login')} className="link">Login here</span></p>
          </div>
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
