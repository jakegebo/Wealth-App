import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Preferences {
  accent: string
  darkMode: boolean
  dashboardLayout: string[]
  hiddenSections: string[]
}

interface ThemeContextType {
  preferences: Preferences
  updatePreferences: (updates: Partial<Preferences>) => Promise<void>
}

const DEFAULT_PREFERENCES: Preferences = {
  accent: 'default',
  darkMode: false,
  dashboardLayout: ['health', 'insights', 'focus', 'stats', 'cashflow', 'goals', 'actions', 'debt', 'watchlist', 'income', 'news', 'retirement'],
  hiddenSections: []
}

const ThemeContext = createContext<ThemeContextType>({
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: async () => {}
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    loadPreferences()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (preferences.darkMode) {
      root.setAttribute('data-theme', 'dark')
    } else {
      root.removeAttribute('data-theme')
    }
    if (preferences.accent && preferences.accent !== 'default') {
      root.setAttribute('data-accent', preferences.accent)
    } else {
      root.removeAttribute('data-accent')
    }
  }, [preferences])

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

  return (
    <ThemeContext.Provider value={{ preferences, updatePreferences }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
