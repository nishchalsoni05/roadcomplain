import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, Camera, MapPin, Cpu, Sun, Moon, Info, Wifi, WifiOff, HardDrive } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { getModelInfo, healthCheck } from '../services/api'
import { getPendingCount, syncPendingEvents } from '../services/offlineDB'

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const [modelInfo, setModelInfo] = useState(null)
  const [backendStatus, setBackendStatus] = useState(null)
  const [offlineCount, setOfflineCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [cameraSource, setCameraSource] = useState(
    localStorage.getItem('roadrepair-camera-source') || 'webcam'
  )
  const [ipCameraUrl, setIpCameraUrl] = useState(
    localStorage.getItem('roadrepair-ip-camera-url') || ''
  )

  useEffect(() => {
    fetchStatus()
    fetchOfflineCount()
  }, [])

  const fetchStatus = async () => {
    try {
      const [healthRes, modelRes] = await Promise.allSettled([
        healthCheck(),
        getModelInfo()
      ])
      if (healthRes.status === 'fulfilled') setBackendStatus(healthRes.value.data)
      if (modelRes.status === 'fulfilled') setModelInfo(modelRes.value.data)
    } catch (e) {
      console.error('Status fetch error:', e)
    }
  }

  const fetchOfflineCount = async () => {
    try {
      const count = await getPendingCount()
      setOfflineCount(count)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncPendingEvents()
      setOfflineCount(0)
    } catch (e) {
      alert('Sync failed. Check backend connection.')
    } finally {
      setSyncing(false)
    }
  }

  const handleCameraSourceChange = (value) => {
    setCameraSource(value)
    localStorage.setItem('roadrepair-camera-source', value)
  }

  const handleIpUrlChange = (value) => {
    setIpCameraUrl(value)
    localStorage.setItem('roadrepair-ip-camera-url', value)
  }

  const ModelCard = ({ name, info }) => (
    <div style={{
      padding: '14px 16px', borderRadius: 'var(--radius-md)',
      background: 'var(--bg-secondary)',
      border: `1px solid ${info?.loaded ? 'rgba(22,163,106,0.2)' : 'var(--border-light)'}`,
      display: 'flex', alignItems: 'center', gap: 12
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: info?.loaded ? '#16A34A' : '#94A3B8'
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {info?.description || 'No description'}
        </div>
        {info?.path && (
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
            {info.path || 'Not configured'}
          </div>
        )}
      </div>
      <span className={`badge ${info?.loaded ? 'badge-low' : 'badge-medium'}`}>
        {info?.loaded ? 'Loaded' : 'Not Loaded'}
      </span>
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure camera sources, view model info, and manage preferences</p>
      </div>

      <div className="grid-2">
        {/* Camera Source */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>
            <Camera size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Camera Source
          </h3>

          <div className="form-group">
            <label className="form-label">Default Source</label>
            <select
              className="form-select"
              value={cameraSource}
              onChange={(e) => handleCameraSourceChange(e.target.value)}
            >
              <option value="webcam">Laptop Webcam (WebRTC)</option>
              <option value="phone_camera">Phone Camera (WebRTC)</option>
              <option value="ip_camera">IP Camera Stream (RTSP/HTTP)</option>
            </select>
          </div>

          {cameraSource === 'ip_camera' && (
            <div className="form-group">
              <label className="form-label">IP Camera Stream URL</label>
              <input
                className="form-input"
                type="text"
                placeholder="rtsp://192.168.1.100:8080/video or http://..."
                value={ipCameraUrl}
                onChange={(e) => handleIpUrlChange(e.target.value)}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Use an IP camera app on your phone (e.g., IP Webcam for Android) to expose a stream over local WiFi.
              </div>
            </div>
          )}

          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: 'rgba(252,163,17,0.08)', fontSize: '0.75rem', color: 'var(--text-secondary)'
          }}>
            <Info size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
            All camera sources feed the same AI pipeline. Video processing is identical regardless of source.
          </div>
        </motion.div>

        {/* Location Source */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>
            <MapPin size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Location Source
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              padding: '12px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', fontSize: '0.82rem'
            }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Browser Geolocation API</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Uses native device GPS on phones (high accuracy, ~5m) or WiFi/IP positioning on laptops (lower accuracy, ~50-500m).
              </div>
            </div>

            <div style={{
              padding: '12px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', fontSize: '0.82rem'
            }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Reverse Geocoding</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Every coordinate is converted to a human-readable address using OpenStreetMap Nominatim (free, no API key).
              </div>
            </div>

            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'rgba(252,163,17,0.08)', fontSize: '0.75rem', color: 'var(--text-secondary)'
            }}>
              <Info size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              Accuracy radius is always displayed alongside coordinates when using non-GPS sources.
            </div>
          </div>
        </motion.div>

        {/* Theme */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>
            {theme === 'light' ? <Sun size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} /> : <Moon size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />}
            Appearance
          </h3>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => theme !== 'light' && toggleTheme()}
              style={{
                flex: 1, padding: '16px', borderRadius: 'var(--radius-md)',
                border: `2px solid ${theme === 'light' ? 'var(--color-amber)' : 'var(--border-color)'}`,
                background: theme === 'light' ? 'rgba(252,163,17,0.08)' : 'var(--bg-secondary)',
                cursor: 'pointer', textAlign: 'center', transition: 'all 200ms',
              }}
            >
              <Sun size={24} style={{ margin: '0 auto 6px', color: theme === 'light' ? '#FCA311' : 'var(--text-muted)' }} />
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Light</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Default</div>
            </button>
            <button
              onClick={() => theme !== 'dark' && toggleTheme()}
              style={{
                flex: 1, padding: '16px', borderRadius: 'var(--radius-md)',
                border: `2px solid ${theme === 'dark' ? 'var(--color-amber)' : 'var(--border-color)'}`,
                background: theme === 'dark' ? 'rgba(252,163,17,0.08)' : 'var(--bg-secondary)',
                cursor: 'pointer', textAlign: 'center', transition: 'all 200ms',
              }}
            >
              <Moon size={24} style={{ margin: '0 auto 6px', color: theme === 'dark' ? '#FCA311' : 'var(--text-muted)' }} />
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Dark</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Alternative</div>
            </button>
          </div>
        </motion.div>

        {/* Offline Queue */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3 className="card-title" style={{ marginBottom: 16 }}>
            <HardDrive size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Offline Queue
          </h3>

          <div style={{
            padding: '14px 16px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pending Events</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {offlineCount === 0
                  ? 'No events queued — all synced'
                  : `${offlineCount} events waiting to sync`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: '1.5rem', fontWeight: 800,
                color: offlineCount > 0 ? '#D97706' : '#16A34A'
              }}>
                {offlineCount}
              </span>
              {offlineCount > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
              )}
            </div>
          </div>

          <div style={{
            marginTop: 10, fontSize: '0.72rem', color: 'var(--text-muted)',
            padding: '8px 12px', borderRadius: 'var(--radius-md)',
            background: 'rgba(252,163,17,0.06)'
          }}>
            Events are automatically cached in IndexedDB when offline and synced to the backend when connectivity resumes.
          </div>
        </motion.div>
      </div>

      {/* Model Info */}
      <motion.div
        className="card"
        style={{ marginTop: 20 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="card-title">
            <Cpu size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            AI Models
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {backendStatus ? (
              <span className="badge badge-low">
                <Wifi size={10} style={{ marginRight: 4 }} /> Backend Connected
              </span>
            ) : (
              <span className="badge badge-medium">
                <WifiOff size={10} style={{ marginRight: 4 }} /> Backend Offline
              </span>
            )}
          </div>
        </div>

        {modelInfo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ModelCard name="General Detection (COCO)" info={modelInfo.general_model} />
            <ModelCard name="Pothole Detection" info={modelInfo.pothole_model} />
            <ModelCard name="Road Damage Detection" info={modelInfo.road_damage_model} />
            <ModelCard name="License Plate Detection" info={modelInfo.plate_model} />
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: modelInfo.anpr_available ? '#16A34A' : '#94A3B8'
              }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>ANPR (OCR Engine)</span>
              <span className={`badge ${modelInfo.anpr_available ? 'badge-low' : 'badge-medium'}`} style={{ marginLeft: 'auto' }}>
                {modelInfo.anpr_available ? 'Available' : 'Not Available'}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {backendStatus ? 'Loading model info...' : 'Connect the backend to view model status.'}
          </div>
        )}

        {backendStatus && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-secondary)', fontSize: '0.75rem', color: 'var(--text-muted)'
          }}>
            Backend: <strong>{backendStatus.app}</strong> v{backendStatus.version} • Status: {backendStatus.status}
          </div>
        )}
      </motion.div>
    </div>
  )
}
