import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'

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

function CountUp({ value, prefix = '', duration = 1200 }: { value: number; prefix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef<number | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!value) return
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      const progress = Math.min((timestamp - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(display)
  return <span>{prefix}{formatted}</span>
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

export default function Home() {
  const navigate = useNavigate()
  const { preferences } = useTheme()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [news, setNews] = useState<Article[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [chatRefs, setChatRefs] = useState<Record<string, string>>({})
  const [firstName, setFirstName] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    setFirstName(user.email?.split('@')[0] || 'there')

    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (!data) { navigate('/onboarding'); return }

    setProfile(data.profile_data)
    setChatRefs(data.chat_refs || {})

    const wl = data.watchlist || ['SPY', 'QQQ', 'AAPL']
    fetchStocks(wl)
    fetchNews()

    if (data.analysis) {
      setAnalysis(data.analysis)
      setLoading(false)
    } else {
      runAnalysis(data.profile_data)
    }
  }

  const fetchStocks = async (symbols: string[]) => {
    try {
      const res = await fetch(`/api/stocks?symbols=${symbols.slice(0, 4).join(',')}`)
      const data = await res.json()
      setStocks(data.quotes || [])
    } catch { }
  }

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news?category=markets&page=1')
      const data = await res.json()
      setNews((data.articles || []).slice(0, 3))
    } catch { }
  }

  const runAnalysis = async (profileData: any) => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })
      const result = await res.json()
      setAnalysis(result)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from('profiles').update({ analysis: result, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    } catch { }
    setAnalyzing(false)
    setLoading(false)
  }

  const openChat = async (key: string, prompt: string, title: string) => {
    if (!userId) return
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data } = await supabase.from('chats').insert({ user_id: userId, title, topic: 'general', messages: [] }).select().single()
    if (data) {
      const newRefs = { ...chatRefs, [key]: data.id }
      setChatRefs(newRefs)
      await supabase.from('profiles').update({ chat_refs: newRefs }).eq('user_id', userId)
      navigate(`/chat/${data.id}`, { state: { prompt } })
    }
  }

  const isVisible = (id: string) => !preferences.hiddenSections.includes(id)

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  if (loading || analyzing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sand-100)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--sand-600)', fontSize: '14px' }}>{analyzing ? 'Analyzing your finances...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  const topAction = analysis.nextActions?.[0]

  return (
    <div className="page" style={{ paddingTop: '0' }}>

      {/* Header */}
      <div style={{ padding: '52px 0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 2px' }}>{greeting()}, {firstName}</p>
          <h1 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--sand-900)', margin: 0 }}>Here's your overview</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-ghost" onClick={() => navigate('/settings')} style={{ padding: '6px', borderRadius: '50%' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
          <button className="btn-ghost" onClick={() => runAnalysis(profile)} style={{ padding: '6px', borderRadius: '50%' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Net Worth Hero */}
      <div className="card animate-fade" style={{ marginBottom: '12px', padding: '24px' }}>
        <p className="label" style={{ marginBottom: '6px' }}>Net Worth</p>
        <div style={{ fontSize: '42px', fontWeight: '300', color: 'var(--sand-900)', letterSpacing: '-1.5px', lineHeight: '1', marginBottom: '16px' }}>
          <CountUp value={analysis.netWorth} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Assets', value: fmt(analysis.totalAssets), color: 'var(--sand-900)' },
            { label: 'Debts', value: fmt(analysis.totalLiabilities), color: 'var(--danger)' },
            { label: 'Save/mo', value: fmt(analysis.availableToSave), color: 'var(--success)' }
          ].map((item, i) => (
            <div key={i} className="card-muted" style={{ textAlign: 'center', padding: '10px 8px' }}>
              <p className="label" style={{ marginBottom: '3px', fontSize: '10px' }}>{item.label}</p>
              <p style={{ fontSize: '13px', fontWeight: '600', color: item.color, margin: 0 }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Today's Focus */}
      {isVisible('focus') && topAction && (
        <div className="animate-fade stagger-1" style={{ marginBottom: '12px', background: 'var(--accent)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <p style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>
            This week's focus
          </p>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.95)', lineHeight: '1.5', margin: '0 0 14px', fontWeight: '400' }}>
            {topAction.title} — {topAction.description}
          </p>
          <button
            onClick={() => openChat(`action_0`, `Give me a step by step plan for: ${topAction.title}`, topAction.title)}
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.25)', borderRadius: 'var(--radius-sm)', padding: '7px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
            {chatRefs['action_0'] ? 'Continue plan →' : 'Make it happen →'}
          </button>
        </div>
      )}

      {/* Quick Stats */}
      {isVisible('stats') && (
        <div className="animate-fade stagger-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div className="card" style={{ padding: '16px' }}
            onClick={() => navigate('/plan')} >
            <p className="label" style={{ marginBottom: '4px' }}>Retire at</p>
            <p style={{ fontSize: '32px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 2px', letterSpacing: '-1px' }}>52</p>
            <p style={{ fontSize: '11px', color: 'var(--success)', margin: 0 }}>on track ✓</p>
          </div>
          <div className="card" style={{ padding: '16px' }}>
            <p className="label" style={{ marginBottom: '4px' }}>Savings rate</p>
            <p style={{ fontSize: '32px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 2px', letterSpacing: '-1px' }}>{Math.round(analysis.savingsRate)}%</p>
            <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>${fmt(analysis.availableToSave)}/mo</p>
          </div>
        </div>
      )}

      {/* Watchlist */}
      {isVisible('watchlist') && stocks.length > 0 && (
        <div className="animate-fade stagger-3" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p className="label">Watchlist</p>
            <button className="btn-ghost" onClick={() => navigate('/news')} style={{ fontSize: '11px', padding: '3px 8px' }}>View all →</button>
          </div>
          <div className="card" style={{ padding: '4px 0' }}>
            {stocks.map((stock, i) => {
              const isPos = stock.change >= 0
              return (
                <div key={stock.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: i < stocks.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
                  <span style={{ fontWeight: '500', fontSize: '14px' }}>{stock.symbol}</span>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>${stock.price?.toFixed(2)}</p>
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
            <button className="btn-ghost" onClick={() => navigate('/news')} style={{ fontSize: '11px', padding: '3px 8px' }}>View all →</button>
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

    </div>
  )
}
