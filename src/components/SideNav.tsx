import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const TABS = [
  {
    id: 'home',
    label: 'Home',
    path: '/dashboard',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  },
  {
    id: 'plan',
    label: 'Plan',
    path: '/plan',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    )
  },
  {
    id: 'grow',
    label: 'Grow',
    path: '/grow',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    )
  }
]

const SECONDARY = [
  {
    id: 'money',
    label: 'Money',
    path: '/money',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
      </svg>
    )
  },
  {
    id: 'news',
    label: 'News',
    path: '/news',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/>
        <line x1="16" y1="13" x2="16" y2="17"/>
        <line x1="8" y1="13" x2="12" y2="13"/>
        <line x1="8" y1="9" x2="16" y2="9"/>
      </svg>
    )
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: () => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    )
  }
]

export default function SideNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sideNavCollapsed') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sideNavCollapsed', String(collapsed))
    document.documentElement.setAttribute('data-sidenav', collapsed ? 'collapsed' : 'expanded')
  }, [collapsed])

  // Set initial attribute on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-sidenav', collapsed ? 'collapsed' : 'expanded')
  }, [])

  return (
    <nav className={`side-nav${collapsed ? ' side-nav--collapsed' : ''}`}>
      <div className="side-nav-brand" onClick={() => navigate('/dashboard')}>
        <div className="side-nav-logo">W</div>
        {!collapsed && <span>Wealth</span>}
      </div>

      {!collapsed && <div className="side-nav-section-label">Main</div>}
      <div className="side-nav-items">
        {TABS.map((tab) => {
          const active = location.pathname === tab.path
          return (
            <button
              key={tab.id}
              className={`side-nav-item ${active ? 'active' : ''}`}
              onClick={() => navigate(tab.path)}
              title={collapsed ? tab.label : undefined}
            >
              {tab.icon(active)}
              {!collapsed && <span>{tab.label}</span>}
            </button>
          )
        })}
      </div>

      {!collapsed && <div className="side-nav-section-label" style={{ marginTop: '16px' }}>More</div>}
      {collapsed && <div style={{ marginTop: '16px' }} />}
      <div className="side-nav-items">
        {SECONDARY.map((item) => {
          const active = location.pathname === item.path
          return (
            <button
              key={item.id}
              className={`side-nav-item ${active ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
            >
              {item.icon()}
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </div>

      <div className="side-nav-spacer" />

      <div className="side-nav-footer">
        <button
          className="side-nav-ai-btn"
          onClick={() => navigate('/chats')}
          title={collapsed ? 'Ask AI' : undefined}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          {!collapsed && <span>Ask AI</span>}
        </button>

        <button
          className="side-nav-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {collapsed
              ? <><polyline points="9 18 15 12 9 6"/></>
              : <><polyline points="15 18 9 12 15 6"/></>
            }
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  )
}
