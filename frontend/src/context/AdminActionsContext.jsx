import { createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext(null)
const STORAGE_KEY = 'margdarshan_admin_actions'
const USERS_KEY   = 'margdarshan_admin_users'
const FLEET_KEY   = 'margdarshan_fleet'
const AUDIT_KEY   = 'margdarshan_audit'

export const ACTION_STATUS = { NEW: 'new', ASSIGNED: 'assigned', IN_PROGRESS: 'in_progress', RESOLVED: 'resolved', DISMISSED: 'dismissed' }
export const STATUS_LABELS = { new: 'New', assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved', dismissed: 'Dismissed' }
export const STATUS_COLORS = { new: '#3B82F6', assigned: '#F59E0B', in_progress: '#8B5CF6', resolved: '#22C55E', dismissed: '#6B7280' }
export const PRIORITY      = { CRITICAL: 'critical', HIGH: 'high', NORMAL: 'normal' }

const DEFAULT_USERS = [
  { id: 'u1', name: 'Rajesh Kumar',   email: 'rajesh@gov.in',   role: 'city_official',  ward: 'Ward 4',  active: true },
  { id: 'u2', name: 'Priya Sharma',   email: 'priya@gov.in',    role: 'maintenance',    ward: 'Ward 7',  active: true },
  { id: 'u3', name: 'Amit Verma',     email: 'amit@gov.in',     role: 'maintenance',    ward: 'Ward 12', active: true },
  { id: 'u4', name: 'Sunita Nair',    email: 'sunita@gov.in',   role: 'readonly',       ward: 'All',     active: true },
  { id: 'u5', name: 'Vikram Singh',   email: 'vikram@gov.in',   role: 'city_official',  ward: 'Ward 2',  active: false },
]

const DEFAULT_FLEET = [
  { id: 'BUS-001', route: 'Route 14 — MG Road',      status: 'online',  lastSync: new Date(Date.now() - 120000).toISOString(),  lat: 28.614, lng: 77.209 },
  { id: 'BUS-002', route: 'Route 22 — Connaught Pl', status: 'online',  lastSync: new Date(Date.now() - 300000).toISOString(),  lat: 28.632, lng: 77.219 },
  { id: 'BUS-003', route: 'Route 07 — Lajpat Nagar', status: 'offline', lastSync: new Date(Date.now() - 3600000).toISOString(), lat: 28.569, lng: 77.243 },
  { id: 'BUS-004', route: 'Route 31 — Dwarka',        status: 'online',  lastSync: new Date(Date.now() - 60000).toISOString(),   lat: 28.593, lng: 77.046 },
  { id: 'BUS-005', route: 'Route 09 — Rohini',        status: 'online',  lastSync: new Date(Date.now() - 180000).toISOString(),  lat: 28.732, lng: 77.118 },
  { id: 'BUS-006', route: 'Route 45 — Noida Link',    status: 'offline', lastSync: new Date(Date.now() - 7200000).toISOString(), lat: 28.548, lng: 77.391 },
]

function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def } catch { return def } }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)) }

export function AdminActionsProvider({ children }) {
  const [actions, setActions] = useState(() => load(STORAGE_KEY, {}))
  const [users,   setUsers]   = useState(() => load(USERS_KEY, DEFAULT_USERS))
  const [fleet,   setFleet]   = useState(() => load(FLEET_KEY, DEFAULT_FLEET))
  const [audit,   setAudit]   = useState(() => load(AUDIT_KEY, []))

  const addAudit = useCallback((adminName, action, detail) => {
    setAudit(prev => {
      const entry = { id: Date.now(), adminName, action, detail, timestamp: new Date().toISOString() }
      const updated = [entry, ...prev].slice(0, 200)
      save(AUDIT_KEY, updated)
      return updated
    })
  }, [])

  const setAction = useCallback((eventId, status, note, assignee, priority, adminName) => {
    setActions(prev => {
      const old = prev[eventId]
      const updated = {
        ...prev,
        [eventId]: {
          eventId, status, note: note || '', assignee: assignee || null,
          priority: priority || PRIORITY.NORMAL, adminName,
          timestamp: new Date().toISOString(),
          history: [...(old?.history || []), { status: old?.status || 'new', note: old?.note || '', timestamp: old?.timestamp || new Date().toISOString() }]
        }
      }
      save(STORAGE_KEY, updated)
      return updated
    })
    addAudit(adminName, `Set status: ${STATUS_LABELS[status]}`, `Incident ${eventId.slice(0,8)}… — ${note || 'no note'}`)
  }, [addAudit])

  const getAction     = useCallback((id) => actions[id] || null, [actions])
  const getAllActions  = useCallback(() => Object.values(actions).sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp)), [actions])
  const getStats      = useCallback(() => {
    const all = Object.values(actions)
    return { total: all.length, new: all.filter(a=>a.status==='new').length, assigned: all.filter(a=>a.status==='assigned').length, in_progress: all.filter(a=>a.status==='in_progress').length, resolved: all.filter(a=>a.status==='resolved').length }
  }, [actions])

  // Users
  const addUser    = useCallback((u) => { setUsers(prev => { const n=[...prev,{...u,id:`u${Date.now()}`}]; save(USERS_KEY,n); return n }) }, [])
  const updateUser = useCallback((id,data) => { setUsers(prev => { const n=prev.map(u=>u.id===id?{...u,...data}:u); save(USERS_KEY,n); return n }) }, [])
  const removeUser = useCallback((id) => { setUsers(prev => { const n=prev.filter(u=>u.id!==id); save(USERS_KEY,n); return n }) }, [])

  // Fleet
  const updateFleet = useCallback((id,data) => { setFleet(prev => { const n=prev.map(f=>f.id===id?{...f,...data}:f); save(FLEET_KEY,n); return n }) }, [])
  const addFleet    = useCallback((f) => { setFleet(prev => { const n=[...prev,f]; save(FLEET_KEY,n); return n }) }, [])

  return (
    <Ctx.Provider value={{ actions, setAction, getAction, getAllActions, getStats, users, addUser, updateUser, removeUser, fleet, updateFleet, addFleet, audit, addAudit }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAdminActions() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAdminActions must be inside AdminActionsProvider')
  return ctx
}
