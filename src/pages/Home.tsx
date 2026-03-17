import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { useProfile } from '../contexts/ProfileContext'
import NetWorthChart from '../components/NetWorthChart'

interface Analysis {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  monthlyIncome: number
  monthlyExpenses: number
  availableToSave: number
  savingsRate: number
  overallSummary: string
  nextActions: { priority: number; title: string; description: string; impact: string; timeframe: string }[]
  goals: { name: string; targetAmount: number; currentAmount: number; percentage: number; monthlyNeeded: number; feasibility: string }[]
  debts: { name: string; balance: number; interestRate: number; recommendedPayment: number; monthsToPayoff: number; strategy: string }[]
  incomeIdeas: string[]
}

interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: string
}

interface Article {
  title: string
  url: string
  image: string
  source: string
  publishedAt: string
}

interface MiniDashboard {
  type: 'assets' | 'debts' | 'savings'
  analysis: string
  loading: boolean
}

function CountUp({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef<number | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!value) return
    startRef.current = null
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      const progress = Math.min((timestamp - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value])

  return <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(display)}</span>
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'good morning'
  if (h < 17) return 'good afternoon'
  return 'good evening'
}

function MiniDashboardSheet({ type, analysis, loading, onClose, profile, netWorth, totalAssets, totalLiabilities, availableToSave }: {
  type: 'assets' | 'debts' | 'savings'
  analysis: string
  loading: boolean
  onClose: () => void
  profile: any
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  availableToSave: number
}) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  const titles = { assets: 'Asset Breakdown', debts: 'Debt Overview', savings: 'Savings Power' }
  const colors = { assets: 'var(--sand-900)', debts: 'var(--danger)', savings: 'var(--success)' }

  const formatAnalysis = (text: string) => text.split('\n').map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ fontWeight: '700', color: 'var(--sand-900)', margin: '10px 0 4px', fontSize: '14px' }}>{line.slice(2, -2)}</p>
    if (line.startsWith('- ')) return <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}><span style={{ color: 'var(--accent)', fontWeight: '700' }}>·</span><span style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--sand-800)' }}>{line.slice(2)}</span></div>
    if (line === '') return <div key={i} style={{ height: '6px' }} />
    return <p key={i} style={{ fontSize: '14px', lineHeight: '1.6', margin: '2px 0', color: 'var(--sand-800)' }}>{line}</p>
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div className="animate-slide" style={{ background: 'var(--sand-50)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '680px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--sand-300)', borderRadius: '2px' }} />
        </div>
        <div style={{ padding: '16px 24px', borderBottom: '0.5px solid var(--sand-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: colors[type] }}>{titles[type]}</h2>
          <button onClick={onClose} style={{ background: 'var(--sand-200)', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', color: 'var(--sand-700)' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          {type === 'assets' && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '36px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 4px', letterSpacing: '-1px' }}>{fmt(totalAssets)}</p>
              <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 16px' }}>total assets</p>
              {profile?.assets?.map((asset: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid var(--sand-200)' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 2px', color: 'var(--sand-900)' }}>{asset.name}</p>
                    {asset.holdings && <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{asset.holdings}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>{fmt(asset.value)}</p>
                    <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{((asset.value / totalAssets) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {type === 'debts' && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '36px', fontWeight: '300', color: 'var(--danger)', margin: '0 0 4px', letterSpacing: '-1px' }}>{fmt(totalLiabilities)}</p>
              <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 16px' }}>total debt</p>
              {profile?.debts?.map((debt: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid var(--sand-200)' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 2px', color: 'var(--sand-900)' }}>{debt.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{debt.interest_rate}% APR</p>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--danger)' }}>{fmt(debt.balance)}</p>
                </div>
              ))}
            </div>
          )}
          {type === 'savings' && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '36px', fontWeight: '300', color: 'var(--success)', margin: '0 0 4px', letterSpacing: '-1px' }}>{fmt(availableToSave)}<span style={{ fontSize: '16px', color: 'var(--sand-500)' }}>/mo</span></p>
              <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 16px' }}>available to save</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {[
                  { label: 'Monthly income', value: fmt(profile?.monthly_income || 0), color: 'var(--sand-900)' },
                  { label: 'Monthly expenses', value: fmt(profile?.monthly_expenses || 0), color: 'var(--danger)' },
                  { label: 'Available to save', value: fmt(availableToSave), color: 'var(--success)' },
                  { label: 'Net worth', value: fmt(netWorth), color: 'var(--sand-900)' },
                ].map((item, i) => (
                  <div key={i} className="card-muted" style={{ padding: '12px' }}>
                    <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '0 0 3px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '24px', height: '24px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
              </div>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-700)', margin: 0 }}>AI Analysis</p>
            </div>
            {loading ? (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '4px 0' }}>
                {[0, 150, 300].map(d => (
                  <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />
                ))}
              </div>
            ) : (
              <div>{formatAnalysis(analysis)}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { preferences } = useTheme()
  const { userId, userEmail, profileData: profile, analysis, chatRefs, watchlist, hasProfile, loading: profileLoading, updateProfile } = useProfile()
  const firstName = userEmail.split('@')[0] || 'there'
  const [analyzing, setAnalyzing] = useState(false)
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [news, setNews] = useState<Article[]>([])
  const [miniDash, setMiniDash] = useState<MiniDashboard | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [analysisError, setAnalysisError] = useState(false)

  useEffect(() => {
    if (profileLoading) return
    if (!hasProfile) { navigate('/onboarding'); return }
    fetchStocks(watchlist)
    fetchNews()
    if (analysis) {
      saveNetWorthHistory(userId!, analysis)
    } else if (profile) {
      runAnalysis(profile)
    }
  }, [profileLoading])

  const saveNetWorthHistory = async (uid: string, analysisData: Analysis) => {
    try {
      await fetch('/api/networth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          netWorth: analysisData.netWorth,
          totalAssets: analysisData.totalAssets,
          totalLiabilities: analysisData.totalLiabilities
        })
      })
    } catch (err) { console.error('Failed to save net worth history:', err) }
  }

  const fetchStocks = async (symbols: string[]) => {
    try {
      const res = await fetch(`/api/stocks?symbols=${symbols.slice(0, 4).join(',')}`)
      const data = await res.json()
      setStocks(data.quotes || [])
    } catch (err) { console.error('Failed to fetch stocks:', err) }
  }

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news?category=markets&page=1')
      const data = await res.json()
      setNews((data.articles || []).slice(0, 3))
    } catch (err) { console.error('Failed to fetch news:', err) }
  }

  const runAnalysis = async (profileData: any) => {
    setAnalyzing(true)
    setAnalysisError(false)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })
      const result = await res.json()
      await updateProfile({ analysis: result })
      if (userId) saveNetWorthHistory(userId, result)
    } catch (err) {
      console.error('Analysis failed:', err)
      setAnalysisError(true)
    }
    setAnalyzing(false)
  }

  const openMiniDash = async (type: 'assets' | 'debts' | 'savings') => {
    if (!analysis || !profile) return
    setMiniDash({ type, analysis: '', loading: true })
    const prompts = {
      assets: `Analyze this person's asset allocation: ${JSON.stringify(profile.assets)}. Total: $${analysis.totalAssets}. Give specific advice on diversification and top 2-3 actions to optimize. Be concise.`,
      debts: `Analyze these debts: ${JSON.stringify(profile.debts)}. Income: $${profile.monthly_income}. Give priority payoff order and best strategy. Be concise.`,
      savings: `Person has $${analysis.availableToSave}/mo to save. Income: $${profile.monthly_income}, Expenses: $${profile.monthly_expenses}. Assets: ${JSON.stringify(profile.assets)}. Give specific dollar allocation advice. Be concise.`
    }
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompts[type] }], profile, topic: 'general' })
      })
      const data = await res.json()
      setMiniDash({ type, analysis: data.message || '', loading: false })
    } catch {
      setMiniDash({ type, analysis: 'Unable to load analysis.', loading: false })
    }
  }

  const openChat = async (key: string, prompt: string, title: string) => {
    if (!userId) return
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data } = await supabase.from('chats').insert({ user_id: userId, title, topic: 'general', messages: [] }).select().single()
    if (data) {
      await updateProfile({ chat_refs: { ...chatRefs, [key]: data.id } })
      navigate(`/chat/${data.id}`, { state: { prompt } })
    }
  }

  const isVisible = (id: string) => !preferences.hiddenSections.includes(id)
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  if (profileLoading || analyzing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sand-100)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--sand-600)', fontSize: '14px' }}>{analyzing ? 'Analyzing your finances...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (analysisError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sand-100)' }}>
        <div style={{ textAlign: 'center', padding: '0 32px' }}>
          <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--sand-900)', marginBottom: '8px' }}>Couldn't load your analysis</p>
          <p style={{ fontSize: '14px', color: 'var(--sand-500)', marginBottom: '24px' }}>Check your connection and try again.</p>
          <button onClick={() => profile && runAnalysis(profile)}
            style={{ background: 'var(--accent)', color: 'var(--sand-50)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  const topAction = analysis.nextActions?.[0]

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 16px 100px' }}>

      {/* Header */}
      <div style={{ padding: '52px 0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 2px' }}>{greeting()}, {firstName}</p>
          <h1 style={{ fontSize: '20px', fontWeight: '500', color: 'var(--sand-900)', margin: 0, letterSpacing: '-0.3px' }}>Here's your overview</h1>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => navigate('/settings')}
            style={{ background: 'var(--sand-200)', border: 'none', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-600)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
          <button onClick={() => runAnalysis(profile)}
            style={{ background: 'var(--sand-200)', border: 'none', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-600)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Net Worth Hero */}
      <div className="card animate-fade" style={{ marginBottom: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p className="label" style={{ marginBottom: '6px' }}>Net Worth</p>
            <div style={{ fontSize: '44px', fontWeight: '300', color: 'var(--sand-900)', letterSpacing: '-2px', lineHeight: '1' }}>
              <CountUp value={analysis.netWorth} />
            </div>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ background: showHistory ? 'var(--accent-light)' : 'var(--sand-200)', border: showHistory ? '0.5px solid var(--accent-border)' : 'none', borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontSize: '11px', fontWeight: '600', color: showHistory ? 'var(--accent)' : 'var(--sand-600)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {showHistory ? 'Hide history' : 'Show history'}
          </button>
        </div>

        {/* Net Worth History Chart */}
        {showHistory && userId && (
          <div className="animate-fade" style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '0.5px solid var(--sand-200)' }}>
            <NetWorthChart userId={userId} />
          </div>
        )}

        {/* Clickable stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { id: 'assets', label: 'Assets', value: fmt(analysis.totalAssets), color: 'var(--sand-900)', bg: 'var(--sand-200)' },
            { id: 'debts', label: 'Debts', value: fmt(analysis.totalLiabilities), color: 'var(--danger)', bg: 'rgba(192,57,43,0.06)' },
            { id: 'savings', label: 'Save/mo', value: fmt(analysis.availableToSave), color: 'var(--success)', bg: 'rgba(122,158,110,0.08)' }
          ].map(item => (
            <button key={item.id} onClick={() => openMiniDash(item.id as any)}
              style={{ background: item.bg, border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 8px', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' }}>
              <p className="label" style={{ marginBottom: '3px', fontSize: '9px' }}>{item.label}</p>
              <p style={{ fontSize: '13px', fontWeight: '600', color: item.color, margin: '0 0 3px' }}>{item.value}</p>
              <p style={{ fontSize: '9px', color: 'var(--sand-500)', margin: 0 }}>tap to analyze</p>
            </button>
          ))}
        </div>
      </div>

      {/* Today's Focus */}
      {isVisible('focus') && topAction && (
        <div className="animate-fade stagger-1" style={{ marginBottom: '12px', background: 'var(--accent)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <p style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)', marginBottom: '8px', textTransform: 'uppercase' }}>
            This week's focus
          </p>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.95)', lineHeight: '1.5', margin: '0 0 6px', fontWeight: '500' }}>
            {topAction.title}
          </p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5', margin: '0 0 16px' }}>
            {topAction.description}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: '20px' }}>{topAction.timeframe}</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: '20px' }}>{topAction.impact} impact</span>
          </div>
          <button
            onClick={() => openChat('action_0', `Give me a step by step plan for: ${topAction.title}. ${topAction.description}`, topAction.title)}
            style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-sm)', padding: '9px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'center' }}>
            {chatRefs['action_0'] ? 'Continue plan →' : 'Make it happen →'}
          </button>
        </div>
      )}

      {/* Quick Stats */}
      {isVisible('stats') && (
        <div className="animate-fade stagger-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div className="card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => navigate('/plan')}>
            <p className="label" style={{ marginBottom: '4px' }}>Retire at</p>
            <p style={{ fontSize: '34px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 2px', letterSpacing: '-1px' }}>52</p>
            <p style={{ fontSize: '11px', color: 'var(--success)', margin: 0 }}>on track ✓</p>
          </div>
          <div className="card" style={{ padding: '16px' }}>
            <p className="label" style={{ marginBottom: '4px' }}>Savings rate</p>
            <p style={{ fontSize: '34px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 2px', letterSpacing: '-1px' }}>{Math.round(analysis.savingsRate)}%</p>
            <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{fmt(analysis.availableToSave)}/mo</p>
          </div>
        </div>
      )}

      {/* Watchlist */}
      {isVisible('watchlist') && stocks.length > 0 && (
        <div className="animate-fade stagger-3" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p className="label">Watchlist</p>
            <button className="btn-ghost" onClick={() => navigate('/grow')} style={{ fontSize: '11px', padding: '3px 8px' }}>View all →</button>
          </div>
          <div className="card" style={{ padding: '4px 0' }}>
            {stocks.map((stock, i) => {
              const isPos = stock.change >= 0
              return (
                <div key={stock.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: i < stocks.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
                  <span style={{ fontWeight: '500', fontSize: '14px', color: 'var(--sand-900)' }}>{stock.symbol}</span>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '14px', fontWeight: '500', margin: 0, color: 'var(--sand-900)' }}>${stock.price?.toFixed(2)}</p>
                    <p style={{ fontSize: '11px', color: isPos ? 'var(--success)' : 'var(--danger)', margin: 0 }}>{isPos ? '+' : ''}{parseFloat(stock.changePercent)?.toFixed(2)}%</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* News */}
      {isVisible('news') && news.length > 0 && (
        <div className="animate-fade stagger-4" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p className="label">Latest News</p>
            <button className="btn-ghost" onClick={() => navigate('/grow')} style={{ fontSize: '11px', padding: '3px 8px' }}>View all →</button>
          </div>
          <div className="card" style={{ padding: '4px 0' }}>
            {news.map((article, i) => (
              <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', gap: '12px', padding: '12px 18px', borderBottom: i < news.length - 1 ? '0.5px solid var(--sand-200)' : 'none', textDecoration: 'none' }}>
                {article.image && (
                  <img src={article.image} alt="" style={{ width: '52px', height: '40px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
                    onError={e => (e.currentTarget.style.display = 'none')} />
                )}
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 3px', lineHeight: '1.4' }}>{article.title}</p>
                  <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{article.source} · {timeAgo(article.publishedAt)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {miniDash && (
        <MiniDashboardSheet
          type={miniDash.type}
          analysis={miniDash.analysis}
          loading={miniDash.loading}
          onClose={() => setMiniDash(null)}
          profile={profile}
          netWorth={analysis.netWorth}
          totalAssets={analysis.totalAssets}
          totalLiabilities={analysis.totalLiabilities}
          availableToSave={analysis.availableToSave}
        />
      )}
    </div>
  )
}
