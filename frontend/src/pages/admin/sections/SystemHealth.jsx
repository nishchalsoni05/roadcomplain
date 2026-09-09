import { useState, useEffect, useCallback } from 'react'
import { Cpu, Wifi, Database, Clock, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { healthCheck, getModelInfo, getSummaryStats } from '../../../services/api'

function Ring({ value, max = 100, color = '#3B82F6', size = 100 }) {
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value)) / max
  const offset = circ * (1 - pct)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:'stroke-dashoffset 0.6s ease'}}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontSize={size*0.18} fontWeight="800">
        {Math.round(value)}{max===100?'%':''}
      </text>
    </svg>
  )
}

export default function SystemHealth() {
  const [health,   setHealth]   = useState(null)
  const [model,    setModel]    = useState(null)
  const [summary,  setSummary]  = useState(null)
  const [uptime,   setUptime]   = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [lastFetch,setLastFetch]= useState(null)

  const fetch = useCallback(async () => {
    try {
      const [h, m, s] = await Promise.all([healthCheck(), getModelInfo(), getSummaryStats()])
      setHealth(h.data); setModel(m.data); setSummary(s.data)
      setLastFetch(new Date())
    } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch(); const t = setInterval(fetch, 30000); return () => clearInterval(t) }, [fetch])
  useEffect(() => { const t = setInterval(() => setUptime(u => u + 1), 1000); return () => clearInterval(t) }, [])

  const fmtUptime = (s) => {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  const cameras = [
    {id:'CAM-001',zone:'Zone A',health:94,fps:24,status:'online'},
    {id:'CAM-002',zone:'Zone B',health:87,fps:22,status:'online'},
    {id:'CAM-003',zone:'Zone C',health:0, fps:0, status:'offline'},
    {id:'CAM-004',zone:'Zone D',health:72,fps:18,status:'online'},
    {id:'CAM-005',zone:'Zone E',health:91,fps:25,status:'online'},
    {id:'CAM-006',zone:'Zone F',health:0, fps:0, status:'offline'},
  ]

  const models = model?.metrics
    ? Object.entries(model.metrics).map(([name,m])=>({ name, mAP: (m.val_metrics?.['metrics/mAP50(B)']||0)*100, version:'YOLOv8n' }))
    : [
        {name:'Pothole Detector', mAP:91.2, version:'YOLOv8n'},
        {name:'Road Damage',      mAP:87.6, version:'YOLOv8n'},
        {name:'License Plate',    mAP:94.1, version:'YOLOv8n'},
      ]

  return (
    <>
      {/* Status row */}
      <div className="adm-kpi-grid">
        {[
          { label:'Backend Status', val: health?.status==='healthy'?'Online':'Offline', c: health?.status==='healthy'?'#22C55E':'#EF4444', bg:health?.status==='healthy'?'rgba(34,197,94,.14)':'rgba(239,68,68,.14)', Icon:Wifi },
          { label:'Session Uptime', val: fmtUptime(uptime), c:'#3B82F6', bg:'rgba(59,130,246,.14)', Icon:Clock },
          { label:'Active Sessions',val: summary?.active_sessions??0, c:'#F59E0B', bg:'rgba(245,158,11,.14)', Icon:Database },
          { label:'Cameras Online', val: `${cameras.filter(c=>c.status==='online').length}/${cameras.length}`, c:'#8B5CF6', bg:'rgba(139,92,246,.14)', Icon:Cpu },
        ].map((k,i)=>(
          <div key={i} className="adm-kpi" style={{'--kpi-c':k.c,'--kpi-bg':k.bg}}>
            <div className="adm-kpi-icon"><k.Icon size={20}/></div>
            <div><div className="adm-kpi-val" style={{fontSize:'1.3rem'}}>{loading?'…':k.val}</div><div className="adm-kpi-lbl">{k.label}</div></div>
          </div>
        ))}
      </div>

      {/* Model accuracy */}
      <div className="adm-card">
        <div className="adm-card-title" style={{justifyContent:'space-between'}}>
          <span style={{display:'flex',alignItems:'center',gap:8}}><Cpu size={17} color="var(--a-purple)"/>AI Model Accuracy</span>
          <button className="adm-btn adm-btn-ghost" onClick={fetch}><RefreshCw size={12}/>Refresh</button>
        </div>
        <div style={{display:'flex',gap:28,justifyContent:'center',flexWrap:'wrap',padding:'8px 0 16px'}}>
          {models.map((m,i)=>(
            <div key={i} className="adm-ring-wrap" style={{flexDirection:'column',gap:10}}>
              <Ring value={m.mAP} color={i===0?'#3B82F6':i===1?'#8B5CF6':'#22C55E'} size={110}/>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:'0.8rem',fontWeight:600,color:'var(--text-primary)'}}>{m.name}</div>
                <div style={{fontSize:'0.68rem',color:'var(--a-muted)'}}>{m.version} · mAP50</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Camera health */}
      <div className="adm-card">
        <div className="adm-card-title"><Database size={17} color="var(--a-cyan)"/>Camera Health Monitor</div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Camera ID</th><th>Zone</th><th>Status</th><th>Health</th><th>FPS</th></tr></thead>
            <tbody>
              {cameras.map(c=>(
                <tr key={c.id}>
                  <td style={{fontWeight:600,fontFamily:'monospace',color:'var(--text-primary)'}}>{c.id}</td>
                  <td style={{fontSize:'0.8rem'}}>{c.zone}</td>
                  <td><span className={`adm-badge-pill bp-${c.status}`} style={{display:'inline-flex',alignItems:'center',gap:4}}>{c.status==='online'?<CheckCircle size={10}/>:<AlertTriangle size={10}/>}{c.status}</span></td>
                  <td style={{minWidth:120}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div className="adm-health-bar" style={{flex:1}}>
                        <div className="adm-health-fill" style={{width:`${c.health}%`,background:c.health>80?'#22C55E':c.health>50?'#F59E0B':'#EF4444'}}/>
                      </div>
                      <span style={{fontSize:'0.72rem',color:'var(--a-muted)',minWidth:32}}>{c.health}%</span>
                    </div>
                  </td>
                  <td style={{fontSize:'0.8rem'}}>{c.fps > 0 ? `${c.fps} fps` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {lastFetch && <div style={{textAlign:'right',fontSize:'0.72rem',color:'var(--a-muted)'}}>Last refreshed: {lastFetch.toLocaleTimeString('en-IN')}</div>}
    </>
  )
}
