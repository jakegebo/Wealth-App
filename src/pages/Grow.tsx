import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'

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

const NEWS_SECTIONS = [
  { key: 'markets', label: 'Markets' },
  { key: 'economy', label: 'Economy' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'realestate', label: 'Real Estate' },
  { key: 'ai', label: 'AI & Tech' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function Grow() {
  const navigate = useNavigate()
  const { preferences } = useTheme()
  const [profile, setProfile] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [ideas, setIdeas] = useState<string[]>([])
  const [savedIdeas, setSavedIdeas] = useState<string[]>([])
  const [chatRefs, setChatRefs] = useState<Record<string, string>>({})
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [articles, setArticles] = useState<Article[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [activeSection, setActiveSection] = useState('markets')
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [searching, setSearching] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const searchTimeout = { current: 0 as any }

  useEffect(() => { loadData() }, [])
  useEffect(() => { fetchNews(activeSection, 1, true); setPage(1) }, [activeSection])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (data) {
      setProfile(data.profile_data)
      setSavedIdeas(data.saved_income_ideas || [])
      setChatRefs(data.chat_refs || {})
      const wl = data.watchlist || ['SPY', 'QQQ', 'AAPL', 'MSFT']
      setWatchlist(wl)
      fetchStocks(wl)
      if (data.income_ideas?.length > 0) setIdeas(data.income_ideas)
      else generateIdeas(data.profile_data)
    }
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
      setIdeas(data.ideas || [])
      if (userId) await supabase.from('profiles').update({ income_ideas: data.ideas }).eq('user_id', userId)
    } catch { }
    setLoadingIdeas(false)
  }

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
    } catch { }
    setLoadingNews(false)
    setLoadingMore(false)
  }

  const fetchStocks = async (symbols: string[]) => {
    try {
      const res = await fetch(`/api/stocks?symbols=${symbols.join(',')}`)
      const data = await res.json()
      setStocks(data.quotes || [])
    } catch { }
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
    setWatchlist(newList)
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
    fetchStocks(newList)
    if (userId) await supabase.from('profiles').update({ watchlist: newList }).eq('user_id', userId)
  }

  const removeFromWatchlist = async (symbol: string) => {
    const newList = watchlist.filter(s => s !== symbol)
    setWatchlist(newList)
    setStocks(prev => prev.filter(s => s.symbol !== symbol))
    if (userId) await supabase.from('profiles').update({ watchlist: newList }).eq('user_id', userId)
  }

  const toggleSaved = async (idea: string) => {
    const newSaved = savedIdeas.includes(idea) ? savedIdeas.filter(i => i !== idea) : [...savedIdeas, idea]
    setSavedIdeas(newSaved)
    if (userId) await supabase.from('profiles').update({ saved_income_ideas: newSaved }).eq('user_id', userId)
  }

  const openIdeaChat = async (idea: string) => {
    if (!userId) return
    const key = `money_idea_${idea.slice(0, 30)}`
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data } = await supabase.from('chats').insert({ user_id: userId, title: idea.slice(0, 40), topic: 'general', messages: [] }).select().single()
    if (data) {
      const newRefs = { ...chatRefs, [key]: data.id }
      setChatRefs(newRefs)
      await supabase.from('profiles').update({ chat_refs: newRefs }).eq('user_id', userId)
      navigate(`/chat/${data.id}`, { state: { prompt: `I want to explore this income idea: "${idea}". Give me: 1) Realistic income potential, 2) Time to first dollar, 3) Exact steps to start, 4) Skills/resources needed.` } })
    }
  }

  const isVisible = (id: string) => !preferences.hiddenSections.includes(id)

  return (
    <div className="page" style={{ paddingTop: '0' }}>

      {/* Header */}
      <div style={{ padding: '52px 0 20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 4px', letterSpacing: '-0.5px' }}>Grow</h1>
        <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: 0 }}>Income ideas, markets & news</p>
      </div>

      {/* Watchlist */}
      {isVisible('watchlist') && (
        <div className="animate-fade" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p className="label">Watchlist</p>
            <button className="btn-ghost" onClick={() => setShowSearch(!showSearch)} style={{ fontSize: '11px', padding: '3px 8px' }}>
              {showSearch ? 'Done' : '+ Add'}
            </button>
          </div>

          {showSearch && (
            <div className="animate-fade" style={{ marginBottom: '10px', position: 'relative' }}>
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
              return (
                <div key={stock.symbol} style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={() => navigate('/news')}
                    style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', padding: '12px 16px', minWidth: '120px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 4px' }}>{stock.symbol}</p>
                    <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 2px' }}>${stock.price?.toFixed(2)}</p>
                    <p style={{ fontSize: '11px', color: isPos ? 'var(--success)' : 'var(--danger)', margin: 0 }}>{isPos ? '+' : ''}{parseFloat(stock.changePercent)?.toFixed(2)}%</p>
                  </button>
                  <button
                    onClick={() => removeFromWatchlist(stock.symbol)}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', background: 'var(--sand-400)', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '10px', cursor: 'pointer', display: 'none', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget.style.display = 'flex')}
                    className="remove-btn">
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
              [1,2,3].map(i => (
                <div key={i} style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', height: '60px', animation: 'pulse 1.5s infinite' }} />
              ))
            ) : ideas.slice(0, 4).map((idea, i) => (
              <div key={i} className="card" style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', animationDelay: `${i * 0.05}s` }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', color: 'var(--sand-900)', margin: 0, lineHeight: '1.4' }}>{idea}</p>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => toggleSaved(idea)}
                    style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: savedIdeas.includes(idea) ? 'rgba(200,148,58,0.1)' : 'var(--sand-200)', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                    {savedIdeas.includes(idea) ? '⭐' : '☆'}
                  </button>
                  <button
                    onClick={() => openIdeaChat(idea)}
                    style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>
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

        {loadingNews ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', height: '72px', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: '4px 0' }}>
            {articles.map((article, i) => (
              <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', gap: '12px', padding: '12px 16px', borderBottom: i < articles.length - 1 ? '0.5px solid var(--sand-200)' : 'none', textDecoration: 'none' }}>
                {article.image && (
                  <img src={article.image} alt="" style={{ width: '60px', height: '46px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, background: 'var(--sand-200)' }}
                    onError={e => (e.currentTarget.style.display = 'none')} />
                )}
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 4px', lineHeight: '1.4' }}>{article.title}</p>
                  <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{article.source} · {timeAgo(article.publishedAt)}</p>
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
        )}
      </div>

    </div>
  )
}
