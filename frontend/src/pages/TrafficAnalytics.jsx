import { useState, useEffect } from 'react'
import { getOriginDestination, getRouteDelays } from '../services/api'
import { Activity, Clock, MapPin, Truck } from 'lucide-react'

export default function TrafficAnalytics() {
  const [odData, setOdData] = useState([])
  const [delayData, setDelayData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [odRes, delayRes] = await Promise.all([
          getOriginDestination(),
          getRouteDelays()
        ])
        setOdData(odRes.data)
        setDelayData(delayRes.data)
      } catch (err) {
        console.error('Failed to fetch traffic analytics', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return (
    <div className="page-container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <div style={{ textAlign: 'center' }}>
        <Activity size={48} color="var(--color-amber)" style={{ animation: 'pulse 2s infinite' }} />
        <h2 style={{ marginTop: 16 }}>Loading Analytics...</h2>
      </div>
    </div>
  )

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header stagger-1">
        <h1>Advanced Traffic Analytics</h1>
        <p>Real-time insights into Origin-Destination patterns and route delays.</p>
      </div>

      <div className="grid-4 stagger-2" style={{ marginBottom: 32 }}>
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Active Routes</h3>
            <div style={{ padding: 8, background: 'rgba(0, 240, 255, 0.1)', borderRadius: '50%' }}>
              <MapPin size={24} color="#00F0FF" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{delayData.length}</div>
        </div>
        
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Tracked Vehicles</h3>
            <div style={{ padding: 8, background: 'rgba(252, 163, 17, 0.1)', borderRadius: '50%' }}>
              <Truck size={24} color="var(--color-amber)" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{odData.length}</div>
        </div>
        
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Max Delay</h3>
            <div style={{ padding: 8, background: 'rgba(255, 51, 102, 0.1)', borderRadius: '50%' }}>
              <Clock size={24} color="#ff3366" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {delayData.length > 0 ? Math.max(...delayData.map(d => d.estimated_delay_minutes)).toFixed(1) : 0} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>min</span>
          </div>
        </div>
        
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Avg Travel Time</h3>
            <div style={{ padding: 8, background: 'rgba(0, 204, 102, 0.1)', borderRadius: '50%' }}>
              <Activity size={24} color="#00cc66" />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {odData.length > 0 ? (odData.reduce((acc, curr) => acc + curr.travel_time_minutes, 0) / odData.length).toFixed(1) : 0} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>min</span>
          </div>
        </div>
      </div>

      <div className="grid-2 stagger-3">
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: 4 }}>Origin-Destination Matrix</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
            Vehicles tracked across multiple locations.
          </p>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plate Number</th>
                  <th>Travel Time</th>
                  <th>Origin</th>
                  <th>Destination</th>
                </tr>
              </thead>
              <tbody>
                {odData.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '32px 0' }}>No OD data available</td></tr>
                ) : (
                  odData.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--color-amber)' }}>{row.plate_number}</td>
                      <td style={{ fontWeight: 600 }}>{row.travel_time_minutes.toFixed(1)} m</td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.origin_lat.toFixed(4)}, {row.origin_lng.toFixed(4)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.dest_lat.toFixed(4)}, {row.dest_lng.toFixed(4)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: 4 }}>Route Delays & Bottlenecks</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
            Estimated delays based on traffic bottleneck events.
          </p>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Route Region</th>
                  <th>Avg Speed</th>
                  <th>Est. Delay</th>
                </tr>
              </thead>
              <tbody>
                {delayData.length === 0 ? (
                  <tr><td colSpan="3" style={{ textAlign: 'center', padding: '32px 0' }}>No delay data available</td></tr>
                ) : (
                  delayData.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--color-amber)' }}>{row.route_id}</td>
                      <td>{row.avg_speed_px.toFixed(1)} px/s</td>
                      <td style={{ 
                        color: row.estimated_delay_minutes > 5 ? '#ff3366' : '#00cc66', 
                        fontWeight: 'bold',
                        background: row.estimated_delay_minutes > 5 ? 'rgba(255, 51, 102, 0.1)' : 'rgba(0, 204, 102, 0.1)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        display: 'inline-block',
                        marginTop: 10
                      }}>
                        {row.estimated_delay_minutes.toFixed(1)} min
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
