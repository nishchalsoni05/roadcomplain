import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { DetectionProvider } from './context/DetectionContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <DetectionProvider>
          <App />
        </DetectionProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
