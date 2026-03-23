import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Maps certain goal categories to actual asset values so current_amount
// stays in sync automatically when the user updates their financials.
const GOAL_ASSET_SYNC: Record<string, string[]> = {
  emergency_fund: ['savings'],
  retirement:     ['retirement'],
  investment:     ['brokerage', 'investment'],
  vehicle:        ['vehicle', 'auto'],
  business:       ['business'],
}

function syncGoalAmounts(profile: any): any {
  if (!profile?.goals?.length || !profile?.assets) return profile
  const assets: any[] = profile.assets

  const sumCategories = (cats: string[]) =>
    assets
      .filter(a => cats.includes((a.category || '').toLowerCase()))
      .reduce((s: number, a: any) => s + (a.value || 0), 0)

  const goals = profile.goals.map((goal: any) => {
    const cats = GOAL_ASSET_SYNC[goal.category]
    if (!cats) return goal
    return { ...goal, current_amount: sumCategories(cats) }
  })

  return { ...profile, goals }
}

interface LiveQuote {
  price: number
  change: number
  changePercent: string
}

interface ProfileContextType {
  userId: string | null
  userEmail: string
  profileData: any
  analysis: any
  chatRefs: Record<string, string>
  watchlist: string[]
  savedIdeas: string[]
  incomeIdeas: any[]
  goalAdvice: Record<string, string>
  hasProfile: boolean
  loading: boolean
  liveQuotes: Record<string, LiveQuote>
  liveQuotesLoading: boolean
  refreshLiveQuotes: () => Promise<void>
  updateProfile: (updates: Record<string, any>) => Promise<void>
}

const ProfileContext = createContext<ProfileContextType>({
  userId: null,
  userEmail: '',
  profileData: null,
  analysis: null,
  chatRefs: {},
  watchlist: ['SPY', 'QQQ', 'AAPL'],
  savedIdeas: [],
  incomeIdeas: [],
  goalAdvice: {},
  hasProfile: false,
  loading: true,
  liveQuotes: {},
  liveQuotesLoading: false,
  refreshLiveQuotes: async () => {},
  updateProfile: async () => {}
})

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [profileData, setProfileData] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [chatRefs, setChatRefs] = useState<Record<string, string>>({})
  const [watchlist, setWatchlist] = useState<string[]>(['SPY', 'QQQ', 'AAPL'])
  const [savedIdeas, setSavedIdeas] = useState<string[]>([])
  const [incomeIdeas, setIncomeIdeas] = useState<any[]>([])
  const [goalAdvice, setGoalAdvice] = useState<Record<string, string>>({})
  const [hasProfile, setHasProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuote>>({})
  const [liveQuotesLoading, setLiveQuotesLoading] = useState(false)

  // Track the last set of symbols fetched to avoid redundant calls
  const lastFetchedSymbolsRef = useRef<string>('')

  useEffect(() => {
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') { setLoading(true); load() }
      if (event === 'SIGNED_OUT') {
        setUserId(null); setUserEmail(''); setProfileData(null); setAnalysis(null)
        setChatRefs({}); setWatchlist(['SPY', 'QQQ', 'AAPL']); setSavedIdeas([])
        setIncomeIdeas([]); setGoalAdvice({}); setHasProfile(false); setLoading(false)
        lastFetchedSymbolsRef.current = ''
        setLiveQuotes({})
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchLiveQuotes = async (profileDataArg: any) => {
    const symbols: string[] = []
    for (const asset of profileDataArg?.assets || []) {
      for (const pos of asset.positions || []) {
        if (pos.symbol && pos.shares > 0 && !symbols.includes(pos.symbol)) {
          symbols.push(pos.symbol)
        }
      }
    }
    if (!symbols.length) return

    // Skip if we already have fresh quotes for the exact same symbol set
    const symbolKey = symbols.slice().sort().join(',')
    if (symbolKey === lastFetchedSymbolsRef.current) return
    lastFetchedSymbolsRef.current = symbolKey

    setLiveQuotesLoading(true)
    try {
      const res = await fetch(`/api/stocks?symbols=${symbols.join(',')}`)
      const data = await res.json()
      const map: Record<string, LiveQuote> = {}
      for (const q of data.quotes || []) {
        map[q.symbol] = { price: q.price, change: q.change, changePercent: q.changePercent }
      }
      setLiveQuotes(map)
    } catch { }
    setLiveQuotesLoading(false)
  }

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    setUserEmail(user.email || '')
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (data) {
      const pd = syncGoalAmounts(data.profile_data || null)
      setHasProfile(true)
      setProfileData(pd)
      setAnalysis(data.analysis || null)
      setChatRefs(data.chat_refs || {})
      const savedWatchlist = data.watchlist?.length ? data.watchlist : null
      if (!savedWatchlist && data.profile_data?.assets) {
        const holdingSymbols: string[] = []
        for (const a of data.profile_data.assets) {
          for (const p of a.positions || []) {
            if (p.symbol && !holdingSymbols.includes(p.symbol)) holdingSymbols.push(p.symbol)
            if (holdingSymbols.length >= 6) break
          }
          if (holdingSymbols.length >= 6) break
        }
        setWatchlist(holdingSymbols.length ? holdingSymbols : ['SPY', 'QQQ', 'AAPL'])
      } else {
        setWatchlist(savedWatchlist || ['SPY', 'QQQ', 'AAPL'])
      }
      setSavedIdeas(data.saved_income_ideas || [])
      setIncomeIdeas(data.income_ideas || [])
      setGoalAdvice(data.goal_advice || {})
      // Auto-fetch live quotes so pages don't each trigger it separately
      fetchLiveQuotes(pd)
    }
    setLoading(false)
  }

  const refreshLiveQuotes = async () => {
    // Force refresh by clearing the cache key
    lastFetchedSymbolsRef.current = ''
    return fetchLiveQuotes(profileData)
  }

  const updateProfile = async (updates: Record<string, any>) => {
    // Sync goal amounts from assets before saving
    if ('profile_data' in updates && updates.profile_data) {
      updates = { ...updates, profile_data: syncGoalAmounts(updates.profile_data) }
    }
    // Optimistic local updates
    if ('profile_data' in updates) { setProfileData(updates.profile_data); setHasProfile(true) }
    if ('analysis' in updates) setAnalysis(updates.analysis)
    if ('chat_refs' in updates) setChatRefs(updates.chat_refs)
    if ('watchlist' in updates) setWatchlist(updates.watchlist)
    if ('saved_income_ideas' in updates) setSavedIdeas(updates.saved_income_ideas)
    if ('income_ideas' in updates) setIncomeIdeas(updates.income_ideas)
    if ('goal_advice' in updates) setGoalAdvice(updates.goal_advice)
    if (!userId) return
    const { error } = await supabase.from('profiles').upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
    if (error) console.error('Failed to save profile:', error)
  }

  return (
    <ProfileContext.Provider value={{ userId, userEmail, profileData, analysis, chatRefs, watchlist, savedIdeas, incomeIdeas, goalAdvice, hasProfile, loading, liveQuotes, liveQuotesLoading, refreshLiveQuotes, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfile = () => useContext(ProfileContext)
