import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useProfile } from '../contexts/ProfileContext'

const ACCENT_COLORS = [
  { id: 'default', label: 'Ink', color: '#1a1208' },
  { id: 'green', label: 'Forest', color: '#2d6a4f' },
  { id: 'blue', label: 'Ocean', color: '#1d4ed8' },
  { id: 'purple', label: 'Violet', color: '#6d28d9' },
  { id: 'rose', label: 'Rose', color: '#be123c' },
  { id: 'amber', label: 'Amber', color: '#92400e' },
  { id: 'teal', label: 'Teal', color: '#0f766e' },
  { id: 'slate', label: 'Slate', color: '#334155' },
  { id: 'orange', label: 'Rust', color: '#c2410c' },
]

const SECTIONS = [
  { id: 'health', label: 'Financial Health Score', required: false },
  { id: 'insights', label: 'Key Insights', required: false },
  { id: 'focus', label: "Today's Focus", required: false },
  { id: 'stats', label: 'Quick Stats', required: false },
  { id: 'cashflow', label: 'Cash Flow', required: false },
  { id: 'watchlist', label: 'Watchlist', required: false },
  { id: 'news', label: 'News Preview', required: false },
  { id: 'goals', label: 'Goals', required: false },
  { id: 'retirement', label: 'Retirement', required: false },
  { id: 'actions', label: 'Action Plan', required: false },
  { id: 'debt', label: 'Debt Payoff', required: false },
  { id: 'income', label: 'Income Ideas', required: false },
]

