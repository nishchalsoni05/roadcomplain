import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { DetectionProvider } from './context/DetectionContext'
import { AuthProvider } from './context/AuthContext'
import { AdminActionsProvider } from './context/AdminActionsContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AdminActionsProvider>
          <ThemeProvider>
            <DetectionProvider>
              <App />
            </DetectionProvider>
          </ThemeProvider>
        </AdminActionsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
