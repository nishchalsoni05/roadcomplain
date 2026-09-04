import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileVideo, Upload, Play, StopCircle, CheckCircle, Database } from 'lucide-react'
import { uploadVideo } from '../services/api'
import { WSClient } from '../services/wsClient'
import { EVENT_TYPE_COLORS } from '../utils/constants'

export default function VideoUpload() {
  const [file, setFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sessionInfo, setSessionInfo] = useState(null)
  
  const wsRef = useRef(null)
  const [events, setEvents] = useState([])

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setSessionInfo(null)
      setEvents([])
      setProgress(0)
    }
  }

  const handleUploadAndProcess = async () => {
    if (!file) return
    setIsProcessing(true)
    setEvents([])

    try {
      // 1. Upload the file
      const uploadRes = await uploadVideo(file, (evt) => {
        const pct = Math.round((evt.loaded * 100) / evt.total)
        setProgress(pct)
      })
      
      const { session_id, filename } = uploadRes.data
      setSessionInfo({ id: session_id, filename })

      // 2. Connect to WS for processing updates
      wsRef.current = new WSClient(`/api/upload/ws/process/${session_id}`, {
        onMessage: (msg) => {
          if (msg.type === 'detection_result') {
            const newEvents = []
            
            // Deduplicate raw detections so the UI isn't flooded with duplicates
            const uniqueDets = {}
            if (msg.detections) {
              msg.detections.forEach(d => {
                if (!uniqueDets[d.class_name] || d.confidence > uniqueDets[d.class_name].confidence) {
                  uniqueDets[d.class_name] = d
                }
              })

              Object.values(uniqueDets).forEach(d => {
                // Only log significant defects as events, ignore standard vehicles for the log
                if (['pothole', 'road_damage', 'waterlogging', 'missing_signage', 'damaged_signboard', 'damaged_divider'].includes(d.class_name)) {
                  // Restored threshold to 0.30 to filter out AI noise
                  if (d.confidence >= 0.30) {
                    newEvents.push({
                      event_type: d.class_name,
                      confidence: d.confidence,
                      severity: d.confidence > 0.7 ? 'High' : (d.confidence > 0.4 ? 'Medium' : 'Low')
                    })
                  }
                }
              })
            }
            if (msg.intelligence_events) {
               msg.intelligence_events.forEach(e => {
                  newEvents.push({
                     event_type: e.event_type,
                     confidence: e.confidence,
                     severity: 'High'
                  })
               })
            }
            if (newEvents.length > 0) {
              setEvents(prev => [...newEvents, ...prev])
            }
          } else if (msg.type === 'progress') {
            setProgress(msg.progress)
          } else if (msg.type === 'complete') {
            setIsProcessing(false)
            wsRef.current.disconnect?.() || wsRef.current.close?.()
          }
        },
        onError: (err) => {
          console.error("WS Error:", err)
        }
      })
      
      wsRef.current.connect()
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Video upload or processing failed')
      setIsProcessing(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Incident Simulation (Upload)</h1>
        <p>Batch process historical video footage or single images through the AI pipeline</p>
      </div>

      <div className="grid-2">
        {/* Upload Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            border: '2px dashed var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: 40, textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, background: 'var(--bg-secondary)', cursor: 'pointer'
          }} onClick={() => document.getElementById('video-upload-input').click()}>
            <FileVideo size={48} color="var(--text-muted)" />
            <div>
               {file ? (
                 <strong style={{ color: 'var(--text-primary)' }}>{file.name}</strong>
               ) : (
                 <span style={{ color: 'var(--text-muted)' }}>Click to select a video or image file (MP4, JPG, PNG)</span>
               )}
            </div>
            <input
              id="video-upload-input"
              type="file"
              accept="video/*,image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', height: 50, justifyContent: 'center' }}
            disabled={!file || isProcessing}
            onClick={handleUploadAndProcess}
          >
            {isProcessing ? (
               <><StopCircle size={18} /> Processing...</>
            ) : (
               <><Upload size={18} /> Upload & Process</>
            )}
          </button>
          
          {progress > 0 && progress < 100 && (
             <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
               <div style={{ background: 'var(--color-amber)', height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
             </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} /> Processing Results
          </h3>
          
          {sessionInfo && !isProcessing && (
             <div style={{ background: 'var(--color-low)', color: '#fff', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
               <CheckCircle size={18} />
               Processing Complete. Session ID: {sessionInfo.id.slice(0, 8)}...
             </div>
          )}
          
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
            {events.length === 0 ? (
               <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                 No events detected yet.
               </div>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                 {events.map((evt, idx) => (
                   <motion.div 
                     key={idx}
                     initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                     style={{
                       padding: 12, background: 'var(--bg-secondary)', 
                       borderRadius: 'var(--radius-md)', 
                       borderLeft: `4px solid ${EVENT_TYPE_COLORS[evt.event_type] || 'var(--color-amber)'}`
                     }}
                   >
                     <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                       {evt.event_type.replace(/_/g, ' ')}
                     </div>
                     <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                       Confidence: {Math.round(evt.confidence * 100)}% | Severity: {evt.severity}
                     </div>
                   </motion.div>
                 ))}
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
