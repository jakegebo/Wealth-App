import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../contexts/ProfileContext'
import { formatAIText } from '../lib/formatAIText'
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

const SECTIONS = [
  { key: 'markets', label: 'Markets' },
  { key: 'economy', label: 'Economy' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'realestate', label: 'Real Estate' },
  { key: 'ai', label: 'AI & Tech' },
]

const PERIODS = ['1D', '1W', '1M', '1Y', '5Y', '10Y', 'ALL']

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function StockDetail({ quote, onClose }: { quote: StockQuote; onClose: () => void }) {
  const [period, setPeriod] = useState('1M')
  const [chartData, setChartData] = useState<{ labels: string[]; prices: number[] } | null>(null)
  const [analysis, setAnalysis] = useState('')
  const [loadingChart, setLoadingChart] = useState(true)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)
  const [minimizedAI, setMinimizedAI] = useState(false)

  useEffect(() => { fetchChart() }, [period])
  useEffect(() => { fetchAnalysis() }, [])

  const fetchChart = async () => {
    setLoadingChart(true)
    try {
      const res = await fetch(`/api/stocks?symbol=${quote.symbol}&period=${period}`)
      const data = await res.json()
      if (data.prices?.length > 0) setChartData(data)
      else setChartData(null)
    } catch (err) { console.error('Failed to fetch chart:', err); setChartData(null) }
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
    } catch (err) { console.error('Failed to fetch stock analysis:', err); setAnalysis('Analysis unavailable.') }
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

  const formatAnalysis = (text: string) =>
    formatAIText(text, { textColor: 'var(--sand-700)' })

  return (
    <div className="sheet-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.35)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="animate-slide" style={{ background: 'var(--sand-50)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '680px', minHeight: '75vh', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
          {/* Period selector */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--sand-200)', borderRadius: '12px', padding: '3px' }}>
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ flex: 1, padding: '6px 4px', borderRadius: '9px', border: 'none', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: period === p ? 'var(--sand-50)' : 'transparent', color: period === p ? 'var(--sand-900)' : 'var(--sand-500)' }}>
                {p}
              </button>
            ))}
          </div>

          {/* Chart */}
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

          {/* Stats */}
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

          {/* AI Analysis */}
          <div className="card-muted" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => setMinimizedAI(m => !m)}
              style={{ width: '100%', background: 'none', border: 'none', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}>
              <div style={{ width: '22px', height: '22px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
              </div>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-700)', margin: 0, flex: 1, textAlign: 'left' }}>Analysis</p>
              <span style={{ fontSize: '11px', color: 'var(--sand-400)', transition: 'transform 0.2s', display: 'inline-block', transform: minimizedAI ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            {!minimizedAI && (
              <div style={{ padding: '0 14px 12px' }}>
                {loadingAnalysis ? (
                  <div style={{ display: 'flex', gap: '5px', padding: '4px 0' }}>
                    {[0,150,300].map(d => <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                  </div>
                ) : <div>{formatAnalysis(analysis)}</div>}
                <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '10px 0 0' }}>Not financial advice.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function News() {
  const navigate = useNavigate()
  const { watchlist, loading: profileLoading, updateProfile } = useProfile()
  const [articles, setArticles] = useState<Article[]>([])
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const [activeSection, setActiveSection] = useState('markets')
  const [loadingNews, setLoadingNews] = useState(true)
  const [loadingStocks, setLoadingStocks] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimeout = useRef<any>(null)

  useEffect(() => {
    fetchNews(activeSection, 1, true)
  }, [])

  useEffect(() => {
    fetchNews(activeSection, 1, true)
    setPage(1)
  }, [activeSection])

  useEffect(() => {
    if (!profileLoading && watchlist.length > 0) fetchStocks()
  }, [profileLoading, watchlist])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchNews = async (category: string, pageNum: number, reset = false) => {
    if (reset) setLoadingNews(true)
    else setLoadingMore(true)
    try {
      const res = await fetch(`/api/news?category=${category}&page=${pageNum}`)
      const data = await res.json()
      const newArticles = data.articles || []
      if (reset) setArticles(newArticles)
      else setArticles(prev => [...prev, ...newArticles])
      setHasMore(newArticles.length >= 8)
    } catch (err) { console.error('Failed to fetch news:', err) }
    setLoadingNews(false)
    setLoadingMore(false)
  }

  const fetchStocks = async () => {
    setLoadingStocks(true)
    try {
      const res = await fetch(`/api/stocks?symbols=${watchlist.join(',')}`)
      const data = await res.json()
      setStocks(data.quotes || [])
    } catch (err) { console.error('Failed to fetch stocks:', err) }
    setLoadingStocks(false)
  }

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    setShowDropdown(true)
    clearTimeout(searchTimeout.current)
    if (!value.trim()) { setSearchResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/stocks?search=${encodeURIComponent(value)}`)
        const data = await res.json()
        setSearchResults(data.results || [])
      } catch (err) { console.error('Stock search failed:', err) }
      setSearching(false)
    }, 400)
  }

  const addToWatchlist = (symbol: string) => {
    const upper = symbol.toUpperCase().trim()
    if (!upper || watchlist.includes(upper)) return
    const newList = [...watchlist, upper]
    updateProfile({ watchlist: newList })
    setSearchQuery('')
    setSearchResults([])
    setShowDropdown(false)
  }

  const removeFromWatchlist = (symbol: string) => {
    const newList = watchlist.filter(s => s !== symbol)
    setStocks(prev => prev.filter(s => s.symbol !== symbol))
    updateProfile({ watchlist: newList })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand-100)' }}>
      <div style={{ background: 'var(--sand-50)', borderBottom: '0.5px solid var(--sand-300)', padding: '52px 20px 16px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate(-1)}
              style={{ background: 'var(--sand-200)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-700)', fontSize: '16px' }}>←</button>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>Markets & News</h1>
              <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0 }}>Live updates</p>
            </div>
          </div>
          <button onClick={() => fetchNews(activeSection, 1, true)}
            style={{ background: 'var(--sand-200)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-700)', fontSize: '14px' }}>↻</button>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Watchlist */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p className="label">Watchlist</p>
            <div ref={searchRef} style={{ position: 'relative', display: 'flex', gap: '6px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={e => e.key === 'Enter' && addToWatchlist(searchQuery)}
                  placeholder="Search symbol..."
                  style={{ width: '140px', fontSize: '12px', padding: '6px 12px', borderRadius: '20px' }}
                />
                {showDropdown && (searchResults.length > 0 || searching) && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, width: '240px', background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', overflow: 'hidden', zIndex: 20, marginTop: '4px', boxShadow: '0 8px 24px rgba(26,18,8,0.1)' }}>
                    {searching ? (
                      <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--sand-500)' }}>Searching...</div>
                    ) : searchResults.map(r => (
                      <button key={r.symbol} onClick={() => addToWatchlist(r.symbol)}
                        style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--sand-200)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '8px', fontFamily: 'inherit' }}>
                        <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--sand-900)' }}>{r.symbol}</span>
                        <span style={{ fontSize: '11px', color: 'var(--sand-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => addToWatchlist(searchQuery)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '20px' }}>Add</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {loadingStocks && stocks.length === 0 ? (
              ['SPY','QQQ','AAPL'].map(s => (
                <div key={s} style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', minWidth: '120px', height: '80px', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
              ))
            ) : stocks.map(quote => {
              const isPos = quote.change >= 0
              return (
                <div key={quote.symbol} style={{ position: 'relative', flexShrink: 0 }}>
                  <button onClick={() => setSelectedStock(quote)}
                    style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', padding: '12px 16px', minWidth: '120px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 4px' }}>{quote.symbol}</p>
                    <p style={{ fontSize: '17px', fontWeight: '400', color: 'var(--sand-900)', margin: '0 0 2px', letterSpacing: '-0.3px' }}>${quote.price?.toFixed(2)}</p>
                    <p style={{ fontSize: '11px', color: isPos ? 'var(--success)' : 'var(--danger)', margin: 0 }}>{isPos ? '+' : ''}{parseFloat(quote.changePercent)?.toFixed(2)}%</p>
                  </button>
                  <button onClick={() => removeFromWatchlist(quote.symbol)}
                    style={{ position: 'absolute', top: '-5px', right: '-5px', width: '18px', height: '18px', background: 'var(--sand-500)', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '10px', cursor: 'pointer', display: 'none', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.display = 'flex')}
                    onMouseLeave={e => (e.currentTarget.style.display = 'none')}>
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* News */}
        <div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                style={{ flexShrink: 0, padding: '7px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', border: 'none', transition: 'all 0.2s', background: activeSection === s.key ? 'var(--accent)' : 'var(--sand-200)', color: activeSection === s.key ? 'var(--sand-50)' : 'var(--sand-600)' }}>
                {s.label}
              </button>
            ))}
          </div>

          {loadingNews ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', height: '80px', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: '4px 0' }}>
              {articles.map((article, i) => (
                <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', gap: '12px', padding: '14px 18px', borderBottom: i < articles.length - 1 ? '0.5px solid var(--sand-200)' : 'none', textDecoration: 'none' }}>
                  {article.image && (
                    <img src={article.image} alt="" style={{ width: '64px', height: '50px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0, background: 'var(--sand-200)' }}
                      onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 4px', lineHeight: '1.4' }}>{article.title}</p>
                    {article.description && <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '0 0 4px', lineHeight: '1.4' }}>{article.description}</p>}
                    <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: 0 }}>{article.source} · {timeAgo(article.publishedAt)}</p>
                  </div>
                </a>
              ))}
              {hasMore && (
                <div style={{ padding: '12px 18px', textAlign: 'center', borderTop: '0.5px solid var(--sand-200)' }}>
                  <button onClick={() => { const next = page + 1; setPage(next); fetchNews(activeSection, next) }}
                    disabled={loadingMore} className="btn-ghost" style={{ fontSize: '12px' }}>
                    {loadingMore ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedStock && <StockDetail quote={selectedStock} onClose={() => setSelectedStock(null)} />}
    </div>
  )
}
