import { createContext, useContext, useState, useCallback, useRef } from 'react'

const DetectionContext = createContext()

export function DetectionProvider({ children }) {
  const [isDetecting, setIsDetecting] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [latestDetections, setLatestDetections] = useState([])
  const [vehicleCount, setVehicleCount] = useState(0)
  const [pedestrianCount, setPedestrianCount] = useState(0)
  const [events, setEvents] = useState([])
  const [location, setLocation] = useState(null)
  const wsRef = useRef(null)
  
  // Track last logged time per event type to prevent flooding the UI
  const lastLoggedRef = useRef({})

  const addEvent = useCallback((event) => {
    setEvents(prev => [event, ...prev].slice(0, 200))
  }, [])

  const updateDetections = useCallback((data) => {
    setLatestDetections(data.detections || [])
    setVehicleCount(data.vehicle_count || 0)
    setPedestrianCount(data.pedestrian_count || 0)
    
    const now = Date.now()

    // Extract significant raw detections (pothole, waterlogging, etc.) and log them as events
    if (data.detections) {
      const defectTypes = ['pothole', 'road_damage', 'waterlogging', 'missing_signage', 'damaged_signboard', 'damaged_divider']
      data.detections.forEach(d => {
        if (defectTypes.includes(d.class_name) && d.confidence >= 0.50) {
          // Debounce: only log the same defect type once every 3 seconds
          const lastLogged = lastLoggedRef.current[d.class_name] || 0
          if (now - lastLogged > 3000) {
            lastLoggedRef.current[d.class_name] = now
            addEvent({
              event_type: d.class_name,
              confidence: d.confidence,
              severity: d.confidence > 0.7 ? 'High' : (d.confidence > 0.5 ? 'Medium' : 'Low')
            })
          }
        }
      })
    }

    // Add composite intelligence events (crashes, traffic jams)
    if (data.intelligence_events) {
      data.intelligence_events.forEach(e => {
        // Also debounce intelligence events to prevent flooding
        const lastLogged = lastLoggedRef.current[e.event_type] || 0
        if (now - lastLogged > 5000) {
          lastLoggedRef.current[e.event_type] = now
          addEvent(e)
        }
      })
    }
  }, [addEvent])

  const clearDetections = useCallback(() => {
    setLatestDetections([])
    setVehicleCount(0)
    setPedestrianCount(0)
    setEvents([])
  }, [])

  return (
    <DetectionContext.Provider value={{
      isDetecting, setIsDetecting,
      sessionId, setSessionId,
      latestDetections, updateDetections,
      vehicleCount, pedestrianCount,
      events, addEvent, clearDetections,
      location, setLocation,
      wsRef,
    }}>
      {children}
    </DetectionContext.Provider>
  )
}

export function useDetection() {
  const context = useContext(DetectionContext)
  if (!context) throw new Error('useDetection must be used within DetectionProvider')
  return context
}
