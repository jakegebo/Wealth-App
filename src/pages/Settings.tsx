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

const ALL_SECTIONS: Record<string, string> = {
  health: 'Financial Health Score',
  insights: 'Key Insights',
  focus: "Today's Focus",
  stats: 'Quick Stats',
  cashflow: 'Cash Flow',
  goals: 'Goals',
  actions: 'Action Plan',
  debt: 'Debt Payoff',
  watchlist: 'Watchlist',
  income: 'Income Ideas',
  news: 'News Preview',
  retirement: 'Retirement Preview',
}

const SECTION_GROUPS = [
  {
    key: 'home',
    tab: 'Home',
    emoji: '🏠',
    ids: ['health', 'insights', 'focus', 'stats', 'cashflow'],
  },
  {
    key: 'plan',
    tab: 'Plan',
    emoji: '📋',
    ids: ['goals', 'actions', 'debt'],
  },
  {
    key: 'grow',
    tab: 'Grow',
    emoji: '📈',
    ids: ['watchlist', 'income'],
  },
  {
    key: 'other',
    tab: 'Previews',
    emoji: '👀',
    ids: ['news', 'retirement'],
  },
]

export default function Settings() {
  const navigate = useNavigate()
  const { preferences, updatePreferences } = useTheme()
  const { profileData: profile } = useProfile()
  const [saved, setSaved] = useState(false)
  const allKnownIds = SECTION_GROUPS.flatMap(g => g.ids)
  const [layout, setLayout] = useState(() => {
    const stored = preferences.dashboardLayout
    const missing = allKnownIds.filter(id => !stored.includes(id))
    return [...stored, ...missing]
  })
  const [hidden, setHidden] = useState(preferences.hiddenSections)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [draggingGroup, setDraggingGroup] = useState<string | null>(null)
  const [dragOverPos, setDragOverPos] = useState<'before' | 'after'>('after')

  const handleSave = async () => {
    await updatePreferences({ dashboardLayout: layout, hiddenSections: hidden })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Get the ordered IDs for a group based on current layout
  const getGroupOrder = (groupIds: string[]) => {
    const inLayout = layout.filter(id => groupIds.includes(id))
    const notInLayout = groupIds.filter(id => !layout.includes(id))
    return [...inLayout, ...notInLayout]
  }

  const handleDragStart = (id: string, groupKey: string) => {
    setDragging(id)
    setDraggingGroup(groupKey)
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    setDragOver(id)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragOverPos(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
  }

  const handleDrop = (targetId: string, groupKey: string) => {
    if (!dragging || dragging === targetId || draggingGroup !== groupKey) return
    const newLayout = [...layout]
    // Ensure the dragged item is in layout (it always should be now, but guard anyway)
    if (!newLayout.includes(dragging)) newLayout.push(dragging)
    const fromIdx = newLayout.indexOf(dragging)
    const toIdx = newLayout.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return
    newLayout.splice(fromIdx, 1)
    const insertAt = newLayout.indexOf(targetId)
    newLayout.splice(dragOverPos === 'before' ? insertAt : insertAt + 1, 0, dragging)
    setLayout(newLayout)
    setDragging(null)
    setDragOver(null)
    setDraggingGroup(null)
    setDragOverPos('after')
  }

  const handleDragEnd = () => {
    setDragging(null)
    setDragOver(null)
    setDraggingGroup(null)
    setDragOverPos('after')
  }

  const toggleHidden = (id: string) => {
    setHidden(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id])
  }

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

        {/* Dashboard Layout — grouped by tab */}
        <div>
          <p className="label" style={{ marginBottom: '4px' }}>Dashboard Layout</p>
          <p style={{ fontSize: '12px', color: 'var(--sand-500)', marginBottom: '16px' }}>Drag to reorder within each section · tap to show/hide</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {SECTION_GROUPS.map(group => {
              const orderedIds = getGroupOrder(group.ids)
              return (
                <div key={group.key}>
                  {/* Group header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px' }}>{group.emoji}</span>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--sand-500)', margin: 0, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{group.tab}</p>
                    <div style={{ flex: 1, height: '0.5px', background: 'var(--sand-300)' }} />
                  </div>

                  {/* Sections in this group */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {orderedIds.map(id => {
                      const label = ALL_SECTIONS[id]
                      const isHidden = hidden.includes(id)
                      const isDraggingThis = dragging === id
                      const isDropTarget = dragOver === id && draggingGroup === group.key
                      return (
                        <div
                          key={id}
                          style={{ position: 'relative' }}
                        >
                          {/* insertion line — before */}
                          {isDropTarget && dragOverPos === 'before' && (
                            <div style={{ position: 'absolute', top: '-3px', left: '10px', right: '10px', height: '2px', background: 'var(--accent)', borderRadius: '1px', zIndex: 10 }} />
                          )}
                        <div
                          draggable
                          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; handleDragStart(id, group.key) }}
                          onDragOver={e => handleDragOver(e, id)}
                          onDrop={() => handleDrop(id, group.key)}
                          onDragEnd={handleDragEnd}
                          style={{
                            background: isDropTarget ? 'var(--accent-light)' : 'var(--sand-50)',
                            border: isDropTarget ? '1px solid var(--accent-border)' : '0.5px solid var(--sand-300)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'grab',
                            opacity: isDraggingThis ? 0.35 : 1,
                            transition: 'opacity 0.12s, background 0.12s, border-color 0.12s',
                            userSelect: 'none',
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: 'var(--sand-400)', fontSize: '15px', lineHeight: 1, userSelect: 'none' }}>⠿</span>
                            <span style={{
                              fontSize: '13px',
                              fontWeight: '500',
                              color: isHidden ? 'var(--sand-400)' : 'var(--sand-900)',
                              textDecoration: isHidden ? 'line-through' : 'none',
                              transition: 'color 0.15s'
                            }}>{label}</span>
                          </div>
                          <button
                            onClick={() => toggleHidden(id)}
                            style={{
                              background: isHidden ? 'var(--sand-200)' : 'var(--accent-light)',
                              border: isHidden ? '0.5px solid var(--sand-300)' : '0.5px solid var(--accent-border)',
                              borderRadius: '20px',
                              padding: '3px 10px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: isHidden ? 'var(--sand-500)' : 'var(--accent)',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'all 0.15s',
                              flexShrink: 0,
                            }}>
                            {isHidden ? 'Hidden' : 'Visible'}
                          </button>
                        </div>
                          {/* insertion line — after */}
                          {isDropTarget && dragOverPos === 'after' && (
                            <div style={{ position: 'absolute', bottom: '-3px', left: '10px', right: '10px', height: '2px', background: 'var(--accent)', borderRadius: '1px', zIndex: 10 }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
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
