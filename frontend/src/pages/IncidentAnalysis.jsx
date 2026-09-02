import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileVideo, Play, Loader2, CheckCircle, AlertTriangle, Download } from 'lucide-react'
import { uploadVideo, downloadSessionReport } from '../services/api'
import { WSClient } from '../services/wsClient'
import { formatConfidence, formatEventType, downloadBlob } from '../utils/formatters'
import { EVENT_TYPE_COLORS } from '../utils/constants'

export default function IncidentAnalysis() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [processProgress, setProcessProgress] = useState(0)
  const [sessionId, setSessionId] = useState(null)
  const [results, setResults] = useState([])
  const [complete, setComplete] = useState(false)
  const [totalEvents, setTotalEvents] = useState(0)
  const fileInputRef = useRef(null)
  const wsRef = useRef(null)

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0]
    if (f && (f.type.startsWith('video/') || f.type.startsWith('image/'))) {
      setFile(f)
      setResults([])
      setComplete(false)
      setTotalEvents(0)
    }
  }

  const handleUploadAndProcess = async () => {
    if (!file) return

    setUploading(true)
    setUploadProgress(0)

    try {
      // Upload
      const res = await uploadVideo(file, (e) => {
        setUploadProgress(Math.round((e.loaded / e.total) * 100))
      })

      const sid = res.data.session_id
      setSessionId(sid)
      setUploading(false)
      setProcessing(true)

      // Connect to processing WebSocket
      const ws = new WSClient(`/api/upload/ws/process/${sid}`, {
        onMessage: (data) => {
          if (data.type === 'detection_result') {
            setResults(prev => [...prev, data])
          } else if (data.type === 'progress') {
            setProcessProgress(data.progress)
            setTotalEvents(data.events_found)
          } else if (data.type === 'complete') {
            setProcessing(false)
            setComplete(true)
            setTotalEvents(data.total_events)
            ws.close()
          } else if (data.type === 'error') {
            setProcessing(false)
            alert(`Processing error: ${data.message}`)
            ws.close()
          }
        },
        onError: () => {
          setProcessing(false)
        }
      })
      wsRef.current = ws
      ws.connect()
    } catch (e) {
      console.error('Upload error:', e)
      setUploading(false)
      alert('Upload failed. Is the backend running?')
    }
  }

  const handleStop = () => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    setProcessing(false)
  }

  const handleDownloadReport = async () => {
    if (!sessionId) return
    try {
      const res = await downloadSessionReport(sessionId)
      downloadBlob(new Blob([res.data]), `roadrepair_incident_report_${sessionId}.pdf`)
    } catch (e) {
      console.error('Download error:', e)
    }
  }

  // Aggregate results for display
  const detectionSummary = {}
  results.forEach(r => {
    (r.detections || []).forEach(d => {
      detectionSummary[d.class_name] = (detectionSummary[d.class_name] || 0) + 1
    })
    ;(r.intelligence_events || []).forEach(e => {
      detectionSummary[e.event_type] = (detectionSummary[e.event_type] || 0) + 1
    })
  })

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Incident Analysis</h1>
        <p>Upload video or image for AI-powered incident review — same pipeline as live detection</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Upload panel */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>
            <FileVideo size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />
            Upload Media
          </h3>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${file ? 'var(--color-amber)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: 40,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 200ms ease',
              background: file ? 'rgba(252,163,17,0.05)' : 'transparent',
            }}
          >
            <Upload size={36} color={file ? '#FCA311' : 'var(--text-muted)'} style={{ margin: '0 auto 12px' }} />
            {file ? (
              <>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {(file.size / 1048576).toFixed(1)} MB
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Click to select a video or image file
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Supports MP4, AVI, MOV, JPG, PNG
                </div>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="video/*,image/*" style={{ display: 'none' }} onChange={handleFileSelect} />

          {/* Progress */}
          {(uploading || processing) && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {uploading ? 'Uploading...' : 'Processing with AI...'}
                </span>
                <span style={{ color: 'var(--color-amber)' }}>
                  {uploading ? `${uploadProgress}%` : `${processProgress}%`}
                </span>
              </div>
              <div style={{
                height: 6, borderRadius: 3,
                background: 'var(--bg-secondary)'
              }}>
                <motion.div
                  style={{
                    height: '100%', borderRadius: 3,
                    background: 'var(--color-amber)'
                  }}
                  animate={{ width: `${uploading ? uploadProgress : processProgress}%` }}
                />
              </div>
            </div>
          )}

          {processing ? (
            <button
              className="btn btn-outline"
              style={{ width: '100%', marginTop: 16, justifyContent: 'center', borderColor: '#DC2626', color: '#DC2626' }}
              onClick={handleStop}
            >
              <Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} /> Stop Processing
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
              onClick={handleUploadAndProcess}
              disabled={!file || uploading}
            >
              {uploading ? (
                <><Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} /> Uploading...</>
              ) : (
                <><Play size={16} style={{ marginRight: 8 }} /> Analyze Media</>
              )}
            </button>
          )}
        </div>

        {/* Results panel */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="card-title">Analysis Results</h3>
            {complete && sessionId && (
              <button className="btn btn-outline btn-sm" onClick={handleDownloadReport}>
                <Download size={14} /> Export PDF
              </button>
            )}
          </div>

          {complete ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div style={{
                background: 'rgba(22,163,106,0.1)',
                borderRadius: 'var(--radius-md)',
                padding: 16, marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 12
              }}>
                <CheckCircle size={20} color="#16A34A" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Analysis Complete</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {totalEvents} events detected from {results.length} processed frames
                  </div>
                </div>
              </div>

              {/* Detection summary */}
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 10 }}>Detection Summary</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(detectionSummary).map(([type, count]) => (
                  <div key={type} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: EVENT_TYPE_COLORS[type] || '#999'
                      }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                        {formatEventType(type)}
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--color-amber)' }}>{count}</span>
                  </div>
                ))}
              </div>

              {/* ANPR results */}
              {results.some(r => r.plate_readings?.length > 0) && (
                <>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: 16, marginBottom: 10 }}>
                    <AlertTriangle size={14} style={{ verticalAlign: '-2px', marginRight: 4, color: '#DC2626' }} />
                    License Plates Detected
                  </h4>
                  {results.filter(r => r.plate_readings?.length > 0).map((r, i) =>
                    r.plate_readings.map((plate, j) => (
                      <div key={`${i}-${j}`} style={{
                        padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(220,38,38,0.06)',
                        border: '1px solid rgba(220,38,38,0.15)',
                        marginBottom: 6, fontSize: '0.82rem',
                      }}>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                          {plate.plate_text}
                        </span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                          ({formatConfidence(plate.confidence)})
                        </span>
                      </div>
                    ))
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <div className="empty-state">
              <FileVideo size={48} />
              <h3>No Results Yet</h3>
              <p>Upload and analyze a video or image to see AI-powered incident detection results here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
