export const THEMES = {
  slate: {
    name: 'Slate',
    bg: '#0f1117',
    bgSecondary: '#1a1d27',
    bgTertiary: '#222536',
    border: '#2a2d3a',
    text: '#f1f5f9',
    textMuted: '#64748b',
    preview: ['#0f1117', '#1a1d27', '#222536']
  },
  ocean: {
    name: 'Ocean',
    bg: '#020b18',
    bgSecondary: '#041428',
    bgTertiary: '#0a1f3a',
    border: '#1e3a5f',
    text: '#e2e8f0',
    textMuted: '#64748b',
    preview: ['#020b18', '#041428', '#0a1f3a']
  },
  forest: {
    name: 'Forest',
    bg: '#021209',
    bgSecondary: '#041f0f',
    bgTertiary: '#062a14',
    border: '#0d3318',
    text: '#e2e8f0',
    textMuted: '#4ade80',
    preview: ['#021209', '#041f0f', '#062a14']
  },
  violet: {
    name: 'Violet',
    bg: '#0d0520',
    bgSecondary: '#150a30',
    bgTertiary: '#1a0d3d',
    border: '#2d1f4a',
    text: '#e2e8f0',
    textMuted: '#a78bfa',
    preview: ['#0d0520', '#150a30', '#1a0d3d']
  },
  charcoal: {
    name: 'Charcoal',
    bg: '#111111',
    bgSecondary: '#171717',
    bgTertiary: '#1c1c1c',
    border: 'rgba(255,255,255,0.1)',
    text: '#ffffff',
    textMuted: '#525252',
    preview: ['#111111', '#171717', '#222222']
  },
  amber: {
    name: 'Amber',
    bg: '#150900',
    bgSecondary: '#1f0e00',
    bgTertiary: '#2a1400',
    border: 'rgba(251,191,36,0.2)',
    text: '#fef3c7',
    textMuted: '#d97706',
    preview: ['#150900', '#1f0e00', '#2a1400']
  }
}

export const ACCENT_COLORS = {
  emerald: {
    name: 'Emerald',
    primary: '#34d399',
    primaryDark: '#059669',
    bg: 'rgba(52,211,153,0.1)',
    border: 'rgba(52,211,153,0.2)',
    text: '#000000'
  },
  blue: {
    name: 'Blue',
    primary: '#3b82f6',
    primaryDark: '#1d4ed8',
    bg: 'rgba(59,130,246,0.1)',
    border: 'rgba(59,130,246,0.2)',
    text: '#ffffff'
  },
  violet: {
    name: 'Violet',
    primary: '#a78bfa',
    primaryDark: '#7c3aed',
    bg: 'rgba(167,139,250,0.1)',
    border: 'rgba(167,139,250,0.2)',
    text: '#ffffff'
  },
  amber: {
    name: 'Amber',
    primary: '#fbbf24',
    primaryDark: '#d97706',
    bg: 'rgba(251,191,36,0.1)',
    border: 'rgba(251,191,36,0.2)',
    text: '#000000'
  },
  teal: {
    name: 'Teal',
    primary: '#2dd4bf',
    primaryDark: '#0d9488',
    bg: 'rgba(45,212,191,0.1)',
    border: 'rgba(45,212,191,0.2)',
    text: '#000000'
  },
  rose: {
    name: 'Rose',
    primary: '#fb7185',
    primaryDark: '#e11d48',
    bg: 'rgba(251,113,133,0.1)',
    border: 'rgba(251,113,133,0.2)',
    text: '#ffffff'
  }
}

export const DASHBOARD_SECTIONS = [
  { id: 'networth', label: 'Net Worth', required: true },
  { id: 'charts', label: 'Charts', required: false },
  { id: 'actions', label: 'Action Plan', required: false },
  { id: 'goals', label: 'Goals', required: false },
  { id: 'debt', label: 'Debt Payoff', required: false },
  { id: 'news', label: 'Latest News', required: false },
  { id: 'income', label: 'Income Ideas', required: false },
  { id: 'watchlist', label: 'Watchlist', required: false },
]

export type ThemeKey = keyof typeof THEMES
export type AccentKey = keyof typeof ACCENT_COLORS
