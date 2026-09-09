import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, LayoutDashboard, AlertTriangle, Bus, Users, Cpu, FileText, LogOut, RefreshCw, Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAdminActions } from '../../context/AdminActionsContext'
import { getEvents } from '../../services/api'

import Overview          from './sections/Overview'
import IncidentManagement from './sections/IncidentManagement'
import FleetManagement    from './sections/FleetManagement'
import UserManagement     from './sections/UserManagement'
import SystemHealth       from './sections/SystemHealth'
import Reports            from './sections/Reports'
import './AdminPortal.css'

const NAV = [
  { section:'Ministry Command', items:[
    { id:'overview',   label:'Overview',            Icon:LayoutDashboard },
    { id:'incidents',  label:'Incident Management', Icon:AlertTriangle    },
  ]},
  { section:'Operations', items:[
    { id:'fleet',      label:'Fleet Management',    Icon:Bus   },
    { id:'users',      label:'User & Access',       Icon:Users },
  ]},
  { section:'Intelligence', items:[
    { id:'health',     label:'System Health',       Icon:Cpu      },
    { id:'reports',    label:'Reports & Export',    Icon:FileText },
  ]},
]

const PAGE_META = {
  overview:  { title:'Ministry Overview',      sub:'Real-time infrastructure intelligence' },
  incidents: { title:'Incident Management',    sub:'Workflow: New → Assigned → In Progress → Resolved' },
  fleet:     { title:'Fleet Management',       sub:'Vehicle & camera registry and route coverage' },
  users:     { title:'User & Access Control',  sub:'Officials, roles, zones and audit log' },
  health:    { title:'System Health',          sub:'Model accuracy, uptime, and camera status' },
  reports:   { title:'Reports & Export',       sub:'Generate ward-wise and period-based reports' },
}

function LiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(()=>setT(new Date()),1000); return ()=>clearInterval(id) }, [])
  return <span className="adm-clock">{t.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})} · {t.toLocaleTimeString('en-IN')}</span>
}

export default function AdminPortal() {
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuth()
  const { getStats } = useAdminActions()

  const [active,  setActive]  = useState('overview')
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!isAdmin) navigate('/login') }, [isAdmin, navigate])

  const fetchEvents = useCallback(async () => {
    try {
      const res = await getEvents({ page_size: 200 })
      setEvents(res.data.events || [])
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchEvents(); const t = setInterval(fetchEvents, 30000); return ()=>clearInterval(t) }, [fetchEvents])

  const aStats   = getStats()
  const critical = events.filter(e => e.severity === 'critical').length
  const meta     = PAGE_META[active] || PAGE_META.overview

  const handleLogout = () => { logout(); navigate('/login') }

  if (!isAdmin) return null

  return (
    <div className="adm-root">
      {/* ── Sidebar ── */}
      <aside className="adm-sidebar">
        <div className="adm-brand">
          <div className="adm-brand-icon"><Shield size={20} color="#fff"/></div>
          <div className="adm-brand-text">
            <h2>MargDarshan AI</h2>
            <p>Ministry of Road Transport</p>
            <span className="adm-brand-badge">Admin Portal</span>
          </div>
        </div>

        <nav className="adm-nav">
          {NAV.map(sec => (
            <div key={sec.section}>
              <div className="adm-section-label">{sec.section}</div>
              {sec.items.map(({ id, label, Icon }) => (
                <div key={id} className={`adm-link ${active===id?'active':''}`} onClick={()=>setActive(id)}>
                  <Icon size={16}/>
                  <span>{label}</span>
                  {id==='incidents' && critical > 0 && <span className="adm-badge">{critical}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="adm-footer">
          <div className="adm-user-chip">
            <div className="adm-avatar">{(user?.name||'A')[0].toUpperCase()}</div>
            <div className="adm-user-info">
              <div className="name">{user?.name||'Admin'}</div>
              <div className="role">Super Admin</div>
            </div>
            <button className="adm-logout" onClick={handleLogout} title="Logout"><LogOut size={15}/></button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="adm-main">
        <header className="adm-topbar">
          <div className="adm-topbar-left">
            <h1>{meta.title}</h1>
            <p>{meta.sub}</p>
          </div>
          <div className="adm-topbar-right">
            <div className="adm-pill"><div className="adm-dot"/>System Online</div>
            <LiveClock/>
            <button className="adm-btn adm-btn-ghost" style={{padding:'6px 10px'}} onClick={fetchEvents}><RefreshCw size={13}/></button>
          </div>
        </header>

        <main className="adm-page">
          {active === 'overview'  && <Overview   events={events}/>}
          {active === 'incidents' && <IncidentManagement events={events} loading={loading}/>}
          {active === 'fleet'     && <FleetManagement/>}
          {active === 'users'     && <UserManagement/>}
          {active === 'health'    && <SystemHealth/>}
          {active === 'reports'   && <Reports/>}
        </main>
      </div>
    </div>
  )
}
