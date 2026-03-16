import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { THEMES, ACCENT_COLORS, DASHBOARD_SECTIONS } from '../lib/themes'

export default function Settings() {
  const navigate = useNavigate()
  const { preferences, theme, accent, updatePreferences } = useTheme()
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
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    setDragOver(id)
  }
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
    const section = DASHBOARD_SECTIONS.find(s => s.id === id)
    if (section?.required) return
    setHidden(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id])
  }

  const orderedSections = layout
    .map(id => DASHBOARD_SECTIONS.find(s => s.id === id))
    .filter(Boolean) as typeof DASHBOARD_SECTIONS

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ borderBottom: '0.5px solid var(--border)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate('/dashboard')}
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>←</button>
            <div>
              <h1 style={{ color: 'var(--text)', fontSize: '16px', fontWeight: '500', margin: 0 }}>Settings</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>Customize your experience</p>
            </div>
          </div>
          <button onClick={handleSave}
            style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '12px', padding: '8px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            {saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Theme */}
        <div>
          <h2 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Theme</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {Object.entries(THEMES).map(([key, t]) => (
              <button key={key} onClick={() => updatePreferences({ theme: key as any })}
                style={{
                  background: t.bg,
                  border: preferences.theme === key ? `2px solid var(--accent)` : `0.5px solid ${t.border}`,
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                  {t.preview.map((c, i) => (
                    <div key={i} style={{ width: '16px', height: '16px', borderRadius: '4px', background: c, border: '0.5px solid rgba(255,255,255,0.1)' }} />
                  ))}
                </div>
                <p style={{ color: t.text, fontSize: '12px', fontWeight: '500', margin: 0 }}>{t.name}</p>
                {preferences.theme === key && (
                  <p style={{ color: 'var(--accent)', fontSize: '10px', margin: '2px 0 0' }}>Active</p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Accent Color */}
        <div>
          <h2 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Accent Color</h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {Object.entries(ACCENT_COLORS).map(([key, a]) => (
              <button key={key} onClick={() => updatePreferences({ accentColor: key as any })}
                style={{
                  background: 'var(--bg-secondary)',
                  border: preferences.accentColor === key ? `2px solid ${a.primary}` : '0.5px solid var(--border)',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s'
                }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: a.primary }} />
                <span style={{ color: 'var(--text)', fontSize: '12px', fontWeight: '500' }}>{a.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div>
          <h2 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Preview</h2>
          <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', background: accent.primary, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: accent.text, fontWeight: '700', fontSize: '11px' }}>W</span>
                </div>
                <span style={{ color: theme.text, fontSize: '14px', fontWeight: '500' }}>WealthApp</span>
              </div>
              <div style={{ background: accent.primary, color: accent.text, fontSize: '11px', padding: '4px 12px', borderRadius: '20px', fontWeight: '600' }}>Ask AI</div>
            </div>
            <div style={{ background: accent.bg, border: `0.5px solid ${accent.border}`, borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontSize: '10px', color: accent.primary, marginBottom: '2px' }}>Net Worth</div>
              <div style={{ fontSize: '24px', fontWeight: '500', color: theme.text }}>$43,764</div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <div><div style={{ fontSize: '9px', color: theme.textMuted }}>Assets</div><div style={{ fontSize: '13px', color: theme.text }}>$53,764</div></div>
                <div><div style={{ fontSize: '9px', color: theme.textMuted }}>Debts</div><div style={{ fontSize: '13px', color: '#f87171' }}>$10,000</div></div>
                <div><div style={{ fontSize: '9px', color: theme.textMuted }}>Save/mo</div><div style={{ fontSize: '13px', color: accent.primary }}>$4,500</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Layout */}
        <div>
          <h2 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Dashboard Layout</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>Drag to reorder · Toggle to show/hide</p>
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
                  background: dragOver === section.id ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                  border: dragOver === section.id ? `0.5px solid var(--accent)` : '0.5px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'grab',
                  opacity: dragging === section.id ? 0.4 : 1,
                  transition: 'all 0.15s'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>⠿</span>
                  <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: '500' }}>{section.label}</span>
                  {section.required && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Required</span>
                  )}
                </div>
                <button
                  onClick={() => toggleHidden(section.id)}
                  disabled={section.required}
                  style={{
                    background: hidden.includes(section.id) ? 'var(--bg-tertiary)' : 'var(--accent-bg)',
                    border: hidden.includes(section.id) ? '0.5px solid var(--border)' : `0.5px solid var(--accent-border)`,
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: '500',
                    color: hidden.includes(section.id) ? 'var(--text-muted)' : 'var(--accent)',
                    cursor: section.required ? 'not-allowed' : 'pointer',
                    opacity: section.required ? 0.5 : 1
                  }}>
                  {hidden.includes(section.id) ? 'Hidden' : 'Visible'}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
