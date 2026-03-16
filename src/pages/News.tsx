import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Article {
  title: string
  description: string
  url: string
  image: string
  source: string
  publishedAt: string
}

interface NewsData {
  markets: Article[]
  crypto: Article[]
  realestate: Article[]
  ai: Article[]
  economy: Article[]
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

const DEFAULT_WATCHLIST = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'BTC-USD']

const SECTIONS = [
  { key: 'markets', label: '📈 Markets', description: 'Stock market & investing' },
  { key: 'economy', label: '🏦 Economy', description: 'Interest rates & Fed' },
  { key: 'crypto', label: '₿ Crypto', description: 'Crypto & digital assets' },
  { key: 'realestate', label: '🏠 Real Estate', description: 'Housing & mortgage' },
  { key: 'ai', label: '🤖 AI & Tech', description: 'AI opportunities & updates' },
]

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
      className="flex gap-3 p-4 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800 last:border-0 group">
      {article.image && (
        <img
          src={article.image}
          alt=""
          className="w-20 h-16 object-cover rounded-xl shrink-0 bg-zinc-800"
          onError={e => (e.currentTarget.style.display = 'none')}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-snug group-hover:text-emerald-400 transition-colors line-clamp-2">
          {article.title}
        </p>
        {article.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{article.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-gray-600">{article.source}</span>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-gray-600">{timeAgo(article.publishedAt)}</span>
        </div>
      </div>
    </a>
  )
}

function StockTicker({ quote }: { quote: StockQuote }) {
  const isPositive = quote.change >= 0
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 min-w-[140px]">
      <div className="flex items-center justify-between mb-1">
        <p className="font-bold text-sm">{quote.symbol}</p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          isPositive ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
        }`}>
          {isPositive ? '+' : ''}{parseFloat(quote.changePercent).toFixed(2)}%
        </span>
      </div>
      <p className="text-xl font-bold">${quote.price.toFixed(2)}</p>
      <p className={`text-xs mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{quote.change.toFixed(2)} today
      </p>
    </div>
  )
}

export default function News() {
  const navigate = useNavigate()
  const [news, setNews] = useState<NewsData | null>(null)
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST)
  const [searchSymbol, setSearchSymbol] = useState('')
  const [activeSection, setActiveSection] = useState('markets')
  const [loadingNews, setLoadingNews] = useState(true)
  const [loadingStocks, setLoadingStocks] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    loadProfile()
    fetchNews()
  }, [])

  useEffect(() => {
    fetchStocks()
  }, [watchlist])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('profile_data').eq('user_id', user.id).single()
    if (data) setProfile(data.profile_data)
  }

  const fetchNews = async () => {
    setLoadingNews(true)
    try {
      const response = await fetch('/api/news')
      const data = await response.json()
      setNews(data)
    } catch (err) {
      console.error(err)
    }
    setLoadingNews(false)
  }

  const fetchStocks = async () => {
    if (watchlist.length === 0) return
    setLoadingStocks(true)
    try {
      const response = await fetch(`/api/stocks?symbols=${watchlist.join(',')}`)
      const data = await response.json()
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
  }

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol))
  }

  const activeArticles = news ? (news as any)[activeSection] as Article[] : []

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
          <button onClick={fetchNews}
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
            <div className="flex gap-2">
              <input
                value={searchSymbol}
                onChange={e => setSearchSymbol(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && addToWatchlist(searchSymbol)}
                placeholder="Add symbol..."
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-emerald-400 w-32"
              />
              <button onClick={() => addToWatchlist(searchSymbol)}
                className="bg-emerald-400 text-black text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-emerald-300 transition-colors">
                Add
              </button>
            </div>
          </div>

          {loadingStocks ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 min-w-[140px] animate-pulse">
                  <div className="h-4 bg-zinc-800 rounded mb-2 w-16" />
                  <div className="h-6 bg-zinc-800 rounded w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {stocks.map(quote => (
                <div key={quote.symbol} className="relative group">
                  <StockTicker quote={quote} />
                  <button
                    onClick={() => removeFromWatchlist(quote.symbol)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-700 rounded-full text-gray-400 text-xs hidden group-hover:flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                    ×
                  </button>
                </div>
              ))}
              {stocks.length === 0 && (
                <p className="text-gray-500 text-sm py-4">Add symbols to your watchlist</p>
              )}
            </div>
          )}
        </div>

        {/* News Sections */}
        <div>
          {/* Section tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {SECTIONS.map(section => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  activeSection === section.key
                    ? 'bg-emerald-400 text-black'
                    : 'bg-zinc-900 text-gray-400 hover:text-white border border-zinc-800'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>

          {/* Articles */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            {loadingNews ? (
              <div className="space-y-1 p-4">
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-3 animate-pulse py-3">
                    <div className="w-20 h-16 bg-zinc-800 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-zinc-800 rounded w-full" />
                      <div className="h-4 bg-zinc-800 rounded w-3/4" />
                      <div className="h-3 bg-zinc-800 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activeArticles.length > 0 ? (
              activeArticles.map((article, i) => (
                <ArticleCard key={i} article={article} />
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 text-sm">
                No articles found. Try refreshing.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
