import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { THEMES, ACCENT_COLORS, type ThemeKey, type AccentKey } from '../lib/themes'

interface Preferences {
  theme: ThemeKey
  accentColor: AccentKey
  dashboardLayout: string[]
  hiddenSections: string[]
}

interface ThemeContextType {
  preferences: Preferences
  theme: typeof THEMES[ThemeKey]
  accent: typeof ACCENT_COLORS[AccentKey]
  updatePreferences: (updates: Partial<Preferences>) => Promise<void>
}

const DEFAULT_PREFERENCES: Preferences = {
  theme: 'slate',
  accentColor: 'emerald',
  dashboardLayout: ['networth', 'charts', 'actions', 'debt', 'news', 'goals', 'income', 'watchlist'],
  hiddenSections: []
}

const ThemeContext = createContext<ThemeContextType>({
  preferences: DEFAULT_PREFERENCES,
  theme: THEMES.slate,
  accent: ACCENT_COLORS.emerald,
  updatePreferences: async () => {}
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('preferences').eq('user_id', user.id).single()
    if (data?.preferences) {
      setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences })
    }
  }

  const updatePreferences = async (updates: Partial<Preferences>) => {
    const newPrefs = { ...preferences, ...updates }
    setPreferences(newPrefs)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ preferences: newPrefs }).eq('user_id', user.id)
    }
  }

  const theme = THEMES[preferences.theme] || THEMES.slate
  const accent = ACCENT_COLORS[preferences.accentColor] || ACCENT_COLORS.emerald

  return (
    <ThemeContext.Provider value={{ preferences, theme, accent, updatePreferences }}>
      <div style={{
        '--bg': theme.bg,
        '--bg-secondary': theme.bgSecondary,
        '--bg-tertiary': theme.bgTertiary,
        '--border': theme.border,
        '--text': theme.text,
        '--text-muted': theme.textMuted,
        '--accent': accent.primary,
        '--accent-dark': accent.primaryDark,
        '--accent-bg': accent.bg,
        '--accent-border': accent.border,
        '--accent-text': accent.text,
        background: theme.bg,
        minHeight: '100vh'
      } as React.CSSProperties}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
