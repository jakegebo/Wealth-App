import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler)

interface Analysis {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  monthlyIncome: number
  monthlyExpenses: number
  availableToSave: number
  savingsRate: number
  budgetHealth: string
  overallSummary: string
  nextActions: { priority: number; title: string; description: string; impact: string; timeframe: string }[]
  goals: { name: string; targetAmount: number; currentAmount: number; percentage: number; monthlyNeeded: number; feasibility: string }[]
  debts: { name: string; balance: number; interestRate: number; recommendedPayment: number; monthsToPayoff: number; strategy: string }[]
  incomeIdeas: string[]
}

interface Article {
  title: string
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
}

const CHART_COLORS = ['#34d399', '#60a5fa', '#f59e0b', '#f87171', '#a78bfa', '#fb7185']

function RingProgress({ value, size = 80, color = '#34d399' }: { value: number; size?: number; color?: string }) {
  const strokeWidth = 7
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#27272a" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{Math.round(value)}%</span>
      </div>
    </div>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [expandedAction, setExpandedAction] = useState<number | null>(null)
  const [chatRefs, setChatRefs] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [newsArticles, setNewsArticles] = useState<Article[]>([])
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [watchlist, setWatchlist] = useState<string[]>([])

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (!data) { navigate('/onboarding'); return }

    setProfile(data.profile_data)
    setChatRefs(data.chat_refs || {})

    const wl = data.watchlist || ['SPY', 'QQQ', 'AAPL']
    setWatchlist(wl)
    fetchStocks(wl)
    fetchNews()

    if (data.analysis) {
      setAnalysis(data.analysis)
      setLoading(false)
    } else {
      await runAnalysis(data.profile_data)
    }
  }

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news?category=markets&page=1')
      const data = await res.json()
      setNewsArticles((data.articles || []).slice(0, 4))
    } catch { }
  }

  const fetchStocks = async (symbols: string[]) => {
    try {
      const res = await fetch(`/api/stocks?symbols=${symbols.slice(0, 5).join(',')}`)
      const data = await res.json()
      setStocks(data.quotes || [])
    } catch { }
  }

  const runAnalysis = async (profileData: any) => {
    setAnalyzing(true)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })
      const result = await response.json()
      setAnalysis(result)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from('profiles').update({ analysis: result, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    } catch (err) { console.error(err) }
    setAnalyzing(false)
    setLoading(false)
  }

  const handleSignOut = async () => { await supabase.auth.signOut() }

  const openPersistentChat = async (key: string, prompt: string, topic: string, title: string) => {
    if (!userId) return
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data } = await supabase.from('chats').insert({ user_id: userId, title, topic, messages: [] }).select().single()
    if (data) {
      const newRefs = { ...chatRefs, [key]: data.id }
      setChatRefs(newRefs)
      await supabase.from('profiles').update({ chat_refs: newRefs }).eq('user_id', userId)
      navigate(`/chat/${data.id}`, { state: { prompt } })
    }
  }

  if (loading || analyzing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{analyzing ? 'Analyzing your finances...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  // Asset allocation chart data
  const assetData = profile?.assets?.length > 0 ? {
    labels: profile.assets.map((a: any) => a.name.slice(0, 15)),
    datasets: [{
      data: profile.assets.map((a: any) => a.value),
      backgroundColor: CHART_COLORS.map(c => c + 'cc'),
      borderColor: CHART_COLORS,
      borderWidth: 2
    }]
  } : null

  // Budget breakdown chart
  const budgetData = {
    labels: ['Expenses', 'Debt Payments', 'Available to Save'],
    datasets: [{
      data: [
        analysis.monthlyExpenses,
        analysis.monthlyIncome - analysis.monthlyExpenses - analysis.availableToSave,
        Math.max(0, analysis.availableToSave)
      ],
      backgroundColor: ['#f87171cc', '#fbbf24cc', '#34d399cc'],
      borderColor: ['#f87171', '#fbbf24', '#34d399'],
      borderWidth: 2
    }]
  }

  // Goals bar chart
  const goalsBarData = analysis.goals.length > 0 ? {
    labels: analysis.goals.map(g => g.name.slice(0, 15)),
    datasets: [
      {
        label: 'Saved',
        data: analysis.goals.map(g => g.currentAmount),
        backgroundColor: '#34d39966',
        borderColor: '#34d399',
        borderWidth: 2,
        borderRadius: 6
      },
      {
        label: 'Target',
        data: analysis.goals.map(g => g.targetAmount),
        backgroundColor: '#6366f166',
        borderColor: '#6366f1',
        borderWidth: 2,
        borderRadius: 6
      }
    ]
  } : null

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { color: '#9ca3af', font: { size: 11 }, padding: 12, usePointStyle: true } },
      tooltip: {
        backgroundColor: '#18181b', borderColor: '#3f3f46', borderWidth: 1,
        callbacks: { label: (ctx: any) => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}` }
      }
    }
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#9ca3af', font: { size: 11 }, usePointStyle: true } },
      tooltip: {
        backgroundColor: '#18181b', borderColor: '#3f3f46', borderWidth: 1,
        callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` }
      }
    },
    scales: {
      x: { ticks: { color: '#6b7280' }, grid: { color: '#27272a' } },
      y: { ticks: { color: '#6b7280', callback: (v: any) => formatCurrency(v) }, grid: { color: '#27272a' } }
    }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-zinc-900 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-400 rounded-xl flex items-center justify-center">
              <span className="text-black font-bold text-sm">W</span>
            </div>
            <span className="font-semibold">WealthApp</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/news')} className="px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors">📰 News</button>
            <button onClick={() => navigate('/retirement')} className="px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors">🏖️ Retire</button>
            <button onClick={() => navigate('/chats')} className="bg-emerald-400 text-black font-semibold px-4 py-2 rounded-xl text-sm hover:bg-emerald-300 transition-colors">Ask AI</button>
            <button onClick={() => runAnalysis(profile)} className="px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors">↻</button>
            <button onClick={() => navigate('/onboarding')} className="px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors">Edit</button>
            <button onClick={handleSignOut} className="px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors">Sign out</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* Top row — Net Worth + Stock Ticker */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Net Worth */}
          <div className="lg:col-span-2 bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Net Worth</p>
                <h2 className="text-5xl font-bold text-emerald-400">{formatCurrency(analysis.netWorth)}</h2>
                <p className="text-gray-400 text-sm mt-3 leading-relaxed max-w-lg">{analysis.overallSummary}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Assets</p>
                    <p className="font-bold text-white text-lg">{formatCurrency(analysis.totalAssets)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Debts</p>
                    <p className="font-bold text-rose-400 text-lg">{formatCurrency(analysis.totalLiabilities)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Save/mo</p>
                    <p className="font-bold text-emerald-400 text-lg">{formatCurrency(analysis.availableToSave)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stock Ticker */}
          <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Watchlist</p>
              <button onClick={() => navigate('/news')} className="text-xs text-emerald-400 hover:underline">View all →</button>
            </div>
            <div className="space-y-3">
              {stocks.length > 0 ? stocks.slice(0, 5).map(stock => {
                const isPos = stock.change >= 0
                return (
                  <div key={stock.symbol} className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{stock.symbol}</span>
                    <div className="text-right">
                      <p className="text-sm font-bold">${stock.price?.toFixed(2)}</p>
                      <p className={`text-xs ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPos ? '+' : ''}{parseFloat(stock.changePercent)?.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                )
              }) : (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="flex justify-between animate-pulse">
                      <div className="h-4 bg-zinc-800 rounded w-16" />
                      <div className="h-4 bg-zinc-800 rounded w-20" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Asset Allocation */}
          {assetData && (
            <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Asset Allocation</p>
              <div style={{ height: '200px' }}>
                <Doughnut data={assetData} options={doughnutOptions} />
              </div>
            </div>
          )}

          {/* Budget Breakdown */}
          <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Monthly Budget</p>
            <div style={{ height: '200px' }}>
              <Doughnut data={budgetData} options={doughnutOptions} />
            </div>
          </div>

          {/* Goals Progress */}
          {goalsBarData && (
            <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Goals Progress</p>
              <div style={{ height: '200px' }}>
                <Bar data={goalsBarData} options={barOptions} />
              </div>
            </div>
          )}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left — Action Plan + Debt */}
          <div className="lg:col-span-2 space-y-4">

            {/* Action Plan */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Action Plan</h3>
              <div className="space-y-3">
                {analysis.nextActions.map((action, i) => (
                  <div key={i} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                    <button onClick={() => setExpandedAction(expandedAction === i ? null : i)}
                      className="w-full p-5 text-left hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-400/10 text-emerald-400 text-xs font-bold flex items-center justify-center">{action.priority}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${action.impact === 'high' ? 'bg-violet-400/10 text-violet-400' : action.impact === 'medium' ? 'bg-amber-400/10 text-amber-400' : 'bg-zinc-700 text-gray-400'}`}>
                          {action.impact} impact
                        </span>
                        <span className="text-xs text-gray-500 ml-auto">{action.timeframe}</span>
                        <span className="text-gray-500 text-xs ml-2">{expandedAction === i ? '▲' : '▼'}</span>
                      </div>
                      <p className="font-semibold text-sm">{action.title}</p>
                      <p className="text-gray-400 text-sm mt-1">{action.description}</p>
                    </button>
                    {expandedAction === i && (
                      <div className="px-5 pb-5 border-t border-zinc-800 pt-4 space-y-3">
                        {chatRefs[`action_${i}`] && (
                          <div className="bg-zinc-800/50 rounded-xl p-3">
                            <p className="text-xs text-emerald-400 font-semibold mb-1">Previously discussed</p>
                            <p className="text-xs text-gray-400">You have an existing plan. Click below to continue.</p>
                          </div>
                        )}
                        <button onClick={() => openPersistentChat(`action_${i}`, `Give me a detailed step by step plan for: ${action.title}. Be specific to my financial situation.`, 'general', action.title)}
                          className="w-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 text-sm font-semibold py-2.5 rounded-xl hover:bg-emerald-400/20 transition-colors">
                          {chatRefs[`action_${i}`] ? 'Continue plan →' : 'Get detailed steps →'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Debt Payoff */}
            {analysis.debts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Debt Payoff Plan</h3>
                <div className="space-y-3">
                  {analysis.debts.map((debt, i) => (
                    <div key={i} className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold">{debt.name}</p>
                        <span className="text-xs bg-rose-400/10 text-rose-400 px-2 py-0.5 rounded-full">{debt.interestRate}% APR</span>
                      </div>
                      <p className="text-gray-400 text-sm mb-3">{debt.strategy}</p>
                      <div className="flex gap-6 text-sm">
                        <div><p className="text-xs text-gray-500">Balance</p><p className="font-semibold">{formatCurrency(debt.balance)}</p></div>
                        <div><p className="text-xs text-gray-500">Pay monthly</p><p className="font-semibold text-emerald-400">{formatCurrency(debt.recommendedPayment)}</p></div>
                        <div><p className="text-xs text-gray-500">Paid off in</p><p className="font-semibold">{debt.monthsToPayoff}mo</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* News Preview */}
            {newsArticles.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Latest News</h3>
                  <button onClick={() => navigate('/news')} className="text-xs text-emerald-400 hover:underline">View all →</button>
                </div>
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                  {newsArticles.map((article, i) => (
                    <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                      className="flex gap-3 p-4 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800 last:border-0 group">
                      {article.image && (
                        <img src={article.image} alt="" className="w-16 h-12 object-cover rounded-lg shrink-0 bg-zinc-800"
                          onError={e => (e.currentTarget.style.display = 'none')} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">{article.title}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-emerald-400/70">{article.source}</span>
                          <span className="text-gray-700">·</span>
                          <span className="text-xs text-gray-600">{timeAgo(article.publishedAt)}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — Goals + AI + Income */}
          <div className="space-y-4">

            {/* Ask AI */}
            <button onClick={() => navigate('/chats')}
              className="w-full bg-zinc-900 border border-emerald-400/30 rounded-2xl p-4 flex items-center gap-3 hover:border-emerald-400 transition-colors text-left">
              <div className="w-10 h-10 bg-emerald-400/10 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-emerald-400 font-bold text-sm">AI</span>
              </div>
              <div>
                <p className="font-semibold text-sm">Ask your advisor</p>
                <p className="text-xs text-gray-400">Honest advice on your finances</p>
              </div>
              <span className="ml-auto text-gray-400">→</span>
            </button>

            {/* Goals */}
            {analysis.goals.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Goals</h3>
                <div className="space-y-3">
                  {analysis.goals.map((goal, i) => (
                    <div key={i} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                      <div className="p-4 flex items-center gap-4">
                        <RingProgress value={goal.percentage} size={70}
                          color={goal.feasibility === 'achievable' ? '#34d399' : goal.feasibility === 'stretch' ? '#fbbf24' : '#f87171'} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{goal.name}</p>
                          <p className="text-xs text-gray-400">{formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}</p>
                          {goal.monthlyNeeded > 0 && <p className="text-xs text-emerald-400 mt-1">+{formatCurrency(goal.monthlyNeeded)}/mo</p>}
                        </div>
                      </div>
                      <div className="px-4 pb-3 border-t border-zinc-800 pt-2">
                        <button onClick={() => openPersistentChat(`goal_${i}`, `Give me a detailed plan for my "${goal.name}" goal. I have ${formatCurrency(goal.currentAmount)} saved toward a ${formatCurrency(goal.targetAmount)} target.`, 'general', `${goal.name} Plan`)}
                          className="text-xs text-emerald-400 hover:underline">
                          {chatRefs[`goal_${i}`] ? 'Continue plan →' : 'Get advice →'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Income Ideas */}
            {analysis.incomeIdeas.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Income Ideas</h3>
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                  {analysis.incomeIdeas.map((idea, i) => (
                    <button key={i}
                      onClick={() => openPersistentChat(`income_${i}`, `Tell me more about this income idea: "${idea}". Include average income potential, realistic timeline, what skills I need, and whether this is passive or active income.`, 'general', idea.slice(0, 40))}
                      className="w-full flex items-start gap-3 p-4 text-left hover:bg-zinc-800/50 transition-colors border-b border-zinc-800 last:border-0">
                      <span className="text-emerald-400 mt-0.5 shrink-0">→</span>
                      <p className="text-gray-300 text-sm">{idea}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
