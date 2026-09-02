import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Filter, RefreshCw } from 'lucide-react'
import L from 'leaflet'
import { getEvents } from '../services/api'
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '../utils/constants'
import { formatConfidence, formatTimestamp, formatAccuracy } from '../utils/formatters'

const createMarkerIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 28px; height: 28px; border-radius: 50%;
      background: ${color}; border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

function MapUpdater({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, 13)
  }, [center, map])
  return null
}

export default function GISCommand() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629])

  useEffect(() => {
    fetchEvents()
  }, [filter])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const params = { page_size: 200 }
      if (filter) params.event_type = filter
      const res = await getEvents(params)
      const evts = res.data.events || []
      setEvents(evts)
      const withCoords = evts.find(e => e.latitude && e.longitude)
      if (withCoords) setMapCenter([withCoords.latitude, withCoords.longitude])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const eventsWithCoords = events.filter(e => e.latitude && e.longitude)

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>GIS Command Map</h1>
        <p>Interactive geospatial visualization of urban infrastructure</p>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Filter size={16} />
        <select
          className="form-select"
          style={{ maxWidth: 220 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All Event Types</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <button className="btn btn-outline" onClick={fetchEvents} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={14} /> REFRESH
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', height: 'calc(100vh - 240px)', minHeight: 500 }}>
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={mapCenter} />
          {eventsWithCoords.map(event => {
            const color = EVENT_TYPE_COLORS[event.event_type] || '#00F0FF'
            return (
              <Marker key={event.id} position={[event.latitude, event.longitude]} icon={createMarkerIcon(color)}>
                <Popup>
                  <div>
                    <div style={{ fontWeight: 700, color }}>{EVENT_TYPE_LABELS[event.event_type] || event.event_type}</div>
                    <div>Confidence: {formatConfidence(event.confidence)}</div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
