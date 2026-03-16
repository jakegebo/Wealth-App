import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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
  price: number
  change: number
  changePercent: string
  high: number
  low: number
  volume: number
}

const POPULAR_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B',
  'SPY', 'QQQ', 'VTI', 'VOO', 'BTC-USD', 'ETH-USD', 'JPM', 'V',
  'JNJ', 'WMT', 'XOM', 'PG', 'MA', 'UNH', 'HD', 'CVX', 'MRK'
]

const SECTIONS = [
  { key: 'markets', label: '📈 Markets' },
  { key: 'economy', label: '🏦 Economy' },
  { key: 'crypto', label: '₿ Crypto' },
  { key: 'realestate', label: '🏠 Real Estate' },
  { key: 'ai', label: '🤖 AI & Tech' },
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

function ArticleCard({ article }: { article: Article }) {
  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer"
      className="flex gap-4 p-4 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800 last:border-0 group">
      {article.image && (
        <img src={article.image} alt=""
          className="w-24 h-18 object-cover rounded-xl shrink-0 bg-zinc-800"
          style={{ height: '72px' }}
          onError={e => (e.currentTarget.style.display = 'none')} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-snug group-hover:text-emerald-400 transition-colors line-clamp-2">
          {article.title}
        </p>
        {article.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{article.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs font-medium text-emerald-400/70">{article.source}</span>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-gray-600">{timeAgo(article.publishedAt)}</span>
        </div>
      </div>
    </a>
  )
}

function StockDetail({ quote, onClose }: { quote: StockQuote; onClose: () => void }) {
  const [period, setPeriod] = useState('1M')
  const [chartData, setChartData] = useState<{ labels: string[]; prices: number[] } | null>(null)
  const [analysis, setAnalysis] = useState('')
  const [loadingChart, setLoadingChart] = useState(true)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)

  useEffect(() => {
    fetchChart()
    fetchAnalysis()
  }, [period])

  const fetchChart = async () => {
    setLoadingChart(true)
    try {
      const res = await fetch(`/api/stocks?symbol=${quote.symbol}&period=${period}`)
      const data = await res.json()
      setChartData(data)
    } catch (err) {
      console.error(err)
    }
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
      setAnalysis(data.analysis)
    } catch (err) {
      console.error(err)
    }
    setLoadingAnalysis(false)
  }

  const isPositive = quote.change >= 0
  const formatCurrency = (n: number) => `$${n.toFixed(2)}`

  const lineData = chartData ? {
    labels: chartData.labels,
    datasets: [{
      label: quote.symbol,
      data: chartData.prices,
      borderColor: isPositive ? '#34d399' : '#f87171',
      backgroundColor: isPositive ? '#34d39915' : '#f8717115',
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
        backgroundColor: '#18181b',
        borderColor: '#3f3f46',
        borderWidth: 1,
        titleColor: '#f3f4f6',
        bodyColor: '#9ca3af',
        padding: 10,
        callbacks: {
          label: (ctx: any) => ` $${ctx.parsed.y.toFixed(2)}`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#6b7280', maxTicksLimit: 6, font: { size: 10 } },
        grid: { color: '#27272a' }
      },
      y: {
        ticks: { color: '#6b7280', font: { size: 10 }, callback: (v: any) => `$${v}` },
        grid: { color: '#27272a' },
        position: 'right' as const
      }
    }
  }

  const formatAnalysis = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-bold text-white mt-3 mb-1">{line.slice(2, -2)}</p>
      }
      if (line.startsWith('- ')) {
        return (
          <div key={i} className="flex gap-2 text-sm text-gray-300 mt-1">
            <span className="text-emerald-400 shrink-0">→</span>
            <span>{line.slice(2)}</span>
          </div>
        )
      }
      if (line === '') return <div key={i} className="h-1" />
      return <p key={i} className="text-sm text-gray-300">{line}</p>
    })
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950 z-10">
          <div>
            <h2 className="text-xl font-bold">{quote.symbol}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-2xl font-bold">{formatCurrency(quote.price)}</span>
              <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{quote.change.toFixed(2)} ({parseFloat(quote.changePercent).toFixed(2)}%)
              </span>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Period selector */}
          <div className="flex gap-2">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  period === p ? 'bg-emerald-400 text-black' : 'bg-zinc-900 text-gray-400 hover:text-white'
                }`}>
                {p}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div style={{ height: '220px' }}>
            {loadingChart ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : lineData ? (
              <Line data={lineData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                Chart data unavailable
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 rounded-xl p-3">
              <p className="text-xs text-gray-500">Today's High</p>
              <p className="font-semibold text-sm">{formatCurrency(quote.high)}</p>
            </div>
            <div className="bg-zinc-900 rounded-xl p-3">
              <p className="text-xs text-gray-500">Today's Low</p>
              <p className="font-semibold text-sm">{formatCurrency(quote.low)}</p>
            </div>
            <div className="bg-zinc-900 rounded-xl p-3">
              <p className="text-xs text-gray-500">Volume</p>
              <p className="font-semibold text-sm">{(quote.volume / 1000000).toFixed(1)}M</p>
            </div>
          </div>

          {/* AI Analysis */}
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">AI Analysis</p>
            {loadingAnalysis ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-4 bg-zinc-800 rounded animate-pulse" />)}
              </div>
            ) : (
              <div>{formatAnalysis(analysis)}</div>
            )}
            <p className="text-xs text-gray-600 mt-3">Not financial advice. Do your own research.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function News() {
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [watchlist, setWatchlist] = useState<string[]>(['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA'])
  const [searchSymbol, setSearchSymbol] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeSection, setActiveSection] = useState('markets')
  const [loadingNews, setLoadingNews] = useState(true)
  const [loadingStocks, setLoadingStocks] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const filteredSuggestions = POPULAR_SYMBOLS.filter(s =>
    s.includes(searchSymbol.toUpperCase()) && !watchlist.includes(s) && searchSymbol.length > 0
  ).slice(0, 6)

  useEffect(() => {
    fetchStocks()
  }, [watchlist])

  useEffect(() => {
    setArticles([])
    setPage(1)
    setHasMore(true)
    fetchNews(activeSection, 1, true)
  }, [activeSection])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
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
      if (reset) {
        setArticles(data.articles || [])
      } else {
        setArticles(prev => [...prev, ...(data.articles || [])])
      }
      setHasMore((data.articles || []).length === 10)
    } catch (err) {
      console.error(err)
    }
    setLoadingNews(false)
    setLoadingMore(false)
  }

  const loadMore = async () => {
    const nextPage = page + 1
    setPage(nextPage)
    await fetchNews(activeSection, nextPage)
  }

  const fetchStocks = async () => {
    if (watchlist.length === 0) return
    setLoadingStocks(true)
    try {
      const res = await fetch(`/api/stocks?symbols=${watchlist.join(',')}`)
      const data = await res.json()
      setStocks(data.quotes || [])
    } catch (err) {
      console.error(err)
    }
    setLoadingStocks(false)
  }

  const addToWatchlist = (symbol: string) => {
    const upper = symbol.toUpperCase().trim()
    if (!upper || watchlist.includes(upper)) return
    setWatchlist(prev => [...prev, upper])
    setSearchSymbol('')
    setShowDropdown(false)
  }

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol))
    setStocks(prev => prev.filter(s => s.symbol !== symbol))
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-zinc-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-white transition-colors">←</button>
            <div>
              <h1 className="font-semibold">Financial News</h1>
              <p className="text-xs text-gray-500">Live updates across markets</p>
            </div>
          </div>
          <button onClick={() => fetchNews(activeSection, 1, true)}
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-900">
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Stock Watchlist */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Watchlist</h2>
            <div ref={searchRef} className="relative flex gap-2">
              <div className="relative">
                <input
                  value={searchSymbol}
                  onChange={e => {
                    setSearchSymbol(e.target.value.toUpperCase())
                    setShowDropdown(true)
                  }}
                  onKeyDown={e => e.key === 'Enter' && addToWatchlist(searchSymbol)}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search symbol..."
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-emerald-400 w-36"
                />
                {showDropdown && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 w-48 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden z-20 shadow-xl">
                    {filteredSuggestions.map(sym => (
                      <button key={sym} onClick={() => addToWatchlist(sym)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-zinc-800 hover:text-emerald-400 transition-colors">
                        {sym}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => addToWatchlist(searchSymbol)}
                className="bg-emerald-400 text-black text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-emerald-300 transition-colors">
                Add
              </button>
            </div>
          </div>

          {loadingStocks ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 min-w-[140px] animate-pulse">
                  <div className="h-4 bg-zinc-800 rounded mb-2 w-16" />
                  <div className="h-6 bg-zinc-800 rounded w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {stocks.map(quote => {
                const isPos = quote.change >= 0
                return (
                  <div key={quote.symbol} className="relative group shrink-0">
                    <button
                      onClick={() => setSelectedStock(quote)}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 min-w-[140px] text-left hover:border-emerald-400/50 transition-colors w-full"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-sm">{quote.symbol}</p>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          isPos ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
                        }`}>
                          {isPos ? '+' : ''}{parseFloat(quote.changePercent).toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-xl font-bold">${quote.price.toFixed(2)}</p>
                      <p className={`text-xs mt-0.5 ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPos ? '+' : ''}{quote.change.toFixed(2)} today
                      </p>
                    </button>
                    <button
                      onClick={() => removeFromWatchlist(quote.symbol)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-700 rounded-full text-gray-400 text-xs hidden group-hover:flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors z-10">
                      ×
                    </button>
                  </div>
                )
              })}
              {stocks.length === 0 && (
                <p className="text-gray-500 text-sm py-4">Search and add symbols to your watchlist</p>
              )}
            </div>
          )}
        </div>

        {/* News */}
        <div>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {SECTIONS.map(section => (
              <button key={section.key} onClick={() => setActiveSection(section.key)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  activeSection === section.key
                    ? 'bg-emerald-400 text-black'
                    : 'bg-zinc-900 text-gray-400 hover:text-white border border-zinc-800'
                }`}>
                {section.label}
              </button>
            ))}
          </div>

          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            {loadingNews ? (
              <div className="space-y-1 p-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex gap-3 animate-pulse py-3">
                    <div className="w-24 bg-zinc-800 rounded-xl shrink-0" style={{ height: '72px' }} />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-zinc-800 rounded w-full" />
                      <div className="h-4 bg-zinc-800 rounded w-3/4" />
                      <div className="h-3 bg-zinc-800 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : articles.length > 0 ? (
              <>
                {articles.map((article, i) => <ArticleCard key={i} article={article} />)}
                {hasMore && (
                  <div className="p-4 text-center border-t border-zinc-800">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="bg-zinc-800 hover:bg-zinc-700 text-gray-300 text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading...' : 'Load More Articles'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-gray-500 text-sm">
                No articles found. Try refreshing.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockDetail quote={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  )
}
