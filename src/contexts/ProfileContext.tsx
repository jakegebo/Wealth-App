import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface ProfileContextType {
  userId: string | null
  userEmail: string
  profileData: any
  analysis: any
  chatRefs: Record<string, string>
  watchlist: string[]
  savedIdeas: string[]
  incomeIdeas: string[]
  goalAdvice: Record<string, string>
  hasProfile: boolean
  loading: boolean
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
  const [incomeIdeas, setIncomeIdeas] = useState<string[]>([])
  const [goalAdvice, setGoalAdvice] = useState<Record<string, string>>({})
  const [hasProfile, setHasProfile] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') { setLoading(true); load() }
      if (event === 'SIGNED_OUT') {
        setUserId(null); setUserEmail(''); setProfileData(null); setAnalysis(null)
        setChatRefs({}); setWatchlist(['SPY', 'QQQ', 'AAPL']); setSavedIdeas([])
        setIncomeIdeas([]); setGoalAdvice({}); setHasProfile(false); setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    setUserEmail(user.email || '')
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (data) {
      setHasProfile(true)
      setProfileData(data.profile_data || null)
      setAnalysis(data.analysis || null)
      setChatRefs(data.chat_refs || {})
      setWatchlist(data.watchlist || ['SPY', 'QQQ', 'AAPL'])
      setSavedIdeas(data.saved_income_ideas || [])
      setIncomeIdeas(data.income_ideas || [])
      setGoalAdvice(data.goal_advice || {})
    }
    setLoading(false)
  }

  const updateProfile = async (updates: Record<string, any>) => {
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
    <ProfileContext.Provider value={{ userId, userEmail, profileData, analysis, chatRefs, watchlist, savedIdeas, incomeIdeas, goalAdvice, hasProfile, loading, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfile = () => useContext(ProfileContext)
