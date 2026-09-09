import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, StopCircle, Play } from 'lucide-react'
import { useDetection } from '../context/DetectionContext'
import { WSClient } from '../services/wsClient'
import { EVENT_TYPE_COLORS } from '../utils/constants'

export default function LiveDetection() {
  const {
    isDetecting, setIsDetecting,
    events, setSessionId,
    updateDetections, latestDetections
  } = useDetection()

  const [wsConnected, setWsConnected] = useState(false)
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [videoDimensions, setVideoDimensions] = useState({ w: 0, h: 0 })
  const [useIpCamera, setUseIpCamera] = useState(false)
  const [ipCameraUrl, setIpCameraUrl] = useState('http://100.x.x.x:8080/video')
  const [ipFrameBase64, setIpFrameBase64] = useState(null)

  const videoRef = useRef(null)
  const imgRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const wsRef = useRef(null)
  const watchIdRef = useRef(null)

  // Load available cameras on mount
  useEffect(() => {
    let mounted = true;
    async function loadDevices() {
      try {
        // Request broad permission first to unlock device labels/ids
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
        
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        
        // Immediately stop the temporary stream
        tempStream.getTracks().forEach(t => t.stop())

        const videoDevices = allDevices.filter(d => d.kind === 'videoinput')
        
        if (mounted) {
          setDevices(videoDevices)
          if (videoDevices.length > 0) {
            // Find the previously selected device or default to first
            setSelectedDeviceId(videoDevices[0].deviceId)
          }
        }
      } catch (err) {
        console.error("Camera permission denied or error enumerating devices", err)
      }
    }
    loadDevices()
    
    // Listen for new devices being plugged in / virtual cameras turning on
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      mounted = false;
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    }
  }, []) 

  const startCamera = useCallback(async () => {
    try {
      if (!selectedDeviceId) {
        alert("No camera selected or found!");
        return false;
      }

      console.log("Attempting to start camera with ID:", selectedDeviceId);
      
      // ONLY request the specific selected device. NO silent fallback to default camera!
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { deviceId: { exact: selectedDeviceId } } 
        });
      } catch (e) {
        console.warn("Exact deviceId failed:", e);
        try {
          // Soft fallback just in case exact is too strict, but still targeting the specific device
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { deviceId: selectedDeviceId } 
          });
        } catch (e2) {
          alert(`Failed to start camera. Error: ${e.name}. \nMake sure OBS Virtual Camera/DroidCam is turned ON and not being used by another app.`);
          return false;
        }
      }
      
      const track = stream.getVideoTracks()[0];
      console.log("Successfully started camera:", track.label);
      
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      return true;
    } catch (e) {
      console.error(e)
      alert(`Could not start camera: ${e.message}`);
      return false;
    }
  }, [selectedDeviceId])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const stopLocationWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const toggleDetection = async () => {
    if (isDetecting) {
      setIsDetecting(false)
      clearInterval(intervalRef.current)
      stopLocationWatch()
      if (wsRef.current) {
        wsRef.current.send({ type: 'stop' })
        wsRef.current.close()
      }
      stopCamera()
      setIpFrameBase64(null)
    } else {
      if (!useIpCamera) {
        const success = await startCamera()
        if (!success) return;
      }
      
      setIsDetecting(true)
      
      wsRef.current = new WSClient(`/ws/detect`, {
        onOpen: () => {
          setWsConnected(true)
          if (useIpCamera) {
            wsRef.current.send({
              type: 'start',
              source_type: 'ip_camera',
              url: ipCameraUrl
            })
          } else {
            wsRef.current.send({
              type: 'start',
              source_type: 'webcam'
            })
          }

          if ('geolocation' in navigator) {
            watchIdRef.current = navigator.geolocation.watchPosition(
              (pos) => {
                if (wsRef.current?.isConnected) {
                  wsRef.current.send({
                    type: 'location',
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    speed: pos.coords.speed,
                    heading: pos.coords.heading,
                    timestamp: pos.timestamp
                  })
                }
              },
              (err) => console.warn('Geolocation error:', err),
              { enableHighAccuracy: true, maximumAge: 0 }
            )
          }
        },
        onClose: () => {
          setWsConnected(false)
          stopLocationWatch()
        },
        onMessage: (msg) => {
          if (msg.type === 'session_started') {
            setSessionId(msg.session_id)
          } else if (msg.type === 'detection_result' || msg.type === 'new_event') {
            updateDetections(msg)
            if (msg.frame_image) {
              setIpFrameBase64(`data:image/jpeg;base64,${msg.frame_image}`)
              // For IP camera, we use a fixed aspect ratio assumption or update dimensions dynamically
              if (videoDimensions.w === 0) setVideoDimensions({ w: 1280, h: 720 }) 
            }
          }
        }
      })
      wsRef.current.connect()

      if (!useIpCamera) {
        intervalRef.current = setInterval(() => {
          if (videoRef.current && canvasRef.current && wsRef.current?.isConnected) {
            const ctx = canvasRef.current.getContext('2d')
            canvasRef.current.width = videoRef.current.videoWidth
            canvasRef.current.height = videoRef.current.videoHeight
            ctx.drawImage(videoRef.current, 0, 0)
            const b64 = canvasRef.current.toDataURL('image/jpeg', 0.5)
            wsRef.current.send({
              type: 'frame',
              data: b64,
              timestamp: new Date().toISOString()
            })
          }
        }, 1000 / 5) // 5 FPS
      }
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Live Detection</h1>
      </div>
      
      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="card-title">Camera Feed</h3>
            
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <select 
                className="input" 
                style={{ padding: '8px', maxWidth: '160px' }}
                value={useIpCamera ? 'ip_camera' : 'webcam'}
                onChange={(e) => setUseIpCamera(e.target.value === 'ip_camera')}
                disabled={isDetecting}
              >
                <option value="webcam">Local Webcam</option>
                <option value="ip_camera">External IP Camera</option>
              </select>

              {!useIpCamera ? (
                <select 
                  className="input" 
                  style={{ padding: '8px', maxWidth: '200px' }}
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  disabled={isDetecting}
                >
                  {devices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0,5)}`}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  className="input" 
                  style={{ padding: '8px', width: '250px' }}
                  placeholder="http://100.x.x.x:8080/video"
                  value={ipCameraUrl}
                  onChange={(e) => setIpCameraUrl(e.target.value)}
                  disabled={isDetecting}
                />
              )}
              
              <button className={`btn ${isDetecting ? 'btn-outline' : 'btn-primary'}`} onClick={toggleDetection}>
                {isDetecting ? <StopCircle size={16} /> : <Play size={16} />}
                {isDetecting ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>
          
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
            {!useIpCamera ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    setVideoDimensions({
                      w: videoRef.current.videoWidth,
                      h: videoRef.current.videoHeight
                    })
                  }
                }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                {ipFrameBase64 ? (
                  <img 
                    ref={imgRef}
                    src={ipFrameBase64} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    alt="IP Camera Stream"
                  />
                ) : (
                  <div style={{ color: '#666' }}>
                    {isDetecting ? "Connecting to IP Camera stream..." : "IP Camera stream will appear here"}
                  </div>
                )}
              </div>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {/* Bounding Box Overlay */}
            {videoDimensions.w > 0 && (
              <svg 
                viewBox={`0 0 ${videoDimensions.w} ${videoDimensions.h}`}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                preserveAspectRatio="xMidYMid slice"
              >
                {latestDetections.map((det, i) => {
                  const color = EVENT_TYPE_COLORS[det.class_name] || '#00ff00'
                  const [x1, y1, x2, y2] = det.bbox
                  const width = x2 - x1
                  const height = y2 - y1
                  return (
                    <g key={i}>
                      <rect x={x1} y={y1} width={width} height={height} fill="rgba(0,255,0,0.1)" stroke={color} strokeWidth="3" />
                      <text x={x1} y={y1 > 20 ? y1 - 5 : y1 + 20} fill={color} fontSize="20" fontWeight="bold">
                        {det.class_name} {Math.round(det.confidence * 100)}%
                      </text>
                    </g>
                  )
                })}
              </svg>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>Recent Events</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map((evt, i) => (
              <div key={i} style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, borderLeft: `4px solid ${EVENT_TYPE_COLORS[evt.event_type] || '#ccc'}` }}>
                <div style={{ fontWeight: 600 }}>{evt.event_type}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confidence: {(evt.confidence * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
