import { useState } from 'react'
import { Search, Eye, ChevronLeft, ChevronRight, Camera, X, User } from 'lucide-react'
import { useAdminActions, ACTION_STATUS, STATUS_LABELS, STATUS_COLORS } from '../../../context/AdminActionsContext'

const ET = { pothole:'Pothole', road_damage:'Road Damage', waterlogging:'Waterlogging', vehicle:'Vehicle', pedestrian:'Pedestrian', rash_driving:'Rash Driving', close_call:'Close Call', missing_signage:'Missing Signage', damaged_signboard:'Damaged Signboard', damaged_divider:'Damaged Divider', missing_zebra:'Missing Zebra', license_plate:'License Plate', traffic_bottleneck:'Traffic Bottleneck', pedestrian_risk:'Pedestrian Risk' }

const PRIORITY_OPTS = ['critical','high','normal']
const PER_PAGE = 12

// ── Action Modal ──────────────────────────────────────────────────────────────
function ActionModal({ event, current, users, onSave, onClose }) {
  const [status,   setStatus]   = useState(current?.status   || ACTION_STATUS.NEW)
  const [note,     setNote]     = useState(current?.note     || '')
  const [assignee, setAssignee] = useState(current?.assignee || '')
  const [priority, setPriority] = useState(current?.priority || 'normal')
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  return (
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-modal" onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <h3>Review Incident</h3>
            <p style={{fontSize:'0.75rem',color:'var(--a-muted)',marginTop:2}}>{ET[event.event_type]||event.event_type} · {event.address||'Location unknown'}</p>
          </div>
          <button className="adm-logout" onClick={onClose}><X size={18}/></button>
        </div>

        {event.evidence_url && (
          <img src={`${apiBase}${event.evidence_url}`} alt="evidence" style={{width:'100%',height:160,objectFit:'cover',borderRadius:6,marginBottom:14,border:'1px solid var(--a-border)'}} onError={e=>e.target.style.display='none'}/>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="adm-form-row">
              <label className="adm-modal-lbl">Status</label>
              <select className="adm-modal-select" value={status} onChange={e=>setStatus(e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="adm-form-row">
              <label className="adm-modal-lbl">Priority</label>
              <select className="adm-modal-select" value={priority} onChange={e=>setPriority(e.target.value)}>
                {PRIORITY_OPTS.map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="adm-form-row">
            <label className="adm-modal-lbl">Assign To</label>
            <select className="adm-modal-select" value={assignee} onChange={e=>setAssignee(e.target.value)}>
              <option value="">— Unassigned —</option>
              {users.filter(u=>u.active && (u.role==='maintenance'||u.role==='city_official')).map(u=>(
                <option key={u.id} value={u.name}>{u.name} ({u.ward})</option>
              ))}
            </select>
          </div>

          <div className="adm-form-row">
            <label className="adm-modal-lbl">Ministry Note</label>
            <textarea className="adm-modal-textarea" placeholder="Official remarks or action instructions…" value={note} onChange={e=>setNote(e.target.value)}/>
          </div>

          {current?.history?.length > 0 && (
            <div>
              <label className="adm-modal-lbl">History</label>
              {current.history.slice(-3).map((h,i)=>(
                <div key={i} style={{fontSize:'0.72rem',color:'var(--a-muted)',padding:'4px 0',borderBottom:'1px solid var(--a-border)'}}>
                  <strong style={{color:STATUS_COLORS[h.status]}}>{STATUS_LABELS[h.status]}</strong> · {new Date(h.timestamp).toLocaleString('en-IN')}
                  {h.note&&<div style={{color:'var(--a-dim)',marginTop:1}}>{h.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="adm-modal-actions">
          <button className="adm-btn adm-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn-primary" onClick={()=>{onSave(status,note,assignee,priority);onClose()}}>Save Action</button>
        </div>
      </div>
    </div>
  )
}

// ── Kanban view ───────────────────────────────────────────────────────────────
function KanbanView({ events, actions, users, onSelect }) {
  const cols = [
    { key:'new',        label:'New',         color:'#3B82F6' },
    { key:'assigned',   label:'Assigned',    color:'#F59E0B' },
    { key:'in_progress',label:'In Progress', color:'#8B5CF6' },
    { key:'resolved',   label:'Resolved',    color:'#22C55E' },
  ]

  const getEventsForStatus = (status) => {
    if (status === 'new') return events.filter(e => !actions[e.id])
    return events.filter(e => actions[e.id]?.status === status)
  }

  return (
    <div className="adm-kanban">
      {cols.map(col => {
        const colEvents = getEventsForStatus(col.key).slice(0, 15)
        return (
          <div className="adm-kanban-col" key={col.key}>
            <div className="adm-kanban-header" style={{color:col.color}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:col.color,display:'inline-block'}}/>
              {col.label}
              <span style={{marginLeft:'auto',background:col.color+'22',color:col.color,fontSize:'0.65rem',padding:'1px 6px',borderRadius:10,fontWeight:700}}>
                {colEvents.length}
              </span>
            </div>
            {colEvents.map(evt => (
              <div className="adm-kanban-card" key={evt.id} onClick={()=>onSelect(evt)}>
                <div style={{fontWeight:600,fontSize:'0.78rem',marginBottom:4,color:'var(--text-primary)'}}>{ET[evt.event_type]||evt.event_type}</div>
                <div style={{fontSize:'0.7rem',color:'var(--a-muted)',marginBottom:6}}>{evt.address||'Location unknown'}</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  <span className={`adm-badge-pill bp-${evt.severity}`}>{evt.severity}</span>
                  {actions[evt.id]?.assignee && <span style={{fontSize:'0.65rem',color:'var(--a-dim)'}}>→ {actions[evt.id].assignee}</span>}
                  {actions[evt.id]?.priority==='critical' && <span className="adm-badge-pill bp-critical">CRITICAL</span>}
                </div>
              </div>
            ))}
            {colEvents.length === 0 && <div style={{fontSize:'0.75rem',color:'var(--a-muted)',textAlign:'center',padding:'20px 0'}}>No items</div>}
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function IncidentManagement({ events, loading }) {
  const { actions, setAction, users } = useAdminActions()
  const [view,     setView]     = useState('table') // 'table' | 'kanban'
  const [search,   setSearch]   = useState('')
  const [fType,    setFType]    = useState('')
  const [fSev,     setFSev]     = useState('')
  const [fStatus,  setFStatus]  = useState('')
  const [page,     setPage]     = useState(1)
  const [selected, setSelected] = useState(null)

  const filtered = events.filter(e => {
    const a = actions[e.id]
    const ms = !search || (e.event_type||'').includes(search.toLowerCase()) || (e.address||'').toLowerCase().includes(search.toLowerCase())
    const mt = !fType    || e.event_type === fType
    const ms2= !fSev     || e.severity   === fSev
    const ma = !fStatus  || (fStatus==='new'?!a:a?.status===fStatus)
    return ms&&mt&&ms2&&ma
  })

  const total = Math.max(1, Math.ceil(filtered.length/PER_PAGE))
  const paged = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE)

  const handleAction = (status,note,assignee,priority) => {
    setAction(selected.id, status, note, assignee, priority, 'Ministry Admin')
  }

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  return (
    <div className="adm-card">
      <div className="adm-card-title" style={{justifyContent:'space-between'}}>
        <span style={{display:'flex',alignItems:'center',gap:8}}>
          Incident Management
          <span style={{fontSize:'0.75rem',color:'var(--a-muted)',fontWeight:400}}>{filtered.length} records</span>
        </span>
        <div style={{display:'flex',gap:8}}>
          <button className={`adm-btn ${view==='table'?'adm-btn-primary':'adm-btn-ghost'}`} onClick={()=>setView('table')}>Table</button>
          <button className={`adm-btn ${view==='kanban'?'adm-btn-primary':'adm-btn-ghost'}`} onClick={()=>setView('kanban')}>Kanban</button>
        </div>
      </div>

      <div className="adm-filter-bar">
        <div style={{position:'relative',flex:1,minWidth:180}}>
          <Search size={13} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'var(--a-muted)'}}/>
          <input className="adm-input" style={{paddingLeft:28,width:'100%'}} placeholder="Search incidents…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
        </div>
        <select className="adm-select" value={fType} onChange={e=>{setFType(e.target.value);setPage(1)}}>
          <option value="">All Types</option>
          {Object.entries(ET).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select className="adm-select" value={fSev} onChange={e=>{setFSev(e.target.value);setPage(1)}}>
          <option value="">All Severity</option>
          {['critical','high','medium','low'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
        <select className="adm-select" value={fStatus} onChange={e=>{setFStatus(e.target.value);setPage(1)}}>
          <option value="">All Status</option>
          <option value="new">New / Unactioned</option>
          {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {view === 'kanban' ? (
        <KanbanView events={events} actions={actions} users={users} onSelect={setSelected}/>
      ) : loading ? (
        <div className="adm-empty">Loading incidents…</div>
      ) : paged.length === 0 ? (
        <div className="adm-empty">No incidents match your filters</div>
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Evidence</th><th>Type</th><th>Severity</th><th>Priority</th>
                  <th>Location</th><th>Assignee</th><th>Status</th><th>Detected</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(evt => {
                  const a = actions[evt.id]
                  return (
                    <tr key={evt.id}>
                      <td>
                        {evt.evidence_url
                          ? <img src={`${apiBase}${evt.evidence_url}`} alt="ev" className="adm-thumb" onError={e=>e.target.style.display='none'}/>
                          : <div className="adm-thumb-ph"><Camera size={13} color="var(--a-muted)"/></div>}
                      </td>
                      <td><span className="adm-tag">{ET[evt.event_type]||evt.event_type}</span></td>
                      <td><span className={`adm-badge-pill bp-${evt.severity}`}>{evt.severity}</span></td>
                      <td><span className={`adm-badge-pill bp-${a?.priority||'normal'}`}>{a?.priority||'normal'}</span></td>
                      <td style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'0.77rem'}}>{evt.address||(evt.latitude?`${evt.latitude?.toFixed(3)}°N`:'—')}</td>
                      <td style={{fontSize:'0.77rem'}}>
                        {a?.assignee ? <span style={{display:'flex',alignItems:'center',gap:4}}><User size={11}/>{a.assignee}</span> : <span style={{color:'var(--a-muted)'}}>Unassigned</span>}
                      </td>
                      <td><span className={`adm-badge-pill bp-${a?.status||'new'}`}>{a?STATUS_LABELS[a.status]:'New'}</span></td>
                      <td style={{fontSize:'0.72rem',color:'var(--a-muted)'}}>{new Date(evt.detected_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                      <td>
                        <button className="adm-btn adm-btn-ghost" style={{padding:'4px 9px',fontSize:'0.7rem'}} onClick={()=>setSelected(evt)}>
                          <Eye size={11}/>Review
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="adm-pagination">
            <button className="adm-pg-btn" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={13}/></button>
            {Array.from({length:Math.min(5,total)},(_,i)=>{
              const pg = page<=3?i+1:page-2+i
              if(pg<1||pg>total) return null
              return <button key={pg} className={`adm-pg-btn ${pg===page?'active':''}`} onClick={()=>setPage(pg)}>{pg}</button>
            })}
            <button className="adm-pg-btn" onClick={()=>setPage(p=>Math.min(total,p+1))} disabled={page===total}><ChevronRight size={13}/></button>
          </div>
        </>
      )}

      {selected && (
        <ActionModal event={selected} current={actions[selected.id]} users={users} onSave={handleAction} onClose={()=>setSelected(null)}/>
      )}
    </div>
  )
}
