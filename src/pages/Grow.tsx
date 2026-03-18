import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { useProfile } from '../contexts/ProfileContext'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler)

interface Article {
  title: string
  description: string
  url: string
  image: string
  source: string
  publishedAt: string
}

interface StockQuote {
  symbol: string
  name?: string
  price: number
  change: number
  changePercent: string
  high: number
  low: number
  volume: number
}

interface SearchResult {
  symbol: string
  name: string
}

interface IdeaTag {
  label: string
  color: string
  bg: string
}

const PERIODS = ['1D', '1W', '1M', '1Y', '5Y', '10Y', 'ALL']
const SNAP_SYMBOLS = ['SPY', 'QQQ', 'BTC-USD', 'GLD']

const NEWS_SECTIONS = [
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'markets', label: 'Markets' },
  { key: 'economy', label: 'Economy' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'realestate', label: 'Real Estate' },
  { key: 'ai', label: 'AI & Tech' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function buildSparkPath(prices: number[], w: number, h: number): string {
  if (!prices || prices.length < 2) return ''
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return `M ${pts.join(' L ')}`
}

function inferIdeaTags(idea: string): IdeaTag[] {
  const lower = idea.toLowerCase()
  const tags: IdeaTag[] = []
  if (/passive|dividend|rental|royalt/.test(lower)) tags.push({ label: 'Passive', color: '#7a9e6e', bg: 'rgba(122,158,110,0.12)' })
  else if (/freelance|consult|teach|tutor|coach/.test(lower)) tags.push({ label: 'Active', color: '#c8943a', bg: 'rgba(200,148,58,0.12)' })
  else if (/sell|dropship|resell|product|store/.test(lower)) tags.push({ label: 'Business', color: 'var(--sand-700)', bg: 'var(--sand-200)' })
  if (/gig|task|today|immediate|same.day/.test(lower)) tags.push({ label: 'Start today', color: '#7a9e6e', bg: 'rgba(122,158,110,0.12)' })
  else if (/week|quick/.test(lower)) tags.push({ label: '< 1 week', color: '#c8943a', bg: 'rgba(200,148,58,0.12)' })
  const match = idea.match(/\$[\d,]+k?[\s\u2013\-]+\$?[\d,]+k?/i)
  if (match) tags.push({ label: match[0].replace(/\s+/g, ''), color: 'var(--sand-700)', bg: 'var(--sand-200)' })
  return tags.slice(0, 2)
}

function StockDetail({ quote, onClose }: { quote: StockQuote; onClose: () => void }) {
  const [period, setPeriod] = useState('1M')
  const [chartData, setChartData] = useState<{ labels: string[]; prices: number[] } | null>(null)
  const [analysis, setAnalysis] = useState('')
  const [loadingChart, setLoadingChart] = useState(true)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)

  useEffect(() => { fetchChart() }, [period])
  useEffect(() => { fetchAnalysis() }, [])

  const fetchChart = async () => {
    setLoadingChart(true)
    try {
      const res = await fetch(`/api/stocks?symbol=${quote.symbol}&period=${period}`)
      const data = await res.json()
      if (data.prices?.length > 0) setChartData(data)
      else setChartData(null)
    } catch { setChartData(null) }
    setLoadingChart(false)
  }

  const fetchAnalysis = async () => {
    setLoadingAnalysis(true)
    try {
      const res = await fetch('/api/stock-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quote)
      })
      const data = await res.json()
      setAnalysis(data.analysis || '')
    } catch { setAnalysis('Analysis unavailable.') }
    setLoadingAnalysis(false)
  }

  const isPositive = quote.change >= 0

  const lineData = chartData ? {
    labels: chartData.labels,
    datasets: [{
      label: quote.symbol,
      data: chartData.prices,
      borderColor: isPositive ? 'var(--success)' : 'var(--danger)',
      backgroundColor: isPositive ? 'rgba(122,158,110,0.08)' : 'rgba(192,57,43,0.06)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 2
    }]
  } : null

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#f2ede6',
        borderColor: '#ddd4c4',
        borderWidth: 1,
        titleColor: '#1a1208',
        bodyColor: '#9e8e7e',
        padding: 10,
        callbacks: { label: (ctx: any) => ` $${ctx.parsed.y?.toFixed(2)}` }
      }
    },
    scales: {
      x: { ticks: { color: '#9e8e7e', maxTicksLimit: 6, font: { size: 10 } }, grid: { color: '#ede8e3' } },
      y: { ticks: { color: '#9e8e7e', font: { size: 10 }, callback: (v: any) => `$${v}` }, grid: { color: '#ede8e3' }, position: 'right' as const }
    }
  }

  const formatAnalysis = (text: string) => text.split('\n').map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ fontWeight: '700', color: 'var(--sand-900)', margin: '10px 0 4px', fontSize: '14px' }}>{line.slice(2, -2)}</p>
    if (line.startsWith('- ')) return <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}><span style={{ color: 'var(--accent)', fontWeight: '700' }}>·</span><span style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--sand-700)' }}>{line.slice(2)}</span></div>
    if (line === '') return <div key={i} style={{ height: '4px' }} />
    return <p key={i} style={{ fontSize: '13px', lineHeight: '1.6', margin: '2px 0', color: 'var(--sand-700)' }}>{line}</p>
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="animate-slide" style={{ background: 'var(--sand-50)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--sand-300)', borderRadius: '2px' }} />
        </div>

        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--sand-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>{quote.symbol}</h2>
              {quote.name && <span style={{ fontSize: '12px', color: 'var(--sand-500)' }}>{quote.name}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '4px' }}>
              <span style={{ fontSize: '26px', fontWeight: '300', color: 'var(--sand-900)', letterSpacing: '-0.5px' }}>${quote.price?.toFixed(2)}</span>
              <span style={{ fontSize: '14px', fontWeight: '500', color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                {isPositive ? '+' : ''}{quote.change?.toFixed(2)} ({parseFloat(quote.changePercent)?.toFixed(2)}%)
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--sand-200)', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', color: 'var(--sand-700)' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--sand-200)', borderRadius: '12px', padding: '3px' }}>
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ flex: 1, padding: '6px 4px', borderRadius: '9px', border: 'none', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: period === p ? 'var(--sand-50)' : 'transparent', color: period === p ? 'var(--sand-900)' : 'var(--sand-500)' }}>
                {p}
              </button>
            ))}
          </div>

          <div style={{ height: '200px' }}>
            {loadingChart ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '24px', height: '24px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : lineData ? <Line data={lineData} options={chartOptions} /> : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--sand-500)', fontSize: '13px' }}>Chart unavailable</p>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {[
              { label: 'High', value: `$${quote.high?.toFixed(2)}` },
              { label: 'Low', value: `$${quote.low?.toFixed(2)}` },
              { label: 'Volume', value: quote.volume > 1000000 ? `${(quote.volume / 1000000).toFixed(1)}M` : `${(quote.volume / 1000).toFixed(0)}K` }
            ].map((item, i) => (
              <div key={i} className="card-muted" style={{ textAlign: 'center', padding: '10px' }}>
                <p className="label" style={{ marginBottom: '3px', fontSize: '9px' }}>{item.label}</p>
                <p style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="card-muted">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '22px', height: '22px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
              </div>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-700)', margin: 0 }}>Analysis</p>
            </div>
            {loadingAnalysis ? (
              <div style={{ display: 'flex', gap: '5px', padding: '4px 0' }}>
                {[0, 150, 300].map(d => <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
              </div>
            ) : <div>{formatAnalysis(analysis)}</div>}
            <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '10px 0 0' }}>Not financial advice.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Grow() {
  const navigate = useNavigate()
  const { preferences } = useTheme()
  const { userId, profileData: profile, chatRefs, watchlist, savedIdeas, incomeIdeas, loading: profileLoading, updateProfile } = useProfile()

  const [ideas, setIdeas] = useState<string[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [articles, setArticles] = useState<Article[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [activeSection, setActiveSection] = useState('portfolio')
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [searching, setSearching] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // New state
  const [marketSnap, setMarketSnap] = useState<StockQuote[]>([])
  const [snapLoaded, setSnapLoaded] = useState(false)
  const [snapCounted, setSnapCounted] = useState(false)
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({})
  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null)
  const [activeCardSymbol, setActiveCardSymbol] = useState<string | null>(null)
  const [showAllIdeas, setShowAllIdeas] = useState(false)
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null)

  const searchTimeout = useRef<any>(null)
  const longPressTimer = useRef<any>(null)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (profileLoading) return
    fetchStocks(watchlist)
    fetchSnap()
    if (incomeIdeas.length > 0) setIdeas(incomeIdeas)
    else if (profile) generateIdeas(profile)
  }, [profileLoading])

  useEffect(() => {
    const id = setInterval(fetchSnap, 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (snapLoaded && !snapCounted) setSnapCounted(true)
  }, [snapLoaded])

  useEffect(() => {
    if (!profileLoading && watchlist.length > 0) fetchStocks(watchlist)
  }, [watchlist])

  useEffect(() => { fetchNews(activeSection, 1, true); setPage(1) }, [activeSection])

  const fetchSnap = async () => {
    try {
      const res = await fetch(`/api/stocks?symbols=${SNAP_SYMBOLS.join(',')}`)
      const data = await res.json()
      setMarketSnap(data.quotes || [])
      setSnapLoaded(true)
    } catch { }
  }

  const generateIdeas = async (profileData?: any) => {
    const p = profileData || profile
    if (!p) return
    setLoadingIdeas(true)
    try {
      const res = await fetch('/api/money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_ideas', profile: p })
      })
      const data = await res.json()
      const newIdeas = data.ideas || []
      setIdeas(newIdeas)
      await updateProfile({ income_ideas: newIdeas })
    } catch { }
    setLoadingIdeas(false)
  }

  const fetchNews = async (category: string, pageNum: number, reset = false) => {
    if (reset) setLoadingNews(true)
    else setLoadingMore(true)
    try {
      let newArticles: Article[] = []
      if (category === 'portfolio') {
        const res = await fetch(`/api/news?category=markets&page=${pageNum}`)
        const data = await res.json()
        const all: Article[] = data.articles || []
        if (watchlist.length > 0) {
          newArticles = all.filter(a =>
            watchlist.some(sym =>
              a.title?.toLowerCase().includes(sym.toLowerCase()) ||
              a.description?.toLowerCase().includes(sym.toLowerCase())
            )
          )
        } else {
          newArticles = []
        }
      } else {
        const res = await fetch(`/api/news?category=${category}&page=${pageNum}`)
        const data = await res.json()
        newArticles = data.articles || []
      }
      if (reset) setArticles(newArticles)
      else setArticles(prev => [...prev, ...newArticles])
      setHasMore(newArticles.length >= 8)
    } catch { }
    setLoadingNews(false)
    setLoadingMore(false)
  }

  const fetchStocks = async (symbols: string[]) => {
    if (!symbols.length) return
    try {
      const res = await fetch(`/api/stocks?symbols=${symbols.join(',')}`)
      const data = await res.json()
      setStocks(data.quotes || [])
      fetchSparklines(symbols)
    } catch { }
  }

  const fetchSparklines = async (symbols: string[]) => {
    const entries = await Promise.all(
      symbols.map(async sym => {
        try {
          const res = await fetch(`/api/stocks?symbol=${sym}&period=1W`)
          const data = await res.json()
          return [sym, data.prices as number[]] as const
        } catch { return [sym, []] as const }
      })
    )
    setSparklines(Object.fromEntries(entries))
  }

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    clearTimeout(searchTimeout.current)
    if (!value.trim()) { setSearchResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/stocks?search=${encodeURIComponent(value)}`)
        const data = await res.json()
        setSearchResults(data.results || [])
      } catch { }
      setSearching(false)
    }, 400)
  }

  const addToWatchlist = async (symbol: string) => {
    const upper = symbol.toUpperCase().trim()
    if (!upper || watchlist.includes(upper)) return
    const newList = [...watchlist, upper]
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
    fetchStocks(newList)
    await updateProfile({ watchlist: newList })
  }

  const removeFromWatchlist = async (symbol: string) => {
    const newList = watchlist.filter(s => s !== symbol)
    setStocks(prev => prev.filter(s => s.symbol !== symbol))
    setActiveCardSymbol(null)
    await updateProfile({ watchlist: newList })
  }

  const toggleSaved = async (idea: string) => {
    const newSaved = savedIdeas.includes(idea) ? savedIdeas.filter(i => i !== idea) : [...savedIdeas, idea]
    await updateProfile({ saved_income_ideas: newSaved })
  }

  const openIdeaChat = async (idea: string) => {
    if (!userId) return
    const key = `money_idea_${idea.slice(0, 30)}`
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data } = await supabase.from('chats').insert({ user_id: userId, title: idea.slice(0, 40), topic: 'general', messages: [] }).select().single()
    if (data) {
      await updateProfile({ chat_refs: { ...chatRefs, [key]: data.id } })
      navigate(`/chat/${data.id}`, { state: { prompt: `I want to explore this income idea: "${idea}". Give me: 1) Realistic income potential, 2) Time to first dollar, 3) Exact steps to start, 4) Skills/resources needed.` } })
    }
  }

  const handleCardPointerDown = (e: React.PointerEvent, symbol: string) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
    longPressTimer.current = setTimeout(() => setActiveCardSymbol(symbol), 500)
  }

  const handleCardPointerMove = (e: React.PointerEvent) => {
    if (!pointerDownPos.current) return
    const dx = Math.abs(e.clientX - pointerDownPos.current.x)
    const dy = Math.abs(e.clientY - pointerDownPos.current.y)
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimer.current)
      pointerDownPos.current = null
    }
  }

  const handleCardPointerUp = () => {
    clearTimeout(longPressTimer.current)
    pointerDownPos.current = null
  }

  const isVisible = (id: string) => !preferences.hiddenSections.includes(id)

  const visibleIdeas = ideas.slice(0, showAllIdeas ? ideas.length : 4)

  return (
    <div className="page" style={{ paddingTop: '0' }} onClick={() => setActiveCardSymbol(null)}>

      {/* Header */}
      <div style={{ padding: '52px 0 16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 4px', letterSpacing: '-0.5px' }}>Grow</h1>
        <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: 0 }}>Income ideas, markets & news</p>
      </div>

      {/* Market Snapshot Bar */}
      <div style={{ margin: '0 -16px', borderBottom: '0.5px solid var(--sand-200)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', overflowX: 'auto', padding: '0 16px 12px' }}>
          {marketSnap.length === 0 ? (
            SNAP_SYMBOLS.map(sym => (
              <div key={sym} style={{ flexShrink: 0, padding: '8px 16px', borderRight: '0.5px solid var(--sand-200)' }}>
                <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--sand-500)', margin: '0 0 4px' }}>{sym}</p>
                <div style={{ width: '48px', height: '13px', background: 'var(--sand-200)', borderRadius: '4px', marginBottom: '4px', animation: 'pulse 1.5s infinite' }} />
                <div style={{ width: '32px', height: '10px', background: 'var(--sand-200)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
              </div>
            ))
          ) : marketSnap.map((s, i) => {
            const isPos = s.change >= 0
            return (
              <div key={s.symbol} style={{ flexShrink: 0, padding: '8px 16px', borderRight: '0.5px solid var(--sand-200)' }}>
                <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--sand-500)', margin: '0 0 2px', letterSpacing: '0.04em' }}>{s.symbol}</p>
                <p style={{
                  fontSize: '14px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 1px',
                  animation: snapCounted ? 'none' : 'countUp 0.35s ease forwards',
                  animationDelay: snapCounted ? '0s' : `${i * 0.08}s`
                }}>
                  ${s.price?.toFixed(2)}
                </p>
                <p style={{ fontSize: '10px', fontWeight: '500', color: isPos ? 'var(--success)' : 'var(--danger)', margin: 0 }}>
                  {isPos ? '+' : ''}{parseFloat(s.changePercent)?.toFixed(2)}%
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Watchlist */}
      {isVisible('watchlist') && (
        <div className="animate-fade" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p className="label">Watchlist</p>
            <button className="btn-ghost" onClick={e => { e.stopPropagation(); setShowSearch(!showSearch) }} style={{ fontSize: '11px', padding: '3px 8px' }}>
              {showSearch ? 'Done' : '+ Add'}
            </button>
          </div>

          {showSearch && (
            <div className="animate-fade" style={{ marginBottom: '10px', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <input
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search any stock, ETF, fund..."
                autoFocus
              />
              {(searchResults.length > 0 || searching) && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', overflow: 'hidden', zIndex: 20, marginTop: '4px' }}>
                  {searching ? (
                    <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--sand-500)' }}>Searching...</div>
                  ) : searchResults.map(r => (
                    <button key={r.symbol} onClick={() => addToWatchlist(r.symbol)}
                      style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--sand-200)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'inherit' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--sand-900)' }}>{r.symbol}</span>
                      <span style={{ fontSize: '12px', color: 'var(--sand-500)', maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {stocks.map(stock => {
              const isPos = stock.change >= 0
              const isActive = activeCardSymbol === stock.symbol
              return (
                <div
                  key={stock.symbol}
                  style={{ position: 'relative', flexShrink: 0 }}
                  onMouseEnter={() => setActiveCardSymbol(stock.symbol)}
                  onMouseLeave={() => setActiveCardSymbol(null)}
                  onPointerDown={e => handleCardPointerDown(e, stock.symbol)}
                  onPointerMove={handleCardPointerMove}
                  onPointerUp={handleCardPointerUp}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => setSelectedStock(stock)}
                    style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', padding: '12px 14px', minWidth: '120px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'transform var(--transition)', transform: isActive ? 'scale(0.97)' : 'scale(1)' }}>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 4px' }}>{stock.symbol}</p>
                    <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 2px' }}>${stock.price?.toFixed(2)}</p>
                    <p style={{ fontSize: '11px', color: isPos ? 'var(--success)' : 'var(--danger)', margin: 0 }}>{isPos ? '+' : ''}{parseFloat(stock.changePercent)?.toFixed(2)}%</p>
                    {sparklines[stock.symbol]?.length > 1 && (
                      <svg width="90" height="20" style={{ display: 'block', marginTop: '8px', overflow: 'visible' }}>
                        <path
                          d={buildSparkPath(sparklines[stock.symbol], 90, 18)}
                          fill="none"
                          stroke={isPos ? 'var(--success)' : 'var(--danger)'}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); removeFromWatchlist(stock.symbol) }}
                    style={{
                      position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px',
                      background: 'var(--sand-700)', color: '#fff', border: 'none', borderRadius: '50%',
                      fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'inherit', opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none',
                      transition: 'opacity 0.15s'
                    }}>
                    ×
                  </button>
                </div>
              )
            })}
            {stocks.length === 0 && (
              <p style={{ color: 'var(--sand-500)', fontSize: '13px', padding: '12px 0' }}>Add stocks to your watchlist</p>
            )}
          </div>
        </div>
      )}

      {/* Income Ideas */}
      {isVisible('income') && (
        <div className="animate-fade stagger-2" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p className="label">Income Ideas</p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn-ghost" onClick={() => navigate('/money')} style={{ fontSize: '11px', padding: '3px 8px' }}>Saved ({savedIdeas.length})</button>
              <button className="btn-ghost" onClick={() => generateIdeas()} disabled={loadingIdeas} style={{ fontSize: '11px', padding: '3px 8px' }}>
                {loadingIdeas ? '...' : '↻ Refresh'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {loadingIdeas ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', height: '72px', animation: 'pulse 1.5s infinite' }} />
              ))
            ) : visibleIdeas.map((idea, i) => {
              const isExpanded = expandedIdea === idea
              const tags = inferIdeaTags(idea)
              return (
                <div
                  key={i}
                  className="card"
                  onClick={() => setExpandedIdea(isExpanded ? null : idea)}
                  style={{ padding: '14px', cursor: 'pointer', animationDelay: `${i * 0.05}s`, transition: 'all var(--transition)', userSelect: 'none' }}
                >
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      {tags.map(tag => (
                        <span key={tag.label} style={{
                          fontSize: '9px', fontWeight: '700', color: tag.color,
                          background: tag.bg,
                          padding: '2px 7px', borderRadius: '20px', letterSpacing: '0.04em'
                        }}>
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <p style={{
                    fontSize: '13px', color: 'var(--sand-900)', margin: 0, lineHeight: '1.5',
                    display: isExpanded ? 'block' : '-webkit-box',
                    WebkitLineClamp: isExpanded ? undefined : 2,
                    WebkitBoxOrient: isExpanded ? undefined : 'vertical' as any,
                    overflow: isExpanded ? 'visible' : 'hidden'
                  }}>
                    {idea}
                  </p>
                  {isExpanded && (
                    <div className="animate-fade" style={{ display: 'flex', gap: '6px', marginTop: '12px' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => toggleSaved(idea)}
                        style={{
                          flex: 1, padding: '8px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: '600',
                          cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid var(--sand-300)',
                          background: savedIdeas.includes(idea) ? 'rgba(200,148,58,0.1)' : 'var(--sand-100)',
                          color: savedIdeas.includes(idea) ? 'var(--warning)' : 'var(--sand-700)'
                        }}>
                        {savedIdeas.includes(idea) ? '⭐ Saved' : '☆ Save'}
                      </button>
                      <button
                        onClick={() => openIdeaChat(idea)}
                        style={{
                          flex: 1, padding: '8px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: '600',
                          cursor: 'pointer', fontFamily: 'inherit',
                          background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', color: 'var(--accent)'
                        }}>
                        → Explore with AI
                      </button>
                    </div>
                  )}
                  <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: '6px 0 0', textAlign: 'right' }}>
                    {isExpanded ? '▲ less' : '▼ more'}
                  </p>
                </div>
              )
            })}
          </div>
          {ideas.length > 4 && (
            <button
              className="btn-ghost"
              onClick={() => setShowAllIdeas(!showAllIdeas)}
              style={{ width: '100%', marginTop: '6px', fontSize: '12px' }}>
              {showAllIdeas ? '▲ Show less' : `▼ Show ${ideas.length - 4} more idea${ideas.length - 4 > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}

      {/* News */}
      <div className="animate-fade stagger-3" style={{ marginBottom: '24px' }}>
        <p className="label" style={{ marginBottom: '10px' }}>News</p>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '10px' }}>
          {NEWS_SECTIONS.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              style={{ flexShrink: 0, padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', background: activeSection === s.key ? 'var(--accent)' : 'var(--sand-200)', color: activeSection === s.key ? 'var(--sand-50)' : 'var(--sand-600)', border: 'none', transition: 'all 0.2s' }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Portfolio tab empty states */}
        {activeSection === 'portfolio' && !loadingNews && watchlist.length === 0 && (
          <div className="card-muted animate-fade" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--sand-600)', margin: '0 0 10px' }}>Add stocks to your watchlist to see personalized news</p>
            <button className="btn-ghost" style={{ fontSize: '12px' }} onClick={() => setShowSearch(true)}>+ Add to watchlist</button>
          </div>
        )}

        {activeSection === 'portfolio' && !loadingNews && watchlist.length > 0 && articles.length === 0 && (
          <div className="card-muted animate-fade" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--sand-600)', margin: 0 }}>No news found for your holdings — try adding more tickers</p>
          </div>
        )}

        {loadingNews ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', height: '80px', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : articles.length > 0 ? (
          <div className="card" style={{ padding: '4px 0' }}>
            {articles.map((article, i) => (
              <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', gap: '12px', padding: '12px 16px', borderBottom: i < articles.length - 1 ? '0.5px solid var(--sand-200)' : 'none', textDecoration: 'none' }}>
                <div style={{ width: '60px', height: '52px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: 'var(--sand-200)' }}>
                  {article.image && (
                    <img
                      src={article.image}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.currentTarget.style.display = 'none' }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 3px', lineHeight: '1.4' }}>{article.title}</p>
                  {article.description && (
                    <p style={{
                      fontSize: '11px', color: 'var(--sand-600)', margin: '0 0 4px', lineHeight: '1.4',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden'
                    }}>
                      {article.description}
                    </p>
                  )}
                  <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: 0 }}>{article.source} · {timeAgo(article.publishedAt)}</p>
                </div>
              </a>
            ))}
            {hasMore && (
              <div style={{ padding: '12px 16px', textAlign: 'center' }}>
                <button
                  onClick={() => { const next = page + 1; setPage(next); fetchNews(activeSection, next) }}
                  disabled={loadingMore}
                  className="btn-ghost"
                  style={{ fontSize: '12px' }}>
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Stock detail sheet */}
      {selectedStock && <StockDetail quote={selectedStock} onClose={() => setSelectedStock(null)} />}

    </div>
  )
}
