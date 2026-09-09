import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Activity, AlertOctagon, CheckCircle, Clock, RefreshCw, Shield, Zap, TrendingUp, Cpu } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { getSummaryStats, getTrends } from '../../../services/api'
import { useAdminActions, STATUS_LABELS, STATUS_COLORS } from '../../../context/AdminActionsContext'

const COLORS = ['#3B82F6','#F59E0B','#EF4444','#22C55E','#8B5CF6','#06B6D4','#EC4899']

const ET = { pothole:'Pothole', road_damage:'Road Damage', waterlogging:'Waterlogging', rash_driving:'Rash Driving', close_call:'Close Call', missing_signage:'Missing Signage', damaged_signboard:'Damaged Signboard', damaged_divider:'Damaged Divider', missing_zebra:'Missing Zebra', license_plate:'License Plate', traffic_bottleneck:'Traffic Bottleneck', pedestrian_risk:'Pedestrian Risk' }

export default function Overview({ events }) {
  const [stats, setStats]   = useState(null)
  const [trends, setTrends] = useState({ trends: [], distribution: [] })
  const [loading, setLoading] = useState(true)
  const { getStats } = useAdminActions()

  const fetch = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([getSummaryStats(), getTrends(30)])
      setStats(s.data); setTrends(t.data)
    } catch(e){ console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch(); const t = setInterval(fetch, 30000); return () => clearInterval(t) }, [fetch])

  const aStats = getStats()
  const critical = events.filter(e => e.severity === 'critical').length
  const unactioned = events.length - aStats.total

  const kpis = [
    { label:'Total Incidents',   val: stats?.total_incidents ?? 0,    Icon: Activity,    c:'#3B82F6', bg:'rgba(59,130,246,.14)',  sub:'+12% this week' },
    { label:'Critical Alerts',   val: critical,                        Icon: AlertOctagon, c:'#EF4444', bg:'rgba(239,68,68,.14)',   sub:'Need attention' },
    { label:'Unreviewed',        val: unactioned < 0 ? 0 : unactioned, Icon: Clock,        c:'#F59E0B', bg:'rgba(245,158,11,.14)',  sub:'Pending review' },
    { label:'In Progress',       val: aStats.in_progress,              Icon: RefreshCw,    c:'#8B5CF6', bg:'rgba(139,92,246,.14)',  sub:'Being processed' },
    { label:'Resolved',          val: aStats.resolved,                 Icon: CheckCircle,  c:'#22C55E', bg:'rgba(34,197,94,.14)',   sub:'Closed successfully' },
    { label:'Road Health Score', val: `${stats?.current_road_health_score ?? 0}%`, Icon: Shield, c:'#06B6D4', bg:'rgba(6,182,212,.14)', sub:'Overall score' },
  ]

  const tooltip = { contentStyle:{ background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:8, color:'var(--text-primary)', fontSize:'0.8rem' } }

  return (
    <>
      {/* KPI row */}
      <div className="adm-kpi-grid">
        {kpis.map((k,i) => (
          <motion.div key={i} className="adm-kpi" style={{'--kpi-c':k.c,'--kpi-bg':k.bg}} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*.06}}>
            <div className="adm-kpi-icon"><k.Icon size={20}/></div>
            <div>
              <div className="adm-kpi-val">{loading && !stats ? '…' : k.val}</div>
              <div className="adm-kpi-lbl">{k.label}</div>
              <div className="adm-kpi-sub">{k.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="adm-g2">
        <div className="adm-card">
          <div className="adm-card-title"><TrendingUp size={17} color="var(--a-accent)"/>Incident Trend — Last 30 Days</div>
          <div style={{height:240}} className="adm-chart">
            {trends.trends?.length > 0 ? (
              <ResponsiveContainer>
                <AreaChart data={trends.trends}>
                  <defs>
                    <linearGradient id="ovGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.45}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155"/>
                  <XAxis dataKey="date" stroke="#475569" fontSize={10} tickFormatter={v=>new Date(v).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}/>
                  <YAxis stroke="#475569" fontSize={10}/>
                  <Tooltip {...tooltip}/>
                  <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} fill="url(#ovGrad)"/>
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="adm-empty">No trend data yet</div>}
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-title"><Cpu size={17} color="var(--a-purple)"/>Event Distribution</div>
          <div style={{height:240}} className="adm-chart">
            {trends.distribution?.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={trends.distribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="count" nameKey="event_type">
                    {trends.distribution.map((_,idx) => <Cell key={idx} fill={COLORS[idx%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip {...tooltip} formatter={(v,n)=>[v, ET[n]||n]}/>
                  <Legend wrapperStyle={{fontSize:'0.7rem',color:'#94A3B8'}} formatter={v=>ET[v]||v}/>
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="adm-empty">No data yet</div>}
          </div>
        </div>
      </div>

      {/* Recent incidents */}
      <div className="adm-card">
        <div className="adm-card-title"><Zap size={17} color="var(--a-amber)"/>Latest Detections</div>
        <div className="adm-alert-list">
          {events.slice(0,8).map(evt => (
            <div className="adm-alert-item" key={evt.id}>
              <div className="adm-alert-icon" style={{background:'rgba(59,130,246,.12)',color:'var(--a-accent)'}}><Activity size={14}/></div>
              <div style={{flex:1}}>
                <div className="adm-alert-title">{ET[evt.event_type]||evt.event_type} <span className={`adm-badge-pill bp-${evt.severity}`} style={{marginLeft:6}}>{evt.severity}</span></div>
                <div className="adm-alert-meta">{evt.address||'Location unknown'} · {new Date(evt.detected_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            </div>
          ))}
          {events.length===0 && <div className="adm-empty">No incidents yet — connect a live session to start detecting</div>}
        </div>
      </div>
    </>
  )
}
