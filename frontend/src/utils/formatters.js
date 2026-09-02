export function formatConfidence(confidence) {
  return `${(confidence * 100).toFixed(1)}%`
}

export function formatCoordinate(value, type = 'lat') {
  if (value == null) return 'N/A'
  const direction = type === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W')
  return `${Math.abs(value).toFixed(6)}° ${direction}`
}

export function formatAccuracy(meters) {
  if (meters == null) return null
  if (meters < 1) return '< 1m'
  if (meters < 1000) return `±${meters.toFixed(0)}m`
  return `±${(meters / 1000).toFixed(1)}km`
}

export function formatTimestamp(ts) {
  if (!ts) return 'N/A'
  const d = new Date(ts)
  return d.toLocaleString()
}

export function formatRelativeTime(ts) {
  if (!ts) return ''
  const now = new Date()
  const then = new Date(ts)
  const diff = (now - then) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function formatEventType(type) {
  return type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || ''
}

export function getSeverityClass(severity) {
  return `badge-${severity}`
}

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}
