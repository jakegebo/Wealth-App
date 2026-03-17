import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useProfile } from '../contexts/ProfileContext'
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

function RingProgress({ value, size = 80, color }: { value: number; size?: number; color: string }) {
  const strokeWidth = 7
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{Math.round(Math.min(100, value))}%</span>
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
  const { preferences, theme, accent } = useTheme()
  const { userId, profileData: profile, analysis, chatRefs, watchlist, hasProfile, loading: profileLoading, updateProfile } = useProfile()
  const [analyzing, setAnalyzing] = useState(false)
  const [expandedAction, setExpandedAction] = useState<number | null>(null)
  const [newsArticles, setNewsArticles] = useState<Article[]>([])
  const [stocks, setStocks] = useState<StockQuote[]>([])

  useEffect(() => {
    if (profileLoading) return
    if (!hasProfile) { navigate('/onboarding'); return }
    fetchStocks(watchlist)
    fetchNews()
    if (!analysis && profile) runAnalysis(profile)
  }, [profileLoading])

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news?category=markets&page=1')
      const data = await res.json()
      setNewsArticles((data.articles || []).slice(0, 4))
    } catch (err) { console.error('Failed to fetch news:', err) }
  }

  const fetchStocks = async (symbols: string[]) => {
    try {
      const res = await fetch(`/api/stocks?symbols=${symbols.slice(0, 5).join(',')}`)
      const data = await res.json()
      setStocks(data.quotes || [])
    } catch (err) { console.error('Failed to fetch stocks:', err) }
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
      await updateProfile({ analysis: result })
    } catch (err) { console.error('Analysis failed:', err) }
    setAnalyzing(false)
  }

  const handleSignOut = async () => { await supabase.auth.signOut() }

  const openPersistentChat = async (key: string, prompt: string, topic: string, title: string) => {
    if (!userId) return
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data } = await supabase.from('chats').insert({ user_id: userId, title, topic, messages: [] }).select().single()
    if (data) {
      await updateProfile({ chat_refs: { ...chatRefs, [key]: data.id } })
      navigate(`/chat/${data.id}`, { state: { prompt } })
    }
  }

  const isVisible = (id: string) => !preferences.hiddenSections.includes(id)

  if (profileLoading || analyzing) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: `2px solid ${accent.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: theme.textMuted }}>{analyzing ? 'Analyzing your finances...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  const s = {
    card: { background: theme.bgSecondary, border: `0.5px solid ${theme.border}`, borderRadius: '16px', padding: '20px' } as React.CSSProperties,
    cardSm: { background: theme.bgSecondary, border: `0.5px solid ${theme.border}`, borderRadius: '14px', padding: '16px' } as React.CSSProperties,
    label: { fontSize: '11px', color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.07em' },
    text: { color: theme.text },
    muted: { color: theme.textMuted },
    accent: { color: accent.primary },
    accentBtn: { background: accent.primary, color: accent.text, border: 'none', borderRadius: '12px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' } as React.CSSProperties,
    ghostBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: '13px', padding: '8px 12px', borderRadius: '10px' } as React.CSSProperties,
  }

  const assetData = profile?.assets?.length > 0 ? {
    labels: profile.assets.map((a: any) => a.name.slice(0, 15)),
    datasets: [{ data: profile.assets.map((a: any) => a.value), backgroundColor: CHART_COLORS.map(c => c + 'cc'), borderColor: CHART_COLORS, borderWidth: 2 }]
  } : null

  const budgetData = {
    labels: ['Expenses', 'Debt Payments', 'Available'],
    datasets: [{ data: [analysis.monthlyExpenses, analysis.monthlyIncome - analysis.monthlyExpenses - analysis.availableToSave, Math.max(0, analysis.availableToSave)], backgroundColor: ['#f87171cc', '#fbbf24cc', accent.primary + 'cc'], borderColor: ['#f87171', '#fbbf24', accent.primary], borderWidth: 2 }]
  }

  const goalsBarData = analysis.goals.length > 0 ? {
    labels: analysis.goals.map(g => g.name.slice(0, 15)),
    datasets: [
      { label: 'Saved', data: analysis.goals.map(g => Math.min(g.currentAmount, g.targetAmount)), backgroundColor: accent.primary + '66', borderColor: accent.primary, borderWidth: 2, borderRadius: 6 },
      { label: 'Target', data: analysis.goals.map(g => g.targetAmount), backgroundColor: '#6366f166', borderColor: '#6366f1', borderWidth: 2, borderRadius: 6 }
    ]
  } : null

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { color: theme.textMuted, font: { size: 11 }, padding: 10, usePointStyle: true } },
      tooltip: { backgroundColor: theme.bgTertiary, borderColor: theme.border, borderWidth: 1, callbacks: { label: (ctx: any) => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}` } }
    }
  }

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: theme.textMuted, font: { size: 11 }, usePointStyle: true } },
      tooltip: { backgroundColor: theme.bgTertiary, borderColor: theme.border, borderWidth: 1, callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } }
    },
    scales: {
      x: { ticks: { color: theme.textMuted }, grid: { color: theme.border } },
      y: { ticks: { color: theme.textMuted, callback: (v: any) => formatCurrency(v) }, grid: { color: theme.border } }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: theme.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ borderBottom: `0.5px solid ${theme.border}`, padding: '14px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', background: accent.primary, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: accent.text, fontWeight: '700', fontSize: '13px' }}>W</span>
            </div>
            <span style={{ color: theme.text, fontWeight: '500', fontSize: '15px' }}>WealthApp</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {[
              { label: '📰', path: '/news', title: 'News' },
              { label: '🏖️', path: '/retirement', title: 'Retire' },
              { label: '💰', path: '/money', title: 'Money' },
            ].map(item => (
              <button key={item.path} onClick={() => navigate(item.path)} style={s.ghostBtn} title={item.title}>
                {item.label} <span style={{ fontSize: '12px' }}>{item.title}</span>
              </button>
            ))}
            <button onClick={() => navigate('/chats')} style={s.accentBtn}>Ask AI</button>
            <button onClick={() => runAnalysis(profile)} style={s.ghostBtn} title="Refresh">↻</button>
            <button onClick={() => navigate('/settings')} style={s.ghostBtn} title="Settings">⚙</button>
            <button onClick={() => navigate('/onboarding')} style={s.ghostBtn}>Edit</button>
            <button onClick={handleSignOut} style={s.ghostBtn}>Sign out</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Net Worth — always visible */}
        {isVisible('networth') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px' }}>
            <div style={{ ...s.card, background: `linear-gradient(135deg, ${theme.bgSecondary}, ${theme.bgTertiary})` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ ...s.label, marginBottom: '4px' }}>Total Net Worth</p>
                  <h2 style={{ fontSize: '48px', fontWeight: '500', color: accent.primary, letterSpacing: '-1px', margin: '0 0 12px' }}>{formatCurrency(analysis.netWorth)}</h2>
                  <p style={{ color: theme.textMuted, fontSize: '13px', maxWidth: '500px', lineHeight: '1.6' }}>{analysis.overallSummary}</p>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div><p style={{ ...s.muted, fontSize: '10px' }}>Assets</p><p style={{ ...s.text, fontSize: '16px', fontWeight: '600' }}>{formatCurrency(analysis.totalAssets)}</p></div>
                  <div><p style={{ ...s.muted, fontSize: '10px' }}>Debts</p><p style={{ color: '#f87171', fontSize: '16px', fontWeight: '600' }}>{formatCurrency(analysis.totalLiabilities)}</p></div>
                  <div><p style={{ ...s.muted, fontSize: '10px' }}>Save/mo</p><p style={{ color: accent.primary, fontSize: '16px', fontWeight: '600' }}>{formatCurrency(analysis.availableToSave)}</p></div>
                </div>
              </div>
            </div>

            {/* Watchlist */}
            {isVisible('watchlist') && (
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <p style={s.label}>Watchlist</p>
                  <button onClick={() => navigate('/news')} style={{ ...s.ghostBtn, fontSize: '11px', color: accent.primary, padding: '2px 6px' }}>View all →</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {stocks.length > 0 ? stocks.slice(0, 5).map(stock => {
                    const isPos = stock.change >= 0
                    return (
                      <div key={stock.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ ...s.text, fontSize: '13px', fontWeight: '500' }}>{stock.symbol}</span>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ ...s.text, fontSize: '13px', fontWeight: '600', margin: 0 }}>${stock.price?.toFixed(2)}</p>
                          <p style={{ color: isPos ? '#34d399' : '#f87171', fontSize: '11px', margin: 0 }}>{isPos ? '+' : ''}{parseFloat(stock.changePercent)?.toFixed(2)}%</p>
                        </div>
                      </div>
                    )
                  }) : [1,2,3,4,5].map(i => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ height: '14px', background: theme.bgTertiary, borderRadius: '4px', width: '50px' }} />
                      <div style={{ height: '14px', background: theme.bgTertiary, borderRadius: '4px', width: '60px' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Charts */}
        {isVisible('charts') && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {assetData && (
              <div style={s.cardSm}>
                <p style={{ ...s.label, marginBottom: '12px' }}>Asset Allocation</p>
                <div style={{ height: '180px' }}><Doughnut data={assetData} options={doughnutOptions} /></div>
              </div>
            )}
            <div style={s.cardSm}>
              <p style={{ ...s.label, marginBottom: '12px' }}>Monthly Budget</p>
              <div style={{ height: '180px' }}><Doughnut data={budgetData} options={doughnutOptions} /></div>
            </div>
            {goalsBarData && (
              <div style={s.cardSm}>
                <p style={{ ...s.label, marginBottom: '12px' }}>Goals Progress</p>
                <div style={{ height: '180px' }}><Bar data={goalsBarData} options={barOptions} /></div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Action Plan */}
            {isVisible('actions') && (
              <div>
                <p style={{ ...s.label, marginBottom: '10px' }}>Action Plan</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analysis.nextActions.map((action, i) => (
                    <div key={i} style={{ background: theme.bgSecondary, border: `0.5px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                      <button onClick={() => setExpandedAction(expandedAction === i ? null : i)}
                        style={{ width: '100%', padding: '16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: accent.bg, color: accent.primary, fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `0.5px solid ${accent.border}` }}>{action.priority}</span>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: action.impact === 'high' ? 'rgba(167,139,250,0.1)' : action.impact === 'medium' ? 'rgba(251,191,36,0.1)' : theme.bgTertiary, color: action.impact === 'high' ? '#a78bfa' : action.impact === 'medium' ? '#fbbf24' : theme.textMuted }}>{action.impact} impact</span>
                          <span style={{ ...s.muted, fontSize: '11px', marginLeft: 'auto' }}>{action.timeframe}</span>
                          <span style={{ ...s.muted, fontSize: '11px' }}>{expandedAction === i ? '▲' : '▼'}</span>
                        </div>
                        <p style={{ ...s.text, fontSize: '14px', fontWeight: '600', margin: '0 0 4px' }}>{action.title}</p>
                        <p style={{ ...s.muted, fontSize: '13px', margin: 0 }}>{action.description}</p>
                      </button>
                      {expandedAction === i && (
                        <div style={{ padding: '0 16px 16px', borderTop: `0.5px solid ${theme.border}`, paddingTop: '12px' }}>
                          {chatRefs[`action_${i}`] && (
                            <div style={{ background: accent.bg, border: `0.5px solid ${accent.border}`, borderRadius: '10px', padding: '10px', marginBottom: '10px' }}>
                              <p style={{ ...s.accent, fontSize: '11px', fontWeight: '600', margin: '0 0 2px' }}>Previously discussed</p>
                              <p style={{ ...s.muted, fontSize: '11px', margin: 0 }}>You have an existing plan. Click below to continue.</p>
                            </div>
                          )}
                          <button onClick={() => openPersistentChat(`action_${i}`, `Give me a detailed step by step plan for: ${action.title}. Be specific to my financial situation.`, 'general', action.title)}
                            style={{ width: '100%', background: accent.bg, border: `0.5px solid ${accent.border}`, color: accent.primary, fontSize: '13px', fontWeight: '600', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}>
                            {chatRefs[`action_${i}`] ? 'Continue plan →' : 'Get detailed steps →'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debt */}
            {isVisible('debt') && analysis.debts.length > 0 && (
              <div>
                <p style={{ ...s.label, marginBottom: '10px' }}>Debt Payoff Plan</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analysis.debts.map((debt, i) => (
                    <div key={i} style={s.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <p style={{ ...s.text, fontWeight: '600', margin: 0 }}>{debt.name}</p>
                        <span style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: '11px', padding: '2px 8px', borderRadius: '20px' }}>{debt.interestRate}% APR</span>
                      </div>
                      <p style={{ ...s.muted, fontSize: '12px', marginBottom: '10px' }}>{debt.strategy}</p>
                      <div style={{ display: 'flex', gap: '20px' }}>
                        <div><p style={{ ...s.muted, fontSize: '10px' }}>Balance</p><p style={{ ...s.text, fontWeight: '600' }}>{formatCurrency(debt.balance)}</p></div>
                        <div><p style={{ ...s.muted, fontSize: '10px' }}>Pay monthly</p><p style={{ color: accent.primary, fontWeight: '600' }}>{formatCurrency(debt.recommendedPayment)}</p></div>
                        <div><p style={{ ...s.muted, fontSize: '10px' }}>Paid off in</p><p style={{ ...s.text, fontWeight: '600' }}>{debt.monthsToPayoff}mo</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* News */}
            {isVisible('news') && newsArticles.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={s.label}>Latest News</p>
                  <button onClick={() => navigate('/news')} style={{ ...s.ghostBtn, fontSize: '11px', color: accent.primary, padding: '2px 6px' }}>View all →</button>
                </div>
                <div style={{ background: theme.bgSecondary, border: `0.5px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                  {newsArticles.map((article, i) => (
                    <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', gap: '12px', padding: '14px', borderBottom: i < newsArticles.length - 1 ? `0.5px solid ${theme.border}` : 'none', textDecoration: 'none' }}>
                      {article.image && <img src={article.image} alt="" style={{ width: '60px', height: '46px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} onError={e => (e.currentTarget.style.display = 'none')} />}
                      <div>
                        <p style={{ ...s.text, fontSize: '13px', fontWeight: '500', margin: '0 0 4px', lineHeight: '1.4' }}>{article.title}</p>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ color: accent.primary, fontSize: '11px' }}>{article.source}</span>
                          <span style={{ ...s.muted, fontSize: '11px' }}>· {timeAgo(article.publishedAt)}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Ask AI */}
            <button onClick={() => navigate('/chats')}
              style={{ ...s.card, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: `0.5px solid ${accent.border}`, textAlign: 'left' }}>
              <div style={{ width: '38px', height: '38px', background: accent.bg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: accent.primary, fontWeight: '700', fontSize: '12px' }}>AI</span>
              </div>
              <div>
                <p style={{ ...s.text, fontWeight: '600', fontSize: '13px', margin: 0 }}>Ask your advisor</p>
                <p style={{ ...s.muted, fontSize: '11px', margin: 0 }}>Honest advice on your finances</p>
              </div>
              <span style={{ ...s.muted, marginLeft: 'auto' }}>→</span>
            </button>

            {/* Goals */}
            {isVisible('goals') && analysis.goals.length > 0 && (
              <div>
                <p style={{ ...s.label, marginBottom: '10px' }}>Goals</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analysis.goals.map((goal, i) => {
                    const isAchieved = goal.currentAmount >= goal.targetAmount
                    const surplus = goal.currentAmount - goal.targetAmount
                    const goalColor = goal.feasibility === 'achievable' ? '#34d399' : goal.feasibility === 'stretch' ? '#fbbf24' : '#f87171'
                    return (
                      <div key={i} style={{ background: theme.bgSecondary, border: `0.5px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                        <div style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {isAchieved ? (
                            <div style={{ width: '64px', height: '64px', background: 'rgba(52,211,153,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: '20px' }}>✓</span>
                            </div>
                          ) : (
                            <RingProgress value={goal.percentage} size={64} color={goalColor} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <p style={{ ...s.text, fontWeight: '600', fontSize: '13px', margin: 0 }}>{goal.name}</p>
                              {isAchieved && <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', fontSize: '10px', padding: '2px 6px', borderRadius: '20px' }}>Achieved ✓</span>}
                            </div>
                            <p style={{ ...s.muted, fontSize: '11px', margin: '2px 0 0' }}>{formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}</p>
                            {isAchieved && surplus > 0 && <p style={{ color: '#34d399', fontSize: '11px', margin: '2px 0 0' }}>+{formatCurrency(surplus)} surplus</p>}
                            {!isAchieved && goal.monthlyNeeded > 0 && <p style={{ color: accent.primary, fontSize: '11px', margin: '2px 0 0' }}>+{formatCurrency(goal.monthlyNeeded)}/mo</p>}
                          </div>
                        </div>
                        <div style={{ padding: '8px 14px 12px', borderTop: `0.5px solid ${theme.border}` }}>
                          {isAchieved ? (
                            <button onClick={() => openPersistentChat(`goal_surplus_${i}`, `I've exceeded my "${goal.name}" goal — I have ${formatCurrency(surplus)} more than my target. What are the smartest ways to put this surplus to work?`, 'general', `${goal.name} — Surplus`)}
                              style={{ background: 'none', border: 'none', color: accent.primary, fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
                              Put this money to work →
                            </button>
                          ) : (
                            <button onClick={() => openPersistentChat(`goal_${i}`, `Give me a detailed plan for my "${goal.name}" goal. I have ${formatCurrency(goal.currentAmount)} saved toward ${formatCurrency(goal.targetAmount)}.`, 'general', `${goal.name} Plan`)}
                              style={{ background: 'none', border: 'none', color: accent.primary, fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                              {chatRefs[`goal_${i}`] ? 'Continue plan →' : 'Get advice →'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Income */}
            {isVisible('income') && (
              <button onClick={() => navigate('/money')}
                style={{ ...s.card, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: '38px', height: '38px', background: 'rgba(251,191,36,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '18px' }}>💰</div>
                <div>
                  <p style={{ ...s.text, fontWeight: '600', fontSize: '13px', margin: 0 }}>Make More Money</p>
                  <p style={{ ...s.muted, fontSize: '11px', margin: 0 }}>Ideas, strategies & AI coaching</p>
                </div>
                <span style={{ ...s.muted, marginLeft: 'auto' }}>→</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
