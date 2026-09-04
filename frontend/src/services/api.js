import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Events
export const getEvents = (params) => api.get('/api/events', { params })
export const getEvent = (id) => api.get(`/api/events/${id}`)
export const syncOfflineEvents = (events) => api.post('/api/events/sync', { events })
export const deleteEvent = (id) => api.delete(`/api/events/${id}`)
export const toggleFavorite = (id, is_favorite) => api.patch(`/api/events/${id}/favorite?is_favorite=${is_favorite}`)

// Sessions
export const createSession = (data) => api.post('/api/sessions', data)
export const getSessions = (params) => api.get('/api/sessions', { params })
export const getSession = (id) => api.get(`/api/sessions/${id}`)
export const endSession = (id) => api.patch(`/api/sessions/${id}/end`)
export const deleteSession = (id) => api.delete(`/api/sessions/${id}`)
export const deleteAllSessions = () => api.delete('/api/sessions')

// Analytics
export const getSummaryStats = () => api.get('/api/analytics/summary')
export const getRoadHealth = () => api.get('/api/analytics/road-health')
export const getTrends = (days = 30) => api.get(`/api/analytics/trends?days=${days}`)
export const getMetrics = () => api.get('/api/analytics/metrics')
export const getHeatmap = () => api.get('/api/analytics/heatmap')
export const getOriginDestination = () => api.get('/api/analytics/origin-destination')
export const getRouteDelays = () => api.get('/api/analytics/route-delays')

// Upload
export const uploadVideo = (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/api/upload/video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  })
}

// Reports
export const downloadEventReport = (eventId) =>
  api.get(`/api/reports/${eventId}/pdf`, { responseType: 'blob' })
export const downloadSessionReport = (sessionId) =>
  api.get(`/api/reports/session/${sessionId}/pdf`, { responseType: 'blob' })

// Health
export const healthCheck = () => api.get('/api/health')
export const getModelInfo = () => api.get('/api/models/info')

// Evidence URL builder
export const getEvidenceUrl = (path) => path ? `${API_BASE}/api/evidence/${path}` : null

export default api
