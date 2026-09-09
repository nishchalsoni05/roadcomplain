import { useState } from 'react'
import { Plus, Trash2, Edit2, X, Users, Clock, Shield } from 'lucide-react'
import { useAdminActions } from '../../../context/AdminActionsContext'

const ROLES = { super_admin:'Super Admin', city_official:'City Official', maintenance:'Maintenance Team', readonly:'Read-Only Viewer' }
const ROLE_COLORS = { super_admin:'#EF4444', city_official:'#3B82F6', maintenance:'#F59E0B', readonly:'#6B7280' }
const WARDS = ['All','Ward 1','Ward 2','Ward 3','Ward 4','Ward 5','Ward 6','Ward 7','Ward 8','Ward 9','Ward 10','Ward 11','Ward 12']

function UserModal({ existing, onSave, onClose }) {
  const [name,  setName]  = useState(existing?.name  || '')
  const [email, setEmail] = useState(existing?.email || '')
  const [role,  setRole]  = useState(existing?.role  || 'maintenance')
  const [ward,  setWard]  = useState(existing?.ward  || 'Ward 1')
  return (
    <div className="adm-overlay" onClick={onClose}>
      <div className="adm-modal" onClick={e=>e.stopPropagation()} style={{width:420}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h3>{existing?'Edit Official':'Add Official'}</h3>
          <button className="adm-logout" onClick={onClose}><X size={18}/></button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div className="adm-form-row"><label className="adm-modal-lbl">Full Name</label><input className="adm-modal-input" placeholder="Enter full name" value={name} onChange={e=>setName(e.target.value)}/></div>
          <div className="adm-form-row"><label className="adm-modal-lbl">Official Email</label><input className="adm-modal-input" type="email" placeholder="name@gov.in" value={email} onChange={e=>setEmail(e.target.value)}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="adm-form-row">
              <label className="adm-modal-lbl">Role</label>
              <select className="adm-modal-select" value={role} onChange={e=>setRole(e.target.value)}>
                {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="adm-form-row">
              <label className="adm-modal-lbl">Ward / Zone</label>
              <select className="adm-modal-select" value={ward} onChange={e=>setWard(e.target.value)}>
                {WARDS.map(w=><option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="adm-modal-actions">
          <button className="adm-btn adm-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn-primary" onClick={()=>{if(name&&email){onSave({name,email,role,ward,active:true});onClose()}}}>
            {existing?'Save Changes':'Add Official'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const { users, addUser, updateUser, removeUser, audit } = useAdminActions()
  const [modal,   setModal]   = useState(null) // null | 'add' | user obj
  const [auditPg, setAuditPg] = useState(1)
  const AUDIT_PER = 10

  const auditSlice = audit.slice((auditPg-1)*AUDIT_PER, auditPg*AUDIT_PER)
  const auditTotal = Math.max(1, Math.ceil(audit.length/AUDIT_PER))

  const downloadAudit = () => {
    const csv = ['Timestamp,Admin,Action,Detail', ...audit.map(a=>`"${a.timestamp}","${a.adminName}","${a.action}","${a.detail}"`)].join('\n')
    const b = new Blob([csv],{type:'text/csv'})
    const url = URL.createObjectURL(b)
    const a = document.createElement('a'); a.href=url; a.download='audit_log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Stats */}
      <div className="adm-kpi-grid">
        {Object.entries(ROLES).map(([k,v])=>(
          <div key={k} className="adm-kpi" style={{'--kpi-c':ROLE_COLORS[k],'--kpi-bg':ROLE_COLORS[k]+'22'}}>
            <div className="adm-kpi-icon"><Shield size={18}/></div>
            <div><div className="adm-kpi-val">{users.filter(u=>u.role===k).length}</div><div className="adm-kpi-lbl">{v}</div></div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="adm-card">
        <div className="adm-card-title" style={{justifyContent:'space-between'}}>
          <span style={{display:'flex',alignItems:'center',gap:8}}><Users size={17} color="var(--a-accent)"/>Officials & Access</span>
          <button className="adm-btn adm-btn-primary" onClick={()=>setModal('add')}><Plus size={14}/>Add Official</button>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Ward</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id}>
                  <td style={{fontWeight:600,color:'var(--text-primary)'}}>{u.name}</td>
                  <td style={{fontSize:'0.78rem',color:'var(--a-muted)'}}>{u.email}</td>
                  <td>
                    <span className="adm-badge-pill" style={{background:ROLE_COLORS[u.role]+'22',color:ROLE_COLORS[u.role],border:`1px solid ${ROLE_COLORS[u.role]}44`}}>
                      {ROLES[u.role]||u.role}
                    </span>
                  </td>
                  <td style={{fontSize:'0.8rem'}}>{u.ward}</td>
                  <td>
                    <span className={`adm-badge-pill ${u.active?'bp-online':'bp-offline'}`}>{u.active?'Active':'Inactive'}</span>
                  </td>
                  <td>
                    <div style={{display:'flex',gap:6}}>
                      <button className="adm-btn adm-btn-ghost" style={{padding:'3px 9px',fontSize:'0.7rem'}} onClick={()=>setModal(u)}><Edit2 size={11}/>Edit</button>
                      <button className="adm-btn adm-btn-ghost" style={{padding:'3px 9px',fontSize:'0.7rem'}} onClick={()=>updateUser(u.id,{active:!u.active})}>{u.active?'Deactivate':'Activate'}</button>
                      <button className="adm-btn adm-btn-danger" style={{padding:'3px 9px',fontSize:'0.7rem'}} onClick={()=>{if(confirm('Remove this official?'))removeUser(u.id)}}><Trash2 size={11}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit log */}
      <div className="adm-card">
        <div className="adm-card-title" style={{justifyContent:'space-between'}}>
          <span style={{display:'flex',alignItems:'center',gap:8}}><Clock size={17} color="var(--a-amber)"/>Audit Log <span style={{fontSize:'0.75rem',color:'var(--a-muted)',fontWeight:400}}>{audit.length} entries</span></span>
          <button className="adm-btn adm-btn-ghost" onClick={downloadAudit}>⬇ Export CSV</button>
        </div>
        {audit.length === 0 ? (
          <div className="adm-empty">No audit entries yet — actions will be logged here automatically</div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Timestamp</th><th>Admin</th><th>Action</th><th>Detail</th></tr></thead>
                <tbody>
                  {auditSlice.map(a=>(
                    <tr key={a.id}>
                      <td style={{fontSize:'0.72rem',color:'var(--a-muted)',whiteSpace:'nowrap'}}>{new Date(a.timestamp).toLocaleString('en-IN')}</td>
                      <td style={{fontWeight:600,fontSize:'0.8rem'}}>{a.adminName}</td>
                      <td><span className="adm-tag">{a.action}</span></td>
                      <td style={{fontSize:'0.77rem',color:'var(--a-dim)'}}>{a.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="adm-pagination">
              {Array.from({length:auditTotal},(_,i)=>i+1).slice(0,5).map(pg=>(
                <button key={pg} className={`adm-pg-btn ${pg===auditPg?'active':''}`} onClick={()=>setAuditPg(pg)}>{pg}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {modal==='add' && <UserModal onSave={u=>addUser(u)} onClose={()=>setModal(null)}/>}
      {modal&&modal!=='add' && <UserModal existing={modal} onSave={d=>updateUser(modal.id,d)} onClose={()=>setModal(null)}/>}
    </>
  )
}
