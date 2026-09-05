import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, PieChart, Shield, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart
} from 'recharts'
import { getTrends, getRoadHealth, getSummaryStats, getMetrics } from '../services/api'
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '../utils/constants'

const PIE_COLORS = ['#DC2626', '#EA580C', '#2563EB', '#7C3AED', '#059669', '#D97706', '#6366F1', '#991B1B', '#92400E', '#B45309']

export default function Analytics() {
  const [trends, setTrends] = useState(null)
  const [roadHealth, setRoadHealth] = useState(null)
  const [summary, setSummary] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)

  useEffect(() => {
    fetchAll()
  }, [period])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [trendsRes, healthRes, summaryRes, metricsRes] = await Promise.allSettled([
        getTrends(period),
        getRoadHealth(),
        getSummaryStats(),
        getMetrics()
      ])
      if (trendsRes.status === 'fulfilled') setTrends(trendsRes.value.data)
      if (healthRes.status === 'fulfilled') setRoadHealth(healthRes.value.data)
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data)
      if (metricsRes.status === 'fulfilled' && metricsRes.value.data.status === 'available') {
        setMetrics(metricsRes.value.data.metrics)
      }
    } catch (e) {
      console.error('Analytics fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const hasData = trends?.trends?.length > 0 || trends?.distribution?.length > 0

  const healthScore = roadHealth?.overall_score ?? summary?.current_road_health_score
  const healthColor = healthScore == null ? '#94A3B8'
    : healthScore > 70 ? '#16A34A'
    : healthScore > 40 ? '#D97706'
    : '#DC2626'

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Analytics & Road Health</h1>
          <p>Charts and trends built from real accumulated detection data</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="form-select" style={{ width: 140 }} value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button className="btn btn-outline btn-sm" onClick={fetchAll}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><span style={{ color: 'var(--text-muted)' }}>Loading analytics...</span></div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          {/* Road Health Score Hero */}
          <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: 32 }}>
            <Shield size={28} color={healthColor} style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
              Overall Road Health Score
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: healthColor, lineHeight: 1.1 }}>
              {healthScore != null ? healthScore.toFixed(1) : '—'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {healthScore != null
                ? 'Computed from real detection data using documented scoring formula'
                : 'No detection data yet — run a session to compute road health'}
            </div>

            {/* Formula explanation */}
            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', fontSize: '0.72rem', color: 'var(--text-muted)',
              fontFamily: 'monospace', textAlign: 'left', maxWidth: 600, margin: '16px auto 0'
            }}>
              <strong>Formula:</strong> Score = 100 − Σ(weight × count × recency_factor) / normalization<br />
              <strong>Weights:</strong> Pothole=10, Road Damage=8, Waterlogging=6, Damaged Divider=5<br />
              <strong>Recency:</strong> {'<'}7d = 1.0 | 7-30d = 0.5 | {'>'}30d = 0.2
            </div>
          </div>

          {/* Defect breakdown */}
          {roadHealth?.defect_counts && Object.values(roadHealth.defect_counts).some(v => v > 0) && (
            <div className="grid-3" style={{ marginBottom: 20 }}>
              {Object.entries(roadHealth.defect_counts)
                .filter(([type]) => EVENT_TYPE_LABELS[type]) // Only show types that exist in our labels config
                .map(([type, count]) => (
                <div key={type} className="stat-card">
                  <div className="stat-icon" style={{
                    background: `${EVENT_TYPE_COLORS[type] || '#999'}18`,
                    color: EVENT_TYPE_COLORS[type] || '#999'
                  }}>
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.5rem' }}>{count}</div>
                    <div className="stat-label">{EVENT_TYPE_LABELS[type]}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid-2" style={{ marginBottom: 20 }}>
            {/* Detection Trends */}
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>
                <TrendingUp size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                Detection Trends
              </h3>
              {trends?.trends?.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trends.trends}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FCA311" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#FCA311" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                        borderRadius: 8, fontSize: '0.8rem', boxShadow: 'var(--shadow-md)'
                      }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#FCA311" strokeWidth={2} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ padding: 40 }}>
                  <TrendingUp size={36} />
                  <h3>No Trend Data</h3>
                  <p>Run detection sessions to accumulate trend data.</p>
                </div>
              )}
            </div>

            {/* Distribution Pie */}
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>
                <PieChart size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                Detection Distribution
              </h3>
              {trends?.distribution?.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <RPieChart>
                    <Pie
                      data={trends.distribution.map(d => ({
                        ...d,
                        name: EVENT_TYPE_LABELS[d.event_type] || d.event_type,
                      }))}
                      dataKey="count"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={90}
                      paddingAngle={3}
                    >
                      {trends.distribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                        borderRadius: 8, fontSize: '0.8rem'
                      }}
                      formatter={(value, name) => [`${value} detections`, name]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '0.72rem' }}
                      formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
                    />
                  </RPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ padding: 40 }}>
                  <PieChart size={36} />
                  <h3>No Distribution Data</h3>
                  <p>Detection events will populate this chart.</p>
                </div>
              )}
            </div>
          </div>

          {/* Area scores table */}
          {roadHealth?.area_scores?.length > 0 && (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>Area Health Scores</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Area</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Score</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Potholes</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Damage</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Waterlog</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Signage</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Computed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roadHealth.area_scores.map((area) => {
                      const c = area.score > 70 ? '#16A34A' : area.score > 40 ? '#D97706' : '#DC2626'
                      return (
                        <tr key={area.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{area.area_name}</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 800, color: c }}>{area.score}</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>{area.pothole_count}</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>{area.damage_count}</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>{area.waterlog_count}</td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>{area.signage_issues}</td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {new Date(area.computed_at).toLocaleDateString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
