import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertTriangle, Camera, Map, FileSearch,
  Shield, Activity, Zap, Construction, UserCheck, AlertOctagon, PieChart as PieChartIcon
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { getSummaryStats, getTrends } from '../services/api'

const COLORS = ['#FCA311', '#16A34A', '#DC2626', '#2563EB', '#8B5CF6', '#EC4899', '#14B8A6']

const MotionCard = motion.div

export default function Home() {
  const [stats, setStats] = useState(null)
  const [trends, setTrends] = useState({ trends: [], distribution: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsRes, trendsRes] = await Promise.all([
          getSummaryStats(),
          getTrends(7)
        ])
        setStats(statsRes.data)
        setTrends(trendsRes.data)
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
    { label: 'Total Incidents', value: stats?.total_incidents ?? '—', icon: Activity, color: '#FCA311', bg: 'rgba(252,163,17,0.12)' },
    { label: 'Road Health Score', value: stats?.current_road_health_score ?? '—', icon: Shield, color: '#16A34A', bg: 'rgba(22,163,106,0.12)' },
    { label: 'Total Potholes', value: stats?.total_potholes ?? '—', icon: AlertOctagon, color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
    { label: 'Road Damage', value: stats?.total_road_damage ?? '—', icon: Construction, color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
    { label: 'Pedestrian Risks', value: stats?.total_pedestrian_risks ?? '—', icon: UserCheck, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
    { label: 'Active Sessions', value: stats?.active_sessions ?? '—', icon: Zap, color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
  ]

  const quickLinks = [
    { path: '/detect', label: 'Live Detection', desc: 'Start real-time inference from camera', Icon: Camera, color: '#FCA311' },
    { path: '/map', label: 'GIS Map', desc: 'View spatial distribution of events', Icon: Map, color: '#2563EB' },
    { path: '/incidents', label: 'Analyze Upload', desc: 'Process videos or images', Icon: FileSearch, color: '#16A34A' },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Dashboard Overview</h1>
          <p>Real-time telemetry and infrastructure analytics</p>
        </div>
        {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Updating live feed...</div>}
      </div>

      <motion.div 
        className="grid-3" 
        style={{ marginBottom: 32, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {statCards.map((stat, i) => (
          <MotionCard key={i} className="stat-card metric-card" variants={itemVariants}>
            <div className="stat-icon" style={{ background: stat.bg, color: stat.color }}>
              <stat.icon size={26} />
            </div>
            <div>
              <div className="stat-value">{loading && !stats ? '...' : stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          </MotionCard>
        ))}
      </motion.div>

      <div className="grid-2" style={{ marginBottom: 32 }}>
        <div className="card glass-card">
          <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="var(--color-amber)"/> 
            Event Trends (Last 7 Days)
          </h3>
          <div style={{ width: '100%', height: 320 }}>
            {trends.trends.length > 0 ? (
              <ResponsiveContainer>
                <AreaChart data={trends.trends}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-amber)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--color-amber)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickMargin={10} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="var(--color-amber)" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                {loading ? 'Loading trends...' : 'No trend data available'}
              </div>
            )}
          </div>
        </div>

        <div className="card glass-card">
          <h3 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PieChartIcon size={18} color="#2563EB"/>
            Event Distribution
          </h3>
          <div style={{ width: '100%', height: 320 }}>
            {trends.distribution.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={trends.distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="event_type"
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {trends.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '0.85rem' }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                {loading ? 'Loading distribution...' : 'No distribution data available'}
              </div>
            )}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>Quick Actions</h2>
      <div className="grid-3" style={{ marginBottom: 32 }}>
        {quickLinks.map((link, i) => (
          <Link key={i} to={link.path} style={{ textDecoration: 'none' }}>
            <motion.div 
              className="card glass-card" 
              style={{ cursor: 'pointer', height: '100%', minHeight: 120 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: `${link.color}18`, color: link.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <link.Icon size={20} />
                </div>
                <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{link.label}</span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{link.desc}</p>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  )
}
