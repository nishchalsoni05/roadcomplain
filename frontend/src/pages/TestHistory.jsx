import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { History, Filter, MapPin, AlertTriangle, Navigation, Trash2, X, ExternalLink, Image as ImageIcon, Star, Info } from 'lucide-react'
import { getEvents, deleteEvent, deleteAllSessions, toggleFavorite, downloadEventReport } from '../services/api'
import { formatTimestamp } from '../utils/formatters'
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, SEVERITY_COLORS } from '../utils/constants'

function ImageModal({ src, label, onClose }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          width: '85vw', height: '85vh', backgroundColor: '#000',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative'
        }}
      >
        <div style={{ padding: '16px 24px', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Evidence: {label}</h3>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={24} />
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 20 }}>
          <img src={src} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt={label} />
        </div>
      </motion.div>
    </div>
  )
}

function EventDetailsModal({ event, onClose }) {
  const color = EVENT_TYPE_COLORS[event.event_type] || '#71717A'
  const label = EVENT_TYPE_LABELS[event.event_type] || event.event_type.replace(/_/g, ' ')
  const evidenceUrl = event.evidence_url ? `http://localhost:8000${event.evidence_url}` : null
  const score = Math.round(event.confidence * 100)
  
  const handleDownload = async () => {
    try {
      const response = await downloadEventReport(event.id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `incident_${event.id}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Error downloading report', error)
      alert('Failed to download report')
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          width: 600, maxWidth: '90vw', maxHeight: '90vh', backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
      >
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={20} color="var(--primary)" /> Incident Details
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {evidenceUrl && (
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
              <img src={evidenceUrl} style={{ width: '100%', maxHeight: 300, objectFit: 'contain' }} alt="Evidence" />
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Incident Type</div>
              <div style={{ color, fontWeight: 'bold' }}>{label}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Date & Time (Timestamp)</div>
              <div style={{ fontWeight: 500 }}>{formatTimestamp(event.detected_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>AI Score</div>
              <div style={{ fontWeight: 500 }}>{score}%</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Damage Severity</div>
              <div style={{ color: SEVERITY_COLORS[event.severity] || 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>
                {event.severity}
              </div>
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Full Address</div>
            <div style={{ fontWeight: 500 }}>{event.address || "Address unresolved"}</div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Geolocation</div>
            <div style={{ fontWeight: 500, fontFamily: 'monospace' }}>
              {event.latitude ? `${event.latitude.toFixed(6)}, ${event.longitude.toFixed(6)}` : "No GPS coordinates"}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExternalLink size={16} /> Download Report
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function TestHistory() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedEventDetails, setSelectedEventDetails] = useState(null)

  useEffect(() => {
    fetchEvents()
  }, [filter, page])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const params = { page, page_size: 20 }
      if (filter === 'favorites') {
        params.is_favorite = true
      } else if (filter) {
        params.event_type = filter
      }
      const res = await getEvents(params)
      setEvents(res.data.events || [])
      setTotal(res.data.total || 0)
    } catch (e) {
      console.error('Failed to fetch events:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = async (id) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteEvent(id)
        fetchEvents()
      } catch (e) {
        console.error('Failed to delete event:', e)
      }
    }
  }

  const handleDeleteAll = async () => {
    if (window.confirm('Are you sure you want to clear all history?')) {
      try {
        await deleteAllSessions()
        setPage(1)
        fetchEvents()
      } catch (e) {
        console.error('Failed to clear history:', e)
      }
    }
  }

  const handleToggleFavorite = async (event) => {
    const newValue = !event.is_favorite
    setEvents(events.map(e => e.id === event.id ? { ...e, is_favorite: newValue } : e))
    try {
      await toggleFavorite(event.id, newValue)
    } catch (e) {
      console.error('Failed to toggle favorite', e)
      setEvents(events.map(e => e.id === event.id ? { ...e, is_favorite: !newValue } : e))
    }
  }

  const getEvidenceUrl = (event) => {
    if (event.evidence_url) {
      return `http://localhost:8000${event.evidence_url}`
    }
    return null;
  }

  return (
    <div className="page-container" style={{ maxWidth: '100%', padding: '0 40px' }}>
      <div className="page-header">
        <h1>Test History Log</h1>
        <p>A detailed tabular view of every individual incident recorded by the AI.</p>
      </div>

      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px' }}>
        <Filter size={16} color="var(--text-muted)" />
        <select
          className="form-select"
          style={{ maxWidth: 220 }}
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Incident Types</option>
          <option value="favorites">⭐️ Favorites</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {total} incidents recorded
        </span>
        <button 
          className="btn btn-outline btn-sm" 
          onClick={handleDeleteAll} 
          style={{ color: '#DC2626', borderColor: '#DC2626', padding: '6px 12px' }}
          disabled={total === 0}
        >
           <Trash2 size={14} style={{ marginRight: 6 }} /> Delete All
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <span style={{ color: 'var(--text-muted)' }}>Loading events...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <History size={48} />
            <h3>No Incidents Logged</h3>
            <p>Run a live detection session to start logging incidents.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                <thead style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                  <tr>
                    <th style={{ padding: '16px', borderBottom: '1px solid var(--border)', width: 120 }}>Evidence</th>
                    <th style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>Incident Type</th>
                    <th style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>AI Score</th>
                    <th style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>Damage Severity</th>
                    <th style={{ padding: '16px', borderBottom: '1px solid var(--border)', minWidth: 250 }}>Geolocation & Address</th>
                    <th style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>Date & Time</th>
                    <th style={{ padding: '16px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const color = EVENT_TYPE_COLORS[event.event_type] || '#71717A'
                    const label = EVENT_TYPE_LABELS[event.event_type] || event.event_type.replace(/_/g, ' ')
                    const evidenceUrl = getEvidenceUrl(event)
                    const score = Math.round(event.confidence * 100)
                    
                    return (
                      <tr key={event.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          {evidenceUrl ? (
                            <div 
                              style={{ width: 100, height: 60, borderRadius: 6, background: '#000', overflow: 'hidden', cursor: 'pointer', border: `1px solid ${color}40` }}
                              onClick={() => setSelectedImage({ src: evidenceUrl, label })}
                            >
                              <img src={evidenceUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Evidence" />
                            </div>
                          ) : (
                            <div style={{ width: 100, height: 60, borderRadius: 6, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                              <ImageIcon size={20} />
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textTransform: 'capitalize', fontWeight: '500' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: color, padding: '4px 10px', background: `${color}15`, borderRadius: 100, fontSize: '0.85rem' }}>
                            <AlertTriangle size={14} />
                            {label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{score}%</span>
                            <div style={{ width: 60, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${score}%`, height: '100%', background: color }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>
                          <span style={{ color: SEVERITY_COLORS[event.severity] || 'var(--text-primary)', fontWeight: 600 }}>
                            {event.severity}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {event.latitude && event.longitude ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {event.address || "Address unresolved"}
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                {event.latitude.toFixed(6)}, {event.longitude.toFixed(6)}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                              No GPS coordinates
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                          {formatTimestamp(event.detected_at)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {event.latitude && event.longitude && (
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-outline btn-sm"
                                style={{ padding: '4px 8px' }}
                                title="Open in Maps"
                              >
                                <Navigation size={14} />
                              </a>
                            )}
                            <button 
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 8px', color: event.is_favorite ? '#EAB308' : 'var(--text-muted)', borderColor: 'transparent' }}
                              onClick={() => handleToggleFavorite(event)}
                              title={event.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                            >
                              <Star size={14} fill={event.is_favorite ? '#EAB308' : 'none'} />
                            </button>
                            <button 
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 8px', color: 'var(--text-muted)', borderColor: 'transparent' }}
                              onClick={() => setSelectedEventDetails(event)}
                              title="View Details"
                            >
                              <Info size={14} />
                            </button>
                            <button 
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 8px', color: '#DC2626', borderColor: 'transparent' }}
                              onClick={() => handleDeleteEvent(event.id)}
                              title="Delete Incident"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {total > 20 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page * 20 >= total}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {selectedImage && (
          <ImageModal 
            src={selectedImage.src} 
            label={selectedImage.label}
            onClose={() => setSelectedImage(null)} 
          />
        )}
        {selectedEventDetails && (
          <EventDetailsModal 
            event={selectedEventDetails} 
            onClose={() => setSelectedEventDetails(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  )
}
