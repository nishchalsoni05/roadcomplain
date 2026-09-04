import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Camera, Map, FileSearch,
  History, BarChart3, Settings, Shield, Menu, X, Activity
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { path: '/', label: 'Overview', Icon: LayoutDashboard },
  { path: '/detect', label: 'Live Detection', Icon: Camera },
  { path: '/map', label: 'GIS Command Map', Icon: Map },
  { path: '/incidents', label: 'Incident Analysis', Icon: FileSearch },
  { path: '/history', label: 'Test History', Icon: History },
  { path: '/analytics', label: 'Analytics', Icon: BarChart3 },
  { path: '/traffic-analytics', label: 'Traffic Analytics', Icon: Activity },
  { path: '/settings', label: 'Settings', Icon: Settings },
]

export default function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Toggle navigation"
      >
        {collapsed ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`sidebar ${collapsed ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Shield size={24} />
          </div>
          {!collapsed && <div className="sidebar-brand-text" style={{marginLeft: 12}}>RoadRepair</div>}
        </div>

        <div className="sidebar-nav">
          {navItems.map(({ path, label, Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              onClick={() => setCollapsed(false)}
            >
              <Icon size={20} />
              <span className="sidebar-link-text">{label}</span>
            </NavLink>
          ))}
        </div>
      </aside>
    </>
  )
}
