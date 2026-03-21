import { useNavigate, useLocation } from 'react-router-dom'
import { useRef, useEffect, useState } from 'react'

const TABS = [
  {
    id: 'plan',
    label: 'Plan',
    path: '/plan',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    )
  },
  {
    id: 'home',
    label: 'Home',
    path: '/dashboard',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  },
  {
    id: 'grow',
    label: 'Grow',
    path: '/grow',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    )
  }
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false })

  const activeIdx = TABS.findIndex(t => t.path === location.pathname)

  useEffect(() => {
    const el = tabRefs.current[activeIdx]
    if (el) {
      setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
    }
  }, [activeIdx])

  return (
    <nav className="bottom-nav">
      {pill.ready && (
        <div
          className="nav-pill"
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {TABS.map((tab, i) => {
        const active = activeIdx === i
        return (
          <button
            key={tab.id}
            ref={el => { tabRefs.current[i] = el }}
            className={`nav-tab ${active ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <div className="nav-tab-icon">{tab.icon(active)}</div>
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
