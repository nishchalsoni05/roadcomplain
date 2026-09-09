import { useState } from 'react'
import { Bus, Wifi, WifiOff, Plus, X, Edit2 } from 'lucide-react'
import { useAdminActions } from '../../../context/AdminActionsContext'

const ROUTES = ['Route 01 — Central Secretariat','Route 02 — India Gate','Route 07 — Lajpat Nagar','Route 09 — Rohini','Route 14 — MG Road','Route 22 — Connaught Pl','Route 31 — Dwarka','Route 45 — Noida Link','Route 52 — Airport Express','Route 60 — Mehrauli']

function AddModal({ onSave, onClose }) {
  const [id,    setId]    = useState('')
  const [route, setRoute] = useState(ROUTES[0])
  return (
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-modal" onClick={e=>e.stopPropagation()} style={{width:380}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h3>Add Vehicle / Camera</h3>
          <button className="adm-logout" onClick={onClose}><X size={18}/></button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div className="adm-form-row">
            <label className="adm-modal-lbl">Vehicle / Camera ID</label>
            <input className="adm-modal-input" placeholder="e.g. BUS-007" value={id} onChange={e=>setId(e.target.value)}/>
          </div>
          <div className="adm-form-row">
            <label className="adm-modal-lbl">Assigned Route</label>
            <select className="adm-modal-select" value={route} onChange={e=>setRoute(e.target.value)}>
              {ROUTES.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="adm-modal-actions">
          <button className="adm-btn adm-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn-primary" onClick={()=>{if(id){onSave({id,route,status:'offline',lastSync:new Date().toISOString(),lat:28.614,lng:77.209});onClose()}}}>Add</button>
        </div>
      </div>
    </div>
  )
}

export default function FleetManagement() {
  const { fleet, updateFleet, addFleet } = useAdminActions()
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editRoute, setEditRoute] = useState('')

  const online  = fleet.filter(f=>f.status==='online').length
  const offline = fleet.filter(f=>f.status==='offline').length

  const timeSince = (iso) => {
    const s = Math.floor((Date.now()-new Date(iso))/1000)
    if(s<60) return `${s}s ago`
    if(s<3600) return `${Math.floor(s/60)}m ago`
    return `${Math.floor(s/3600)}h ago`
  }

  return (
    <>
      {/* Stats */}
      <div className="adm-kpi-grid">
        {[
          {label:'Total Vehicles', val:fleet.length,  c:'#3B82F6', bg:'rgba(59,130,246,.14)'},
          {label:'Online',         val:online,         c:'#22C55E', bg:'rgba(34,197,94,.14)'},
          {label:'Offline',        val:offline,        c:'#EF4444', bg:'rgba(239,68,68,.14)'},
          {label:'Coverage (%)',   val:`${fleet.length?Math.round(online/fleet.length*100):0}%`, c:'#8B5CF6', bg:'rgba(139,92,246,.14)'},
        ].map((k,i)=>(
          <div key={i} className="adm-kpi" style={{'--kpi-c':k.c,'--kpi-bg':k.bg}}>
            <div className="adm-kpi-icon"><Bus size={20}/></div>
            <div><div className="adm-kpi-val">{k.val}</div><div className="adm-kpi-lbl">{k.label}</div></div>
          </div>
        ))}
      </div>

      <div className="adm-card">
        <div className="adm-card-title" style={{justifyContent:'space-between'}}>
          <span style={{display:'flex',alignItems:'center',gap:8}}><Bus size={17} color="var(--a-accent)"/>Fleet Registry</span>
          <button className="adm-btn adm-btn-primary" onClick={()=>setShowAdd(true)}><Plus size={14}/>Add Vehicle</button>
        </div>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Vehicle ID</th><th>Route</th><th>Status</th><th>Last Sync</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {fleet.map(f=>(
                <tr key={f.id}>
                  <td style={{fontWeight:600,color:'var(--text-primary)',fontFamily:'monospace'}}>{f.id}</td>
                  <td>
                    {editId===f.id
                      ? <select className="adm-select" style={{fontSize:'0.78rem',padding:'4px 8px'}} value={editRoute} onChange={e=>setEditRoute(e.target.value)}>
                          {ROUTES.map(r=><option key={r} value={r}>{r}</option>)}
                        </select>
                      : <span style={{fontSize:'0.82rem'}}>{f.route}</span>}
                  </td>
                  <td>
                    <span className={`adm-badge-pill bp-${f.status}`} style={{display:'inline-flex',alignItems:'center',gap:5}}>
                      {f.status==='online'?<Wifi size={11}/>:<WifiOff size={11}/>}
                      {f.status.charAt(0).toUpperCase()+f.status.slice(1)}
                    </span>
                  </td>
                  <td style={{fontSize:'0.78rem',color:'var(--a-muted)'}}>{timeSince(f.lastSync)}</td>
                  <td>
                    <div style={{display:'flex',gap:6}}>
                      {editId===f.id ? (
                        <>
                          <button className="adm-btn adm-btn-primary" style={{padding:'3px 9px',fontSize:'0.7rem'}} onClick={()=>{updateFleet(f.id,{route:editRoute});setEditId(null)}}>Save</button>
                          <button className="adm-btn adm-btn-ghost"   style={{padding:'3px 9px',fontSize:'0.7rem'}} onClick={()=>setEditId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="adm-btn adm-btn-ghost" style={{padding:'3px 9px',fontSize:'0.7rem'}} onClick={()=>{setEditId(f.id);setEditRoute(f.route)}}><Edit2 size={11}/>Edit</button>
                          <button className="adm-btn adm-btn-ghost" style={{padding:'3px 9px',fontSize:'0.7rem'}} onClick={()=>updateFleet(f.id,{status:f.status==='online'?'offline':'online',lastSync:new Date().toISOString()})}>
                            {f.status==='online'?<WifiOff size={11}/>:<Wifi size={11}/>}Toggle
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddModal onSave={f=>addFleet(f)} onClose={()=>setShowAdd(false)}/>}
    </>
  )
}
