import { Routes, Route, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Sidebar from './components/Layout/Sidebar'
import LandingPage from './pages/LandingPage'
import Home from './pages/Home'
import LiveDetection from './pages/LiveDetection'
import GISCommand from './pages/GISCommand'
import IncidentAnalysis from './pages/IncidentAnalysis'
import TestHistory from './pages/TestHistory'
import Analytics from './pages/Analytics'
import TrafficAnalytics from './pages/TrafficAnalytics'
import SettingsPage from './pages/Settings'
import VideoUpload from './pages/VideoUpload'
import TrainedData from './pages/TrainedData'
import Signup from './pages/Signup'
import GigwGuidelines from './pages/GigwGuidelines'
import Login from './pages/Login'
import HowItWorks from './pages/HowItWorks'
import AboutMinistry from './pages/AboutMinistry'
import AdminPortal from './pages/admin/AdminPortal'
import UserActions from './pages/UserActions'

export default function App() {
  const location = useLocation()
  const { isAdmin } = useAuth()

  // Admin portal — completely standalone, no sidebar
  if (location.pathname.startsWith('/admin')) {
    return (
      <Routes>
        <Route path="/admin" element={<AdminPortal />} />
      </Routes>
    )
  }

  const isPublicRoute = ['/', '/signup', '/gigw-guidelines', '/login', '/how-it-works', '/about-ministry'].includes(location.pathname)

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/gigw-guidelines" element={<GigwGuidelines />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about-ministry" element={<AboutMinistry />} />
      </Routes>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/dashboard" element={<Home />} />
          <Route path="/detect" element={<LiveDetection />} />
          <Route path="/upload" element={<VideoUpload />} />
          <Route path="/map" element={<GISCommand />} />
          <Route path="/incidents" element={<IncidentAnalysis />} />
          <Route path="/history" element={<TestHistory />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/traffic-analytics" element={<TrafficAnalytics />} />
          <Route path="/trained-data" element={<TrainedData />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/actions" element={<UserActions />} />
        </Routes>
      </main>
    </div>
  )
}
