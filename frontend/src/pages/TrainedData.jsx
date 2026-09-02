import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BrainCircuit, Database, RefreshCw, Image as ImageIcon } from 'lucide-react'
import { getMetrics } from '../services/api'
import api from '../services/api'

export default function TrainedData() {
  const [metrics, setMetrics] = useState(null)
  const [samples, setSamples] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pothole')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [metricsRes, samplesRes] = await Promise.allSettled([
        getMetrics(),
        api.get('/api/analytics/dataset-samples')
      ])
      
      if (metricsRes.status === 'fulfilled' && metricsRes.value.data.status === 'available') {
        setMetrics(metricsRes.value.data.metrics)
      }
      
      if (samplesRes.status === 'fulfilled') {
        setSamples(samplesRes.value.data)
      }
    } catch (e) {
      console.error('Fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const modelLabels = {
    'pothole': 'Pothole Detection Dataset',
    'road_damage': 'Road Damage Dataset',
    'license_plate': 'License Plate Dataset'
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>AI Training Data</h1>
          <p>Explore your Roboflow datasets and YOLOv8 training performance</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchData}>
          <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><span style={{ color: 'var(--text-muted)' }}>Loading trained data...</span></div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          
          {/* Model Metrics */}
          {metrics && Object.keys(metrics).length > 0 ? (
            <div style={{ marginBottom: 32 }}>
              <h3 className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BrainCircuit size={18} color="var(--color-primary)" /> YOLOv8 Model Training Metrics
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(metrics).map(([modelName, m]) => (
                  <div key={modelName} className="card" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {modelName.replace(/_/g, ' ')}
                    </div>
                    <div className="grid-4">
                      <div className="stat-card" style={{ padding: 10 }}>
                        <div>
                          <div className="stat-value" style={{ fontSize: '1.2rem' }}>{Math.round(m.precision * 100)}%</div>
                          <div className="stat-label">Precision</div>
                        </div>
                      </div>
                      <div className="stat-card" style={{ padding: 10 }}>
                        <div>
                          <div className="stat-value" style={{ fontSize: '1.2rem' }}>{Math.round(m.recall * 100)}%</div>
                          <div className="stat-label">Recall</div>
                        </div>
                      </div>
                      <div className="stat-card" style={{ padding: 10 }}>
                        <div>
                          <div className="stat-value" style={{ fontSize: '1.2rem' }}>{Math.round(m.map50 * 100)}%</div>
                          <div className="stat-label">mAP@50</div>
                        </div>
                      </div>
                      <div className="stat-card" style={{ padding: 10 }}>
                        <div>
                          <div className="stat-value" style={{ fontSize: '1.2rem' }}>{Math.round(m.f1_score * 100)}%</div>
                          <div className="stat-label">F1 Score</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8 }}>
                      Trained for {m.epochs_trained} epochs. Source: {m.source_log}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card empty-state" style={{ marginBottom: 32 }}>
              <BrainCircuit size={32} />
              <h3>No Model Metrics Found</h3>
              <p>Train your models first to see performance stats.</p>
            </div>
          )}

          {/* Dataset Gallery */}
          <div>
            <h3 className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={18} color="var(--color-primary)" /> Raw Training Datasets
            </h3>
            
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {['pothole', 'road_damage', 'license_plate'].map(tab => (
                <button
                  key={tab}
                  className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '6px 16px', fontSize: '0.85rem', borderRadius: 20 }}
                  onClick={() => setActiveTab(tab)}
                >
                  {modelLabels[tab]}
                </button>
              ))}
            </div>

            <div className="card" style={{ minHeight: 400, background: 'var(--bg-secondary)', border: 'none' }}>
              {samples?.[activeTab]?.length > 0 ? (
                <div style={{
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: 12
                }}>
                  {samples[activeTab].map((url, i) => (
                    <div key={i} style={{
                      aspectRatio: '1', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                      background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <img 
                        src={`http://localhost:8000${url}`} 
                        alt={`Training sample ${i}`} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                        onError={(e) => { e.target.style.display='none' }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 60, height: '100%' }}>
                  <ImageIcon size={40} style={{ opacity: 0.5, marginBottom: 16 }} />
                  <h4>No Images Available</h4>
                  <p>Could not locate the <code>train/images</code> directory for this dataset.</p>
                </div>
              )}
            </div>
          </div>

        </motion.div>
      )}
    </div>
  )
}
