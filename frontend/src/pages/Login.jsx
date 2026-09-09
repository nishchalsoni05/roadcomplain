import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Signup.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    const isAdmin = login(email, password);
    navigate(isAdmin ? '/admin' : '/dashboard');
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
            <li onClick={() => navigate('/signup')}>Sign Up / Register</li>
            <li className="active">Login (Dashboard)</li>
          </ul>
        </div>
      </nav>

      <main className="gov-main-content signup-main" id="main-content">
        <div className="signup-card">
          <div className="signup-header">
            <h2>Official Login</h2>
            <p>Access the MargDarshan AI Dashboard</p>
          </div>
          <form className="signup-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="officialEmail">Official Email ID</label>
              <input 
                type="email" 
                id="officialEmail" 
                required 
                placeholder="name@gov.in or name@nic.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input 
                type="password" 
                id="password" 
                required 
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="gov-btn-primary">Login to Dashboard</button>
          </form>
          <div className="signup-footer">
            <p>Don't have an account? <span onClick={() => navigate('/signup')} className="link">Register here</span></p>
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
