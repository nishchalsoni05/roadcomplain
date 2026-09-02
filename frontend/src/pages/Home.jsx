import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, Camera, Map, FileSearch, History,
  BarChart3, Shield, Activity, Car, UserCheck, Construction
} from 'lucide-react'
import { getSummaryStats } from '../services/api'

export default function Home() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await getSummaryStats()
        setStats(res.data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [])

  const statCards = [
    { label: 'Events Today', value: stats?.total_events_today ?? '—', icon: Activity, color: '#FCA311', bg: 'rgba(252,163,17,0.12)' },
    { label: 'Road Health Score', value: stats?.current_road_health_score ?? '—', icon: Shield, color: '#16A34A', bg: 'rgba(22,163,106,0.12)' },
    { label: 'Active Issues', value: stats?.active_issues ?? '—', icon: AlertTriangle, color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
    { label: 'Vehicles Tracked', value: stats?.vehicles_tracked ?? '—', icon: Car, color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  ]

  const quickLinks = [
    { path: '/detect', label: 'Live Detection', desc: 'Start real-time inference from camera', Icon: Camera, color: '#FCA311' },
    { path: '/map', label: 'GIS Map', desc: 'View spatial distribution of events', Icon: Map, color: '#2563EB' },
    { path: '/incidents', label: 'Analyze Upload', desc: 'Process videos or images', Icon: FileSearch, color: '#16A34A' },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dashboard Overview</h1>
        <p>Real-time telemetry and infrastructure analytics</p>
      </div>

      <div className="grid-4" style={{ marginBottom: 32 }}>
        {statCards.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: stat.bg, color: stat.color }}>
              <stat.icon size={22} />
            </div>
            <div>
              <div className="stat-value">{loading ? '...' : stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Quick Actions</h2>
      <div className="grid-3">
        {quickLinks.map((link, i) => (
          <Link key={i} to={link.path} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', minHeight: 120 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: `${link.color}18`, color: link.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <link.Icon size={18} />
                </div>
                <span style={{ fontWeight: 600 }}>{link.label}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{link.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
