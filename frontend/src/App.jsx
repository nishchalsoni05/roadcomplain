import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Layout/Sidebar'
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

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/detect" element={<LiveDetection />} />
          <Route path="/upload" element={<VideoUpload />} />
          <Route path="/map" element={<GISCommand />} />
          <Route path="/incidents" element={<IncidentAnalysis />} />
          <Route path="/history" element={<TestHistory />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/traffic-analytics" element={<TrafficAnalytics />} />
          <Route path="/trained-data" element={<TrainedData />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
