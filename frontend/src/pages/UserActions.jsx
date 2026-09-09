import { useState, useEffect } from 'react'
import { Gavel, CheckCircle, RefreshCw, AlertOctagon, XCircle, Clock, Filter, Bell } from 'lucide-react'
import { useAdminActions, STATUS_LABELS, STATUS_COLORS } from '../context/AdminActionsContext'
import { getEvents } from '../services/api'

const ET = { pothole:'Pothole', road_damage:'Road Damage', waterlogging:'Waterlogging', vehicle:'Vehicle', pedestrian:'Pedestrian', rash_driving:'Rash Driving', close_call:'Close Call', missing_signage:'Missing Signage', damaged_signboard:'Damaged Signboard', damaged_divider:'Damaged Divider', missing_zebra:'Missing Zebra', license_plate:'License Plate', traffic_bottleneck:'Traffic Bottleneck', pedestrian_risk:'Pedestrian Risk' }
const STATUS_ICONS = { new:Clock, assigned:Gavel, in_progress:RefreshCw, resolved:CheckCircle, dismissed:XCircle }
const STATUS_BG    = { new:'rgba(59,130,246,.08)', assigned:'rgba(245,158,11,.08)', in_progress:'rgba(139,92,246,.08)', resolved:'rgba(34,197,94,.08)', dismissed:'rgba(107,114,128,.08)' }

export default function UserActions() {
  const { getAllActions, getStats } = useAdminActions()
  const [evtMap, setEvtMap] = useState({})
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEvents({ page_size:200 }).then(res=>{
      const m={}; (res.data.events||[]).forEach(e=>m[e.id]=e); setEvtMap(m)
    }).catch(console.error).finally(()=>setLoading(false))
  }, [])

  const all    = getAllActions()
  const stats  = getStats()
  const list   = filter ? all.filter(a=>a.status===filter) : all

  const statCards = [
    {label:'Total Actions', val:stats.total,       c:'#3B82F6', Icon:Gavel        },
    {label:'Resolved',      val:stats.resolved,     c:'#22C55E', Icon:CheckCircle  },
    {label:'In Progress',   val:stats.in_progress,  c:'#8B5CF6', Icon:RefreshCw   },
    {label:'Escalated',     val:stats.escalated||0, c:'#EF4444', Icon:AlertOctagon },
  ]

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 style={{display:'flex',alignItems:'center',gap:10}}>
          <Gavel size={24} color="var(--color-amber)"/> Ministry Actions
        </h1>
        <p>Official verdicts taken by the Ministry of Road Transport on detected incidents</p>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{marginBottom:24}}>
        {statCards.map((s,i)=>(
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{background:`${s.c}20`,color:s.c}}><s.Icon size={22}/></div>
            <div><div className="stat-value">{s.val}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:20}}>
        <Filter size={14} color="var(--text-muted)"/>
        {['','new','in_progress','resolved','dismissed'].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{
            padding:'5px 14px', borderRadius:20,
            border:`1px solid ${filter===s?'var(--color-amber)':'var(--border-color)'}`,
            background:filter===s?'rgba(252,163,17,.1)':'var(--bg-secondary)',
            color:filter===s?'var(--color-amber)':'var(--text-muted)',
            fontSize:'0.78rem', fontWeight:600, cursor:'pointer', transition:'all .15s'
          }}>
            {s===''?'All':STATUS_LABELS[s]}
          </button>
        ))}
        <span style={{marginLeft:'auto',fontSize:'0.78rem',color:'var(--text-muted)'}}>{list.length} actions</span>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:48,color:'var(--text-muted)'}}><RefreshCw size={22}/><div style={{marginTop:12}}>Loading…</div></div>
      ) : list.length === 0 ? (
        <div style={{textAlign:'center',padding:64,background:'var(--bg-card)',borderRadius:12,border:'1px solid var(--border-color)',color:'var(--text-muted)'}}>
          <Bell size={38} style={{marginBottom:14,opacity:.35}}/>
          <h3 style={{color:'var(--text-primary)',marginBottom:6}}>No Actions Yet</h3>
          <p style={{fontSize:'0.85rem'}}>Ministry verdicts on incidents will appear here once an administrator reviews the complaints.</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {list.map((action,i) => {
            const evt = evtMap[action.eventId]
            const Icon = STATUS_ICONS[action.status]||Clock
            const borderColor = STATUS_COLORS[action.status]||'#3B82F6'
            return (
              <div key={action.eventId} style={{
                background:'var(--bg-card)', border:'1px solid var(--border-color)',
                borderLeft:`4px solid ${borderColor}`, borderRadius:10,
                padding:'16px 20px', display:'flex', flexDirection:'column', gap:10,
                animation:'slideUpFade .4s ease forwards', animationDelay:`${i*.05}s`, opacity:0
              }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                  <div>
                    <span style={{display:'inline-block',background:'rgba(59,130,246,.1)',color:'var(--color-amber)',fontSize:'0.7rem',fontWeight:700,padding:'2px 9px',borderRadius:4,marginBottom:5,letterSpacing:'.04em'}}>
                      {ET[evt?.event_type]||evt?.event_type||'Incident'}
                    </span>
                    <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:'0.88rem'}}>
                      {evt?.address||(evt?.latitude?`${parseFloat(evt.latitude).toFixed(4)}°N`:'Location not available')}
                    </div>
                  </div>
                  <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 12px',borderRadius:20,background:STATUS_BG[action.status]||STATUS_BG.new,border:`1px solid ${borderColor}40`,color:borderColor,fontSize:'0.78rem',fontWeight:600}}>
                    <Icon size={12}/>{STATUS_LABELS[action.status]||action.status}
                  </div>
                </div>

                {action.note && (
                  <div style={{background:'var(--bg-secondary)',border:'1px solid var(--border-color)',borderRadius:7,padding:'10px 14px',fontSize:'0.84rem',color:'var(--text-primary)',lineHeight:1.6}}>
                    <div style={{fontSize:'0.67rem',fontWeight:700,color:'var(--text-muted)',marginBottom:3,textTransform:'uppercase',letterSpacing:'.07em'}}>Ministry Verdict</div>
                    "{action.note}"
                  </div>
                )}

                <div style={{display:'flex',gap:18,flexWrap:'wrap',fontSize:'0.74rem',color:'var(--text-muted)'}}>
                  {evt?.detected_at && <span><strong style={{color:'var(--text-primary)'}}>Detected:</strong> {new Date(evt.detected_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>}
                  <span><strong style={{color:'var(--text-primary)'}}>By:</strong> {action.adminName||'Ministry Admin'}</span>
                  <span><strong style={{color:'var(--text-primary)'}}>Action date:</strong> {new Date(action.timestamp).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                  {action.assignee && <span><strong style={{color:'var(--text-primary)'}}>Assigned to:</strong> {action.assignee}</span>}
                  {evt?.severity && <span><strong style={{color:'var(--text-primary)'}}>Severity:</strong> <span style={{color:evt.severity==='critical'?'#EF4444':evt.severity==='high'?'#F59E0B':'inherit'}}>{evt.severity}</span></span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