export default function Settings() {
  const navigate = useNavigate()
  const { preferences, updatePreferences } = useTheme()
  const { profileData: profile } = useProfile()
  const [saved, setSaved] = useState(false)
  const [layout, setLayout] = useState(preferences.dashboardLayout)
  const [hidden, setHidden] = useState(preferences.hiddenSections)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const handleSave = async () => {
    await updatePreferences({ dashboardLayout: layout, hiddenSections: hidden })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDragStart = (id: string) => setDragging(id)
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOver(id) }
  const handleDrop = (targetId: string) => {
    if (!dragging || dragging === targetId) return
    const newLayout = [...layout]
    const fromIdx = newLayout.indexOf(dragging)
    const toIdx = newLayout.indexOf(targetId)
    newLayout.splice(fromIdx, 1)
    newLayout.splice(toIdx, 0, dragging)
    setLayout(newLayout)
    setDragging(null)
    setDragOver(null)
  }

  const toggleHidden = (id: string) => {
    setHidden(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id])
  }

  const orderedSections = [
    ...layout.map(id => SECTIONS.find(s => s.id === id)).filter(Boolean),
    ...SECTIONS.filter(s => !layout.includes(s.id))
  ] as typeof SECTIONS

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand-100)', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ padding: '52px 20px 20px', maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/dashboard')}
              style={{ background: 'var(--sand-200)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-700)' }}>
              ←
            </button>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: 'var(--sand-900)' }}>Settings</h1>
              <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0 }}>Customize your experience</p>
            </div>
          </div>
          <button className="btn-primary" onClick={handleSave} style={{ padding: '8px 18px' }}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Dark Mode */}
        <div>
          <p className="label" style={{ marginBottom: '12px' }}>Appearance</p>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 2px' }}>Dark mode</p>
              <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0 }}>Switch to a darker interface</p>
            </div>
            <button
              onClick={() => updatePreferences({ darkMode: !preferences.darkMode })}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                background: preferences.darkMode ? 'var(--accent)' : 'var(--sand-300)'
              }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', transition: 'left 0.2s', left: preferences.darkMode ? '23px' : '3px' }} />
            </button>
          </div>
        </div>

        {/* Accent Color */}
        <div>
          <p className="label" style={{ marginBottom: '12px' }}>Accent Color</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {ACCENT_COLORS.map(c => (
              <button key={c.id} onClick={() => updatePreferences({ accent: c.id })}
                style={{
                  background: 'var(--sand-50)', border: preferences.accent === c.id ? `2px solid ${c.color}` : '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit', transition: 'all 0.15s'
                }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-900)' }}>{c.label}</span>
                {preferences.accent === c.id && <span style={{ marginLeft: 'auto', fontSize: '12px', color: c.color }}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        <div>
          <p className="label" style={{ marginBottom: '12px' }}>Preview</p>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <p style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>WealthApp</p>
              <div style={{ background: 'var(--accent)', color: 'var(--sand-50)', fontSize: '11px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px' }}>Ask AI</div>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '0 0 3px' }}>Net Worth</p>
            <p style={{ fontSize: '28px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 12px', letterSpacing: '-1px' }}>$43,764</p>
            <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: '0 0 4px' }}>This week's focus</p>
              <p style={{ fontSize: '13px', color: '#fff', margin: 0 }}>Pay off student loan — frees $833/mo</p>
            </div>
          </div>
        </div>

        {/* Dashboard Layout */}
        <div>
          <p className="label" style={{ marginBottom: '4px' }}>Dashboard Layout</p>
          <p style={{ fontSize: '12px', color: 'var(--sand-500)', marginBottom: '12px' }}>Drag to reorder · tap to show/hide</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {orderedSections.map(section => (
              <div
                key={section.id}
                draggable
                onDragStart={() => handleDragStart(section.id)}
                onDragOver={e => handleDragOver(e, section.id)}
                onDrop={() => handleDrop(section.id)}
                onDragEnd={() => { setDragging(null); setDragOver(null) }}
                style={{
                  background: dragOver === section.id ? 'var(--accent-light)' : 'var(--sand-50)',
                  border: dragOver === section.id ? `1px solid var(--accent)` : '0.5px solid var(--sand-300)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'grab',
                  opacity: dragging === section.id ? 0.4 : 1,
                  transition: 'all 0.15s'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: 'var(--sand-400)', fontSize: '16px', lineHeight: 1 }}>⠿</span>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--sand-900)' }}>{section.label}</span>
                </div>
                <button
                  onClick={() => toggleHidden(section.id)}
                  style={{
                    background: hidden.includes(section.id) ? 'var(--sand-200)' : 'var(--accent-light)',
                    border: hidden.includes(section.id) ? '0.5px solid var(--sand-300)' : '0.5px solid var(--accent-border)',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: hidden.includes(section.id) ? 'var(--sand-500)' : 'var(--accent)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s'
                  }}>
                  {hidden.includes(section.id) ? 'Hidden' : 'Visible'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Update Financials */}
        <div>
          <p className="label" style={{ marginBottom: '4px' }}>Update Financials</p>
          <p style={{ fontSize: '12px', color: 'var(--sand-500)', marginBottom: '12px' }}>Keep your data accurate for better insights</p>
          <div className="card" style={{ padding: '4px 0' }}>
            {[
              {
                label: 'Income & Cash Flow',
                sub: profile?.monthly_income ? `$${(profile.monthly_income).toLocaleString()}/mo income` : 'Not set',
                step: 1,
                done: !!(profile?.monthly_income || profile?.gross_income),
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                  </svg>
                ),
              },
              {
                label: 'Assets',
                sub: profile?.assets?.length ? `${profile.assets.length} asset${profile.assets.length !== 1 ? 's' : ''} tracked` : 'Nothing added yet',
                step: 2,
                done: profile?.assets?.some((a: any) => a.name && a.value),
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
                  </svg>
                ),
              },
              {
                label: 'Debts',
                sub: profile?.debts?.length ? `${profile.debts.length} debt${profile.debts.length !== 1 ? 's' : ''} tracked` : 'None added',
                step: 3,
                done: profile?.debts?.length > 0,
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                ),
              },
              {
                label: 'Goals',
                sub: profile?.goals?.length ? `${profile.goals.length} goal${profile.goals.length !== 1 ? 's' : ''}` : 'None set yet',
                step: 4,
                done: profile?.goals?.some((g: any) => g.name && g.target_amount),
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                  </svg>
                ),
              },
            ].map((item, i, arr) => (
              <button
                key={item.step}
                onClick={() => navigate(`/onboarding?step=${item.step}&from=settings`)}
                style={{
                  background: 'none', border: 'none',
                  borderBottom: i < arr.length - 1 ? '0.5px solid var(--sand-200)' : 'none',
                  padding: '13px 18px', width: '100%', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left',
                }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                  background: item.done ? 'var(--accent-light)' : 'var(--sand-200)',
                  border: item.done ? '0.5px solid var(--accent-border)' : '0.5px solid var(--sand-300)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: item.done ? 'var(--accent)' : 'var(--sand-500)',
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 1px' }}>{item.label}</p>
                  <p style={{ fontSize: '11px', color: item.done ? 'var(--sand-500)' : 'var(--sand-400)', margin: 0 }}>{item.sub}</p>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--sand-400)', flexShrink: 0 }}>→</span>
              </button>
            ))}
          </div>
        </div>

        {/* Account */}
        <div>
          <p className="label" style={{ marginBottom: '12px' }}>Account</p>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {[
              { label: 'View all chats', action: () => navigate('/chats') },
              { label: 'Retirement planner', action: () => navigate('/retirement') },
            ].map((item, i, arr) => (
              <button key={i} onClick={item.action}
                style={{ background: 'none', border: 'none', borderBottom: i < arr.length - 1 ? '0.5px solid var(--sand-200)' : 'none', padding: '14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--sand-900)', fontSize: '14px', fontWeight: '500' }}>
                {item.label}
                <span style={{ color: 'var(--sand-400)' }}>→</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
