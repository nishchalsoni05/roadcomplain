import { useState } from 'react'
import { Download, FileText, BarChart2, Calendar } from 'lucide-react'
import { getEvents, getTrends, downloadEventReport, downloadSessionReport, getSessions } from '../../../services/api'
import { useAdminActions, STATUS_LABELS } from '../../../context/AdminActionsContext'

const ET = { pothole:'Pothole', road_damage:'Road Damage', waterlogging:'Waterlogging', vehicle:'Vehicle', pedestrian:'Pedestrian', rash_driving:'Rash Driving', close_call:'Close Call', missing_signage:'Missing Signage', damaged_signboard:'Damaged Signboard', damaged_divider:'Damaged Divider', missing_zebra:'Missing Zebra', license_plate:'License Plate', traffic_bottleneck:'Traffic Bottleneck', pedestrian_risk:'Pedestrian Risk' }

export default function Reports() {
  const { getAllActions } = useAdminActions()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [loading,  setLoading]  = useState({})
  const [sessions, setSessions] = useState([])
  const [sessionsPg, setSessionsPg] = useState(false)

  const setL = (k,v) => setLoading(p=>({...p,[k]:v}))

  const downloadCSV = (rows, filename) => {
    const blob = new Blob([rows.join('\n')], {type:'text/csv'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download=filename; a.click()
    URL.revokeObjectURL(url)
  }

  const exportIncidentCSV = async () => {
    setL('csv', true)
    try {
      const res = await getEvents({ page_size:200, ...(dateFrom?{date_from:dateFrom}:{}), ...(dateTo?{date_to:dateTo}:{}) })
      const events = res.data.events || []
      const actions = getAllActions()
      const actionMap = Object.fromEntries(actions.map(a=>[a.eventId,a]))
      const headers = ['ID','Type','Severity','Confidence','Latitude','Longitude','Address','Detected At','Status','Assignee','Note']
      const rows = events.map(e=>{
        const a = actionMap[e.id]
        return [e.id,ET[e.event_type]||e.event_type,e.severity,(e.confidence*100).toFixed(1)+'%',e.latitude||'',e.longitude||'',`"${e.address||''}"`,e.detected_at,a?STATUS_LABELS[a.status]:'New',a?.assignee||'',`"${a?.note||''}"`].join(',')
      })
      downloadCSV([headers.join(','), ...rows], `incidents_${dateFrom||'all'}_to_${dateTo||'now'}.csv`)
    } catch(e) { alert('Export failed') } finally { setL('csv',false) }
  }

  const exportTrendCSV = async () => {
    setL('trend', true)
    try {
      const res = await getTrends(365)
      const trends = res.data.trends || []
      const rows = trends.map(t=>`${t.date},${t.count}`)
      downloadCSV(['Date,Count',...rows], 'incident_trend_12months.csv')
    } catch(e) { alert('Export failed') } finally { setL('trend',false) }
  }

  const exportActionLog = () => {
    const actions = getAllActions()
    const headers = ['Event ID','Status','Priority','Assignee','Admin','Note','Timestamp']
    const rows = actions.map(a=>[a.eventId,a.status,a.priority||'',a.assignee||'',a.adminName,`"${a.note||''}"`,a.timestamp].join(','))
    downloadCSV([headers.join(','),...rows], 'admin_action_log.csv')
  }

  const loadSessions = async () => {
    setL('sessions', true)
    try {
      const res = await getSessions({page_size:20})
      setSessions(res.data.sessions||[]); setSessionsPg(true)
    } catch(e) { alert('Failed to load sessions') } finally { setL('sessions',false) }
  }

  const dlEventPDF = async (id) => {
    try {
      const res = await downloadEventReport(id)
      const url = URL.createObjectURL(new Blob([res.data],{type:'application/pdf'}))
      window.open(url,'_blank')
    } catch { alert('PDF not available') }
  }

  const dlSessionPDF = async (id) => {
    try {
      const res = await downloadSessionReport(id)
      const url = URL.createObjectURL(new Blob([res.data],{type:'application/pdf'}))
      window.open(url,'_blank')
    } catch { alert('PDF not available') }
  }

  const cards = [
    {
      title:'Incident Report (CSV)', Icon:Download, color:'#3B82F6', bg:'rgba(59,130,246,.12)',
      desc:'Export all detected incidents filtered by date range with admin actions and assignees.',
      action: exportIncidentCSV, key:'csv', label:'Export Incidents CSV'
    },
    {
      title:'Trend Analysis (CSV)', Icon:BarChart2, color:'#8B5CF6', bg:'rgba(139,92,246,.12)',
      desc:'12-month daily incident count trend — suitable for ministry reports.',
      action: exportTrendCSV, key:'trend', label:'Export Trend CSV'
    },
    {
      title:'Action Log (CSV)', Icon:FileText, color:'#22C55E', bg:'rgba(34,197,94,.12)',
      desc:'All ministry verdicts, assignees, and notes for accountability and audit purposes.',
      action: exportActionLog, key:'alog', label:'Export Action Log'
    },
    {
      title:'Session Reports (PDF)', Icon:Calendar, color:'#F59E0B', bg:'rgba(245,158,11,.12)',
      desc:'Download per-session incident PDF reports from all completed detection sessions.',
      action: loadSessions, key:'sessions', label:'Load Sessions'
    },
  ]

  return (
    <>
      {/* Date filter */}
      <div className="adm-card" style={{padding:'16px 22px'}}>
        <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          <Calendar size={16} color="var(--a-accent)"/>
          <span style={{fontSize:'0.82rem',fontWeight:600,color:'var(--a-dim)'}}>Date Range Filter</span>
          <input type="date" className="adm-input" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:160}}/>
          <span style={{color:'var(--a-muted)',fontSize:'0.8rem'}}>to</span>
          <input type="date" className="adm-input" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:160}}/>
          {(dateFrom||dateTo) && <button className="adm-btn adm-btn-ghost" style={{fontSize:'0.75rem',padding:'5px 10px'}} onClick={()=>{setDateFrom('');setDateTo('')}}>Clear</button>}
        </div>
      </div>

      {/* Export cards */}
      <div className="adm-g2">
        {cards.map((c,i)=>(
          <div key={i} className="adm-card" style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:40,height:40,borderRadius:8,background:c.bg,color:c.color,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><c.Icon size={18}/></div>
              <div>
                <div style={{fontWeight:700,fontSize:'0.92rem',color:'var(--text-primary)'}}>{c.title}</div>
                <div style={{fontSize:'0.73rem',color:'var(--a-muted)',marginTop:2}}>{c.desc}</div>
              </div>
            </div>
            <button className="adm-btn adm-btn-primary" style={{alignSelf:'flex-start'}} onClick={c.action} disabled={loading[c.key]}>
              {loading[c.key]?'Processing…':<><Download size={13}/>{c.label}</>}
            </button>
          </div>
        ))}
      </div>

      {/* Session list for PDF download */}
      {sessionsPg && sessions.length > 0 && (
        <div className="adm-card">
          <div className="adm-card-title"><FileText size={17} color="var(--a-amber)"/>Detection Sessions — PDF Reports</div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Session ID</th><th>Source</th><th>Status</th><th>Started</th><th>PDF</th></tr></thead>
              <tbody>
                {sessions.map(s=>(
                  <tr key={s.id}>
                    <td style={{fontFamily:'monospace',fontSize:'0.75rem',color:'var(--a-muted)'}}>{s.id.slice(0,16)}…</td>
                    <td><span className="adm-tag">{s.source_type}</span></td>
                    <td><span className={`adm-badge-pill bp-${s.status==='completed'?'resolved':s.status==='active'?'in_progress':'dismissed'}`}>{s.status}</span></td>
                    <td style={{fontSize:'0.75rem',color:'var(--a-muted)'}}>{new Date(s.created_at).toLocaleString('en-IN')}</td>
                    <td><button className="adm-btn adm-btn-ghost" style={{padding:'3px 9px',fontSize:'0.7rem'}} onClick={()=>dlSessionPDF(s.id)}><Download size={11}/>PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
