import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { useProfile } from '../contexts/ProfileContext'
import { Landmark, TrendingUp, Bitcoin, Building2, Home as HomeIcon, Briefcase, Monitor, DollarSign, Search, Plus, MessageCircle, Send, type LucideIcon } from 'lucide-react'
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
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
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

interface GoalIdea {
  name: string
  ticker?: string
  type: 'etf' | 'crypto' | 'reit' | 'savings' | 'bond' | 'platform' | 'stock'
  reason: string
  risk: 'Low' | 'Med' | 'High'
  action?: string
}

interface GoalSuggestion {
  goal: string
  target?: number
  strategy: string
  timeline: string
  ideas: GoalIdea[]
}

const PERIODS = ['1D', '1W', '1M', '1Y', '5Y', '10Y', 'ALL']
const SNAP_SYMBOLS = ['SPY', 'QQQ', 'BTC-USD', 'GLD']
const _currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const NEWS_SECTIONS = [
  { key: 'markets', label: 'Markets' },
  { key: 'economy', label: 'Economy' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'realestate', label: 'Real Estate' },
  { key: 'ai', label: 'AI & Tech' },
  { key: 'saved', label: 'Saved' },
]

const PROGRESS_OPTIONS = [
  { key: 'not_started', label: 'Not started', color: 'var(--sand-500)', bg: 'var(--sand-100)' },
  { key: 'in_progress', label: 'In progress', color: '#c8943a', bg: 'rgba(200,148,58,0.1)' },
  { key: 'earning', label: 'Earning', color: '#7a9e6e', bg: 'rgba(122,158,110,0.1)' },
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

  if (/passive|dividend|rental|royalt/.test(lower))
    tags.push({ label: 'Passive', color: '#7a9e6e', bg: 'rgba(122,158,110,0.12)' })
  else if (/freelance|consult|teach|tutor|coach/.test(lower))
    tags.push({ label: 'Active', color: '#c8943a', bg: 'rgba(200,148,58,0.12)' })
  else if (/sell|dropship|resell|product|store/.test(lower))
    tags.push({ label: 'Business', color: 'var(--sand-700)', bg: 'var(--sand-200)' })

  if (/gig|task|today|immediate|same.day/.test(lower))
    tags.push({ label: 'Start today', color: '#7a9e6e', bg: 'rgba(122,158,110,0.12)' })
  else if (/week|quick/.test(lower))
    tags.push({ label: '< 1 week', color: '#c8943a', bg: 'rgba(200,148,58,0.12)' })

  if (/advanced|machine.learning|algorithmic|hedge.fund|complex|broker|accredited/.test(lower))
    tags.push({ label: 'Hard', color: '#c0392b', bg: 'rgba(192,57,43,0.1)' })
  else if (/platform|develop|code|program|license|certification|fund|capital/.test(lower))
    tags.push({ label: 'Medium', color: '#c8943a', bg: 'rgba(200,148,58,0.12)' })
  else
    tags.push({ label: 'Easy', color: '#7a9e6e', bg: 'rgba(122,158,110,0.12)' })

  const match = idea.match(/\$[\d,]+k?[\s\u2013\-]+\$?[\d,]+k?/i)
  if (match) tags.push({ label: match[0].replace(/\s+/g, ''), color: 'var(--sand-700)', bg: 'var(--sand-200)' })

  return tags.slice(0, 3)
}

function getIdeaTags(idea: any): IdeaTag[] {
  if (typeof idea === 'string') return inferIdeaTags(idea)
  const tags: IdeaTag[] = []
  const categoryTags: Record<string, IdeaTag> = {
    skill:      { label: 'Skill-based', color: '#c8943a', bg: 'rgba(200,148,58,0.12)' },
    passive:    { label: 'Passive', color: '#7a9e6e', bg: 'rgba(122,158,110,0.12)' },
    digital:    { label: 'Digital', color: '#5b7fcf', bg: 'rgba(91,127,207,0.12)' },
    investing:  { label: 'Investing', color: '#7a9e6e', bg: 'rgba(122,158,110,0.12)' },
    business:   { label: 'Business', color: 'var(--sand-700)', bg: 'var(--sand-200)' },
  }
  const effortTags: Record<string, IdeaTag> = {
    low:    { label: 'Low effort', color: '#7a9e6e', bg: 'rgba(122,158,110,0.12)' },
    medium: { label: 'Med effort', color: '#c8943a', bg: 'rgba(200,148,58,0.12)' },
    high:   { label: 'High effort', color: '#c0392b', bg: 'rgba(192,57,43,0.1)' },
  }
  if (idea.category && categoryTags[idea.category]) tags.push(categoryTags[idea.category])
  if (idea.effort && effortTags[idea.effort]) tags.push(effortTags[idea.effort])
  return tags.slice(0, 2)
}

const IDEA_TYPE_META: Record<GoalIdea['type'], { label: string; color: string; bg: string }> = {
  etf:      { label: 'ETF',         color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)' },
  stock:    { label: 'Stock',       color: '#1d4ed8', bg: 'rgba(29,78,216,0.1)' },
  crypto:   { label: 'Crypto',      color: '#c8943a', bg: 'rgba(200,148,58,0.12)' },
  reit:     { label: 'Real Estate', color: '#2d6a4f', bg: 'rgba(45,106,79,0.1)' },
  savings:  { label: 'Cash/Savings',color: '#0f766e', bg: 'rgba(15,118,110,0.1)' },
  bond:     { label: 'Bond',        color: '#6d28d9', bg: 'rgba(109,40,217,0.1)' },
  platform: { label: 'Platform',    color: '#7a6a5a', bg: 'rgba(122,106,90,0.12)' },
}

const RISK_META: Record<GoalIdea['risk'], { color: string; bg: string }> = {
  Low:  { color: '#7a9e6e', bg: 'rgba(122,158,110,0.12)' },
  Med:  { color: '#c8943a', bg: 'rgba(200,148,58,0.12)' },
  High: { color: '#c0392b', bg: 'rgba(192,57,43,0.1)' },
}

const GOAL_DATA: Record<string, { strategy: string; timeline: string; ideas: GoalIdea[][] }> = {
  emergency: {
    strategy: 'Keep this 100% liquid and risk-free. This is insurance money — not an investment.',
    timeline: 'Immediate access needed',
    ideas: [
      [
        { name: 'High-Yield Savings', type: 'savings', risk: 'Low', reason: 'Best place for emergency funds. Earn 4–5% APY with instant, penalty-free access. Open at Marcus, SoFi, or Ally.', action: 'Open at Marcus, SoFi, or Ally' },
        { name: 'Money Market Fund', type: 'savings', risk: 'Low', reason: 'Available inside any brokerage. SPAXX (Fidelity) or VMFXX (Vanguard) earn ~5% with same-day settlement.', action: 'Available at any brokerage' },
        { name: 'SGOV', ticker: 'SGOV', type: 'etf', risk: 'Low', reason: '3-month T-bill ETF. Marginally higher yield than HYSA. Settles in 1–2 days — close enough to liquid.', action: 'Add to watchlist' },
        { name: 'BIL', ticker: 'BIL', type: 'etf', risk: 'Low', reason: '1–3 month T-bills. Ultra-stable — designed to never lose value. Good second tranche.', action: 'Add to watchlist' },
      ],
    ],
  },
  house: {
    strategy: 'Protect principal first. Add growth only if your timeline is 3+ years out.',
    timeline: '2–7 years',
    ideas: [
      [
        { name: 'High-Yield Savings', type: 'savings', risk: 'Low', reason: 'Park the bulk here. 4–5% APY, instant access, no risk. Best for timelines under 3 years.', action: 'Open at Marcus, SoFi, or Ally' },
        { name: 'I-Bonds', type: 'bond', risk: 'Low', reason: 'US gov-backed, inflation-protected. $10k/year limit. Best for money you won\'t need for 12+ months.', action: 'Buy at TreasuryDirect.gov' },
        { name: 'SCHP', ticker: 'SCHP', type: 'etf', risk: 'Low', reason: 'TIPS ETF — inflation-protected bonds. Helps your down payment keep up with rising home prices.', action: 'Add to watchlist' },
        { name: 'BND', ticker: 'BND', type: 'etf', risk: 'Low', reason: 'Broad bond ETF for any portion 3+ years away. Reduce exposure as your purchase date nears.', action: 'Add to watchlist' },
      ],
    ],
  },
  retire: {
    strategy: 'Maximize long-term compounding. Your time horizon absorbs short-term volatility.',
    timeline: '10–30+ years',
    ideas: [
      [
        { name: 'VTI', ticker: 'VTI', type: 'etf', risk: 'Med', reason: 'Total US market ETF. 0.03% expense ratio. Owns ~3,500 companies. Core holding for any retirement account.', action: 'Add to watchlist' },
        { name: 'VT', ticker: 'VT', type: 'etf', risk: 'Med', reason: 'Total world market — adds the 40% of global market cap that VTI misses. One-fund diversification.', action: 'Add to watchlist' },
        { name: 'VNQ', ticker: 'VNQ', type: 'reit', risk: 'Med', reason: 'Real estate exposure without buying property. Historically 5–8% dividends + appreciation. Tax-advantaged in a Roth IRA.', action: 'Add to watchlist' },
        { name: 'SCHD', ticker: 'SCHD', type: 'etf', risk: 'Med', reason: 'Dividend growth ETF. Shifts value toward income as you near retirement. Has outperformed S&P in down markets.', action: 'Add to watchlist' },
        { name: 'Bitcoin', ticker: 'BTC-USD', type: 'crypto', risk: 'High', reason: '1–5% allocation as an inflation hedge and uncorrelated asset. Many advisors now include it. Only with money you can hold through 60%+ drawdowns.', action: 'Buy on Coinbase or Kraken' },
      ],
    ],
  },
  college: {
    strategy: 'Use a 529 for tax-free growth. Shift conservative as enrollment approaches.',
    timeline: '5–18 years',
    ideas: [
      [
        { name: '529 Plan', type: 'platform', risk: 'Low', reason: 'State-sponsored, tax-free growth for education. Contributions often state tax-deductible. Most offer target-date funds.', action: 'Open at your state\'s 529 portal' },
        { name: 'VTI', ticker: 'VTI', type: 'etf', risk: 'Med', reason: 'Use for the growth phase (10+ years out). Switch to bonds automatically with a target-date 529 option.', action: 'Add to watchlist' },
        { name: 'AGG', ticker: 'AGG', type: 'etf', risk: 'Low', reason: 'Core bond ETF — shift here for the last 3–5 years before enrollment to preserve what you\'ve built.', action: 'Add to watchlist' },
        { name: 'I-Bonds', type: 'bond', risk: 'Low', reason: '$10k/year limit, inflation-protected. A good conservative layer for shorter college horizons.', action: 'Buy at TreasuryDirect.gov' },
      ],
    ],
  },
  travel: {
    strategy: 'Short timeline means no risk to principal. Save in a dedicated account.',
    timeline: '6–24 months',
    ideas: [
      [
        { name: 'High-Yield Savings', type: 'savings', risk: 'Low', reason: 'Best for this goal. Open a dedicated HYSA and name it your destination. 4–5% APY, instant access.', action: 'Open at Marcus, SoFi, or Ally' },
        { name: 'BIL', ticker: 'BIL', type: 'etf', risk: 'Low', reason: '1–3 month T-bills. Near-zero price risk. A marginal yield bump over HYSA for money 3+ months away.', action: 'Add to watchlist' },
        { name: 'SHV', ticker: 'SHV', type: 'etf', risk: 'Low', reason: 'Ultra-short treasury ETF. Extremely stable — NAV barely moves. Good for money you need in 6–12 months.', action: 'Add to watchlist' },
      ],
    ],
  },
  business: {
    strategy: 'Liquid reserves in cash, invest only what you won\'t need for 2+ years.',
    timeline: '2–5 years',
    ideas: [
      [
        { name: 'High-Yield Savings', type: 'savings', risk: 'Low', reason: 'Keep 6–12 months of operating costs here. Non-negotiable before investing anything else for the business.', action: 'Open a business HYSA' },
        { name: 'VTI', ticker: 'VTI', type: 'etf', risk: 'Med', reason: 'Invest surplus you genuinely won\'t need for 2+ years. Simple, low-cost, broad market.', action: 'Add to watchlist' },
        { name: 'QQQ', ticker: 'QQQ', type: 'etf', risk: 'Med', reason: 'Tech-weighted growth. Makes sense if your business is tech-adjacent and you want sector alignment.', action: 'Add to watchlist' },
        { name: 'Bitcoin', ticker: 'BTC-USD', type: 'crypto', risk: 'High', reason: 'Some founders hold 1–5% as a hedge. Only with surplus you could afford to lose entirely. High reward, high risk.', action: 'Buy on Coinbase or Kraken' },
      ],
    ],
  },
  default: {
    strategy: 'Diversify across asset classes for balanced long-term growth.',
    timeline: '5–10+ years',
    ideas: [
      [
        { name: 'VTI', ticker: 'VTI', type: 'etf', risk: 'Med', reason: 'Total US market. 0.03% ER. Historically ~10% annualized. Core of any long-term portfolio.', action: 'Add to watchlist' },
        { name: 'VT', ticker: 'VT', type: 'etf', risk: 'Med', reason: 'Global diversification — adds Europe, Asia, and emerging markets. Reduces single-country risk.', action: 'Add to watchlist' },
        { name: 'VNQ', ticker: 'VNQ', type: 'reit', risk: 'Med', reason: 'Real estate exposure without buying property. Dividends + appreciation. Historically low correlation to stocks.', action: 'Add to watchlist' },
        { name: 'SCHD', ticker: 'SCHD', type: 'etf', risk: 'Med', reason: 'Dividend growth ETF. Tends to outperform in down markets. Good for income-focused portion of portfolio.', action: 'Add to watchlist' },
        { name: 'Bitcoin', ticker: 'BTC-USD', type: 'crypto', risk: 'High', reason: '1–5% as an uncorrelated alternative asset. Has historically outperformed most assets over 5+ year windows.', action: 'Buy on Coinbase or Kraken' },
        { name: 'BND', ticker: 'BND', type: 'etf', risk: 'Low', reason: 'Bond ballast — reduces overall volatility. Increase allocation as your timeline shortens.', action: 'Add to watchlist' },
      ],
    ],
  },
}

function getGoalSuggestions(goals: any[], _rotation = 0, limit = 10): GoalSuggestion[] {
  if (!goals?.length) return []
  return goals.slice(0, limit).map(goal => {
    const name = (goal.name || goal.title || goal.description || '').toLowerCase()
    let key = 'default'
    if (/emergency|safety|cushion/.test(name)) key = 'emergency'
    else if (/house|home|down.?payment|property/.test(name)) key = 'house'
    else if (/retire/.test(name)) key = 'retire'
    else if (/college|school|education/.test(name)) key = 'college'
    else if (/travel|vacation|trip/.test(name)) key = 'travel'
    else if (/business|startup/.test(name)) key = 'business'
    const data = GOAL_DATA[key]
    return {
      goal: goal.name || goal.title || 'Goal',
      target: goal.target_amount || goal.targetAmount,
      strategy: data.strategy,
      timeline: data.timeline,
      ideas: data.ideas[0],
    }
  })
}

function GrowthSection({
  profile,
  analysis,
  ideaProgress,
  navigate,
  liveQuotes,
  liveQuotesLoading,
  refreshLiveQuotes,
  updateProfile,
  onSelectStock,
}: {
  profile: any
  analysis: any
  ideaProgress: Record<string, string>
  navigate: (path: string) => void
  liveQuotes: Record<string, { price: number; change: number; changePercent: string }>
  liveQuotesLoading: boolean
  refreshLiveQuotes: () => Promise<void>
  updateProfile: (updates: Record<string, any>) => Promise<void>
  onSelectStock: (symbol: string) => void
}) {
  const [tab, setTab] = useState<'portfolio' | 'income'>('portfolio')

  // Portfolio edit state
  const [editingAccount, setEditingAccount] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ symbol: string; name?: string; shares: number; costBasis?: number }[]>([])
  const [newPosSymbol, setNewPosSymbol] = useState('')
  const [newPosShares, setNewPosShares] = useState('')
  const [newPosCost, setNewPosCost] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Add income stream state
  const [showAddStream, setShowAddStream] = useState(false)
  const [streamName, setStreamName] = useState('')
  const [streamType, setStreamType] = useState('other')
  const [streamAmount, setStreamAmount] = useState('')
  const [streamFrequency, setStreamFrequency] = useState<'monthly' | 'annual' | 'weekly'>('monthly')
  const [streamSaving, setStreamSaving] = useState(false)

  async function saveNewStream() {
    const amount = parseFloat(streamAmount)
    if (!streamName.trim() || isNaN(amount) || amount <= 0) return
    setStreamSaving(true)
    const existing: any[] = profile?.income_sources || []
    const newSource = { type: streamType, description: streamName.trim(), amount, frequency: streamFrequency }
    const monthlyEquiv = streamFrequency === 'annual' ? amount / 12 : streamFrequency === 'weekly' ? amount * 4.33 : amount
    const currentMonthly = profile?.monthly_income || 0
    const newMonthly = currentMonthly + monthlyEquiv
    await updateProfile({
      profile_data: {
        ...profile,
        income_sources: [...existing, newSource],
        monthly_income: Math.round(newMonthly),
      }
    })
    setStreamName('')
    setStreamType('other')
    setStreamAmount('')
    setStreamFrequency('monthly')
    setShowAddStream(false)
    setStreamSaving(false)
  }

  function startEdit(accountName: string) {
    const asset = (profile?.assets || []).find((a: any) => a.name === accountName)
    setEditDraft(asset?.positions?.map((p: any) => ({ ...p })) || [])
    setNewPosSymbol('')
    setNewPosShares('')
    setNewPosCost('')
    setEditingAccount(accountName)
  }

  async function saveEdit(accountName: string) {
    setEditSaving(true)
    const updatedAssets = (profile?.assets || []).map((a: any) =>
      a.name === accountName
        ? { ...a, positions: editDraft.filter(p => p.symbol && p.shares > 0) }
        : a
    )
    await updateProfile({ profile_data: { ...profile, assets: updatedAssets } })
    setEditingAccount(null)
    setEditSaving(false)
  }

  function addNewPosition() {
    const sym = newPosSymbol.trim().toUpperCase()
    const shares = parseFloat(newPosShares)
    if (!sym || isNaN(shares) || shares <= 0) return
    const costBasis = newPosCost ? parseFloat(newPosCost) : undefined
    setEditDraft(prev => [...prev, { symbol: sym, shares, ...(costBasis != null && !isNaN(costBasis) ? { costBasis } : {}) }])
    setNewPosSymbol('')
    setNewPosShares('')
    setNewPosCost('')
  }

  const fmt = (n: number) => _currencyFmt.format(isFinite(n) ? n : 0)
  const fmtDelta = (n: number) => {
    const abs = Math.abs(n)
    const prefix = n >= 0 ? '+' : '-'
    if (abs >= 1000000) return `${prefix}$${(abs / 1000000).toFixed(1)}M`
    if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
    return `${prefix}$${abs.toFixed(0)}`
  }

  const goals = analysis?.goals || []
  const assets = profile?.assets || []
  const debts = profile?.debts || []
  const income = profile?.monthly_income || 0
  const expenses = profile?.monthly_expenses || 0
  const availableToSave = income - expenses

  // Collect all positions across all accounts
  const allPositions: { accountName: string; accountCategory: string; accountType?: string; symbol: string; name?: string; shares: number; costBasis?: number }[] = []
  for (const asset of assets) {
    if (asset.positions?.length) {
      for (const pos of asset.positions) {
        if (pos.symbol && pos.shares > 0) {
          allPositions.push({
            accountName: asset.name,
            accountCategory: asset.category,
            accountType: asset.account_type,
            symbol: pos.symbol,
            name: pos.name,
            shares: pos.shares,
            costBasis: pos.costBasis,
          })
        }
      }
    }
  }
  const uniqueSymbols = [...new Set(allPositions.map(p => p.symbol))]
  const portfolioQuotes = liveQuotes
  const portfolioLoading = liveQuotesLoading

  // Income streams
  const earningCount = Object.values(ideaProgress).filter(v => v === 'earning').length
  const inProgressCount = Object.values(ideaProgress).filter(v => v === 'in_progress').length

  return (
    <div className="animate-fade" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
        <p className="label" style={{ margin: 0 }}>Investments</p>
        <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>live prices</span>
      </div>

      {/* Tab pills */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
        {([
          { key: 'portfolio', label: 'Holdings' },
          { key: 'income', label: 'Income streams' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '7px 18px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
              cursor: 'pointer', fontFamily: 'inherit', border: 'none', flexShrink: 0,
              background: tab === key ? 'var(--accent)' : 'var(--sand-200)',
              color: tab === key ? 'var(--sand-50)' : 'var(--sand-600)',
              transition: 'all 0.2s'
            }}>
            {label}
          </button>
        ))}
      </div>


      {/* ── PORTFOLIO TAB ── */}
      {tab === 'portfolio' && (() => {
        if (allPositions.length === 0) {
          return (
            <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--sand-100)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontSize: '15px', color: 'var(--sand-700)', margin: '0 0 6px', fontWeight: '500' }}>No positions tracked yet</p>
              <p style={{ fontSize: '12px', color: 'var(--sand-400)', margin: '0 0 16px', lineHeight: '1.5' }}>
                Add individual shares to your assets (e.g. 14 shares of AAPL) to see live prices, daily moves, and gain/loss here — separate from your net worth snapshot on the dashboard.
              </p>
              <button className="btn-primary" onClick={() => navigate('/onboarding?step=2')} style={{ fontSize: '13px', padding: '9px 22px' }}>
                Add Holdings
              </button>
            </div>
          )
        }

        // Group positions by account
        const byAccount: Record<string, typeof allPositions> = {}
        for (const pos of allPositions) {
          const key = pos.accountName
          if (!byAccount[key]) byAccount[key] = []
          byAccount[key].push(pos)
        }

        // Compute totals
        let totalLiveValue = 0
        let totalCostBasis = 0
        let hasCostBasis = false

        for (const pos of allPositions) {
          const q = portfolioQuotes[pos.symbol]
          if (q) totalLiveValue += pos.shares * q.price
          if (pos.costBasis != null) {
            totalCostBasis += pos.costBasis
            hasCostBasis = true
          }
        }
        const totalGain = hasCostBasis ? totalLiveValue - totalCostBasis : null
        const totalGainPct = hasCostBasis && totalCostBasis > 0 ? (totalGain! / totalCostBasis) * 100 : null

        const ACCOUNT_ICONS: Record<string, LucideIcon> = {
          retirement: Landmark, brokerage: TrendingUp, investment: TrendingUp, crypto: Bitcoin, savings: Building2, real_estate: HomeIcon, other: Briefcase
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Summary card */}
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Live Portfolio Value</p>
                  {portfolioLoading ? (
                    <p style={{ fontSize: '24px', color: 'var(--sand-400)', margin: 0 }}>Loading…</p>
                  ) : (
                    <p style={{ fontSize: '26px', fontWeight: '300', color: 'var(--sand-900)', margin: 0, letterSpacing: '-0.8px' }}>
                      {Object.keys(portfolioQuotes).length > 0 ? fmt(totalLiveValue) : '—'}
                    </p>
                  )}
                  {totalGain !== null && !portfolioLoading && Object.keys(portfolioQuotes).length > 0 && (
                    <p style={{ fontSize: '13px', fontWeight: '600', color: totalGain >= 0 ? 'var(--success)' : 'var(--danger)', margin: '4px 0 0' }}>
                      {totalGain >= 0 ? '+' : ''}{fmt(totalGain)} ({totalGainPct !== null ? `${totalGainPct >= 0 ? '+' : ''}${totalGainPct.toFixed(2)}%` : ''}) all time
                    </p>
                  )}
                </div>
                <button
                  onClick={() => refreshLiveQuotes()}
                  style={{ background: 'none', border: '0.5px solid var(--sand-300)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', color: 'var(--sand-500)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Refresh
                </button>
              </div>
              {hasCostBasis && !portfolioLoading && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '16px' }}>
                  <div>
                    <p style={{ fontSize: '9px', color: 'var(--sand-400)', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Cost Basis</p>
                    <p style={{ fontSize: '13px', color: 'var(--sand-600)', margin: 0 }}>{fmt(totalCostBasis)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '9px', color: 'var(--sand-400)', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Unrealized P/L</p>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: totalGain! >= 0 ? 'var(--success)' : 'var(--danger)', margin: 0 }}>
                      {totalGain! >= 0 ? '+' : ''}{fmt(totalGain!)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Per-account breakdown */}
            {Object.entries(byAccount).map(([accountName, positions]) => {
              const asset = assets.find((a: any) => a.name === accountName)
              const AccountIcon = ACCOUNT_ICONS[asset?.category || 'other'] || Briefcase
              let acctLiveValue = 0
              let acctCostBasis = 0
              let acctHasCostBasis = false
              for (const pos of positions) {
                const q = portfolioQuotes[pos.symbol]
                if (q) acctLiveValue += pos.shares * q.price
                if (pos.costBasis != null) { acctCostBasis += pos.costBasis; acctHasCostBasis = true }
              }
              const acctGain = acctHasCostBasis ? acctLiveValue - acctCostBasis : null

              const isEditing = editingAccount === accountName

              return (
                <div key={accountName} className="card" style={{ padding: '14px' }}>
                  {/* Account header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', color: 'var(--sand-500)' }}><AccountIcon size={18} strokeWidth={1.5} /></span>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-900)', margin: 0 }}>{accountName}</p>
                        {asset?.account_type && (
                          <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: 0 }}>{asset.account_type}</p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!isEditing && (
                        <>
                          {portfolioLoading ? (
                            <p style={{ fontSize: '14px', color: 'var(--sand-400)', margin: 0 }}>…</p>
                          ) : Object.keys(portfolioQuotes).length > 0 ? (
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--sand-900)', margin: 0 }}>{fmt(acctLiveValue)}</p>
                              {acctGain !== null && (
                                <p style={{ fontSize: '10px', fontWeight: '600', color: acctGain >= 0 ? 'var(--success)' : 'var(--danger)', margin: '1px 0 0' }}>
                                  {acctGain >= 0 ? '+' : ''}{fmt(acctGain)}
                                </p>
                              )}
                            </div>
                          ) : null}
                          <button
                            onClick={() => startEdit(accountName)}
                            style={{ background: 'none', border: '0.5px solid var(--sand-300)', borderRadius: '7px', padding: '4px 10px', fontSize: '11px', color: 'var(--sand-500)', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                            Edit
                          </button>
                        </>
                      )}
                      {isEditing && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => setEditingAccount(null)}
                            style={{ background: 'none', border: '0.5px solid var(--sand-300)', borderRadius: '7px', padding: '4px 10px', fontSize: '11px', color: 'var(--sand-500)', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(accountName)}
                            disabled={editSaving}
                            style={{ background: 'var(--accent)', border: 'none', borderRadius: '7px', padding: '4px 12px', fontSize: '11px', color: '#fff', cursor: editSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: '600', opacity: editSaving ? 0.7 : 1 }}>
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edit mode */}
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Column labels */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 24px', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Symbol</span>
                        <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shares</span>
                        <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost basis ($)</span>
                        <span />
                      </div>

                      {/* Existing positions */}
                      {editDraft.map((pos, pi) => (
                        <div key={pi} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 24px', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)' }}>{pos.symbol}</span>
                          <input
                            type="number"
                            value={pos.shares}
                            min={0}
                            step="any"
                            onChange={e => {
                              const v = parseFloat(e.target.value)
                              setEditDraft(prev => prev.map((p, i) => i === pi ? { ...p, shares: isNaN(v) ? 0 : v } : p))
                            }}
                            style={{ width: '100%', padding: '5px 7px', fontSize: '12px', border: '0.5px solid var(--sand-300)', borderRadius: '6px', background: 'var(--sand-50)', fontFamily: 'inherit', boxSizing: 'border-box' }}
                          />
                          <input
                            type="number"
                            value={pos.costBasis ?? ''}
                            min={0}
                            step="any"
                            placeholder="optional"
                            onChange={e => {
                              const v = parseFloat(e.target.value)
                              setEditDraft(prev => prev.map((p, i) => i === pi ? { ...p, costBasis: isNaN(v) ? undefined : v } : p))
                            }}
                            style={{ width: '100%', padding: '5px 7px', fontSize: '12px', border: '0.5px solid var(--sand-300)', borderRadius: '6px', background: 'var(--sand-50)', fontFamily: 'inherit', boxSizing: 'border-box' }}
                          />
                          <button
                            onClick={() => setEditDraft(prev => prev.filter((_, i) => i !== pi))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--danger)', padding: '0', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ×
                          </button>
                        </div>
                      ))}

                      {/* Add new position row */}
                      <div style={{ borderTop: '0.5px solid var(--sand-200)', marginTop: '4px', paddingTop: '8px' }}>
                        <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: '0 0 5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add position</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 40px', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={newPosSymbol}
                            onChange={e => setNewPosSymbol(e.target.value.toUpperCase())}
                            placeholder="AAPL"
                            style={{ width: '100%', padding: '5px 7px', fontSize: '12px', border: '0.5px solid var(--sand-300)', borderRadius: '6px', background: 'var(--sand-50)', fontFamily: 'inherit', boxSizing: 'border-box', textTransform: 'uppercase' }}
                          />
                          <input
                            type="number"
                            value={newPosShares}
                            onChange={e => setNewPosShares(e.target.value)}
                            placeholder="0"
                            min={0}
                            step="any"
                            style={{ width: '100%', padding: '5px 7px', fontSize: '12px', border: '0.5px solid var(--sand-300)', borderRadius: '6px', background: 'var(--sand-50)', fontFamily: 'inherit', boxSizing: 'border-box' }}
                          />
                          <input
                            type="number"
                            value={newPosCost}
                            onChange={e => setNewPosCost(e.target.value)}
                            placeholder="optional"
                            min={0}
                            step="any"
                            style={{ width: '100%', padding: '5px 7px', fontSize: '12px', border: '0.5px solid var(--sand-300)', borderRadius: '6px', background: 'var(--sand-50)', fontFamily: 'inherit', boxSizing: 'border-box' }}
                          />
                          <button
                            onClick={addNewPosition}
                            style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', padding: '5px', fontSize: '14px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px' }}>
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Position rows (view mode) */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {positions.map((pos, pi) => {
                        const q = portfolioQuotes[pos.symbol]
                        const liveValue = q ? pos.shares * q.price : null
                        const costTotal = pos.costBasis != null ? pos.costBasis : null
                        const gain = liveValue != null && costTotal != null ? liveValue - costTotal : null
                        const gainPct = gain != null && costTotal != null && costTotal > 0 ? (gain / costTotal) * 100 : null
                        const todayChange = q ? pos.shares * q.change : null
                        const isUp = q ? q.change >= 0 : null

                        return (
                          <div key={pi} onClick={() => onSelectStock(pos.symbol)} style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: pi < positions.length - 1 ? '8px' : 0, borderBottom: pi < positions.length - 1 ? '0.5px solid var(--sand-200)' : 'none', cursor: 'pointer' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)' }}>{pos.symbol}</span>
                                {pos.name && <span style={{ fontSize: '10px', color: 'var(--sand-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.name}</span>}
                              </div>
                              <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '1px 0 0' }}>
                                {pos.shares} {pos.accountCategory === 'crypto' ? 'units' : 'shares'}
                                {q && ` · $${q.price.toFixed(2)}/share`}
                              </p>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              {portfolioLoading ? (
                                <p style={{ fontSize: '12px', color: 'var(--sand-400)', margin: 0 }}>…</p>
                              ) : liveValue !== null ? (
                                <>
                                  <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-900)', margin: 0 }}>{fmt(liveValue)}</p>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '1px' }}>
                                    {todayChange !== null && (
                                      <span style={{ fontSize: '10px', fontWeight: '600', color: isUp ? 'var(--success)' : 'var(--danger)' }}>
                                        {isUp ? '+' : ''}{fmt(todayChange)} today
                                      </span>
                                    )}
                                    {gain !== null && gainPct !== null && (
                                      <span style={{ fontSize: '10px', color: gain >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '500' }}>
                                        ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}% total)
                                      </span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: 0 }}>—</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            <p style={{ fontSize: '10px', color: 'var(--sand-400)', textAlign: 'center', margin: '4px 0 0', lineHeight: '1.5' }}>
              Prices from Yahoo Finance · 15-min delay · Tap Refresh to update
            </p>
          </div>
        )
      })()}

      {/* ── INCOME TAB ── */}
      {tab === 'income' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Primary income sources from profile */}
          {(() => {
            const sources: { type: string; description: string; amount: number; frequency: string }[] = profile?.income_sources || []
            const monthly = profile?.monthly_income || 0
            const typeLabel: Record<string, string> = {
              salary: 'Salary', freelance: 'Freelance', business: 'Business', investment: 'Investment', rental: 'Rental', other: 'Other'
            }
            const typeIcon: Record<string, LucideIcon> = {
              salary: Briefcase, freelance: Monitor, business: Building2, investment: TrendingUp, rental: HomeIcon, other: DollarSign
            }
            if (monthly === 0 && sources.length === 0) return null
            return (
              <div className="card" style={{ padding: '14px' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--sand-600)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Income</p>
                {sources.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {sources.map((src, i) => {
                      const monthly = src.frequency === 'annual' ? src.amount / 12 : src.amount
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: i < sources.length - 1 ? '10px' : 0, borderBottom: i < sources.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
                          <span style={{ flexShrink: 0, display: 'flex', color: 'var(--sand-500)' }}>{(() => { const Icon = typeIcon[src.type] || DollarSign; return <Icon size={20} strokeWidth={1.5} /> })()}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 1px' }}>
                              {src.description || typeLabel[src.type] || src.type}
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{typeLabel[src.type] || src.type}</p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--sand-900)', margin: 0 }}>{fmt(monthly)}/mo</p>
                            {src.frequency === 'annual' && (
                              <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: '1px 0 0' }}>{fmt(src.amount)}/yr</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {sources.length > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '0.5px solid var(--sand-200)' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)' }}>Total monthly</span>
                        <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--success)' }}>{fmt(monthly)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ display: 'flex', color: 'var(--sand-500)' }}><Briefcase size={20} strokeWidth={1.5} /></span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 1px' }}>Primary Income</p>
                      <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>From your profile</p>
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--sand-900)', margin: 0 }}>{fmt(monthly)}/mo</p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Earning', value: String(earningCount), color: 'var(--success)', bg: 'rgba(122,158,110,0.09)' },
              { label: 'In Progress', value: String(inProgressCount), color: 'var(--warning)', bg: 'rgba(200,148,58,0.09)' },
              {
                label: 'Surplus',
                value: availableToSave >= 0 ? fmt(availableToSave) : fmt(availableToSave),
                color: availableToSave >= 0 ? 'var(--success)' : 'var(--danger)',
                bg: availableToSave >= 0 ? 'var(--sand-100)' : 'rgba(192,57,43,0.07)'
              },
            ].map((stat, i) => (
              <div key={i} style={{ padding: '12px', background: stat.bg, border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>{stat.label}</p>
                <p style={{ fontSize: i === 2 ? '14px' : '22px', fontWeight: i === 2 ? '500' : '400', color: stat.color, margin: 0, letterSpacing: '-0.3px' }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Active streams */}
          {(earningCount > 0 || inProgressCount > 0) ? (
            <div className="card" style={{ padding: '14px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--sand-600)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Streams</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(ideaProgress)
                  .filter(([, v]) => v === 'earning' || v === 'in_progress')
                  .map(([idea, status], i) => {
                    const isEarning = status === 'earning'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: isEarning ? 'var(--success)' : 'var(--warning)', flexShrink: 0, marginTop: '4px' }} />
                        <p style={{
                          fontSize: '13px', color: 'var(--sand-800)', margin: 0, flex: 1, lineHeight: '1.4',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden'
                        }}>{idea}</p>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: isEarning ? 'var(--success)' : 'var(--warning)', flexShrink: 0, marginTop: '2px' }}>
                          {isEarning ? 'Earning' : 'In Progress'}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 16px', background: 'var(--sand-100)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontSize: '14px', color: 'var(--sand-700)', margin: '0 0 4px', fontWeight: '500' }}>No active income streams yet</p>
              <p style={{ fontSize: '12px', color: 'var(--sand-400)', margin: 0 }}>Browse income ideas below and mark your progress to track them here</p>
            </div>
          )}

          {/* Add income stream button */}
          <button
            onClick={() => setShowAddStream(true)}
            style={{
              width: '100%', padding: '12px', background: 'transparent',
              border: '1px dashed var(--sand-400)', borderRadius: 'var(--radius-md)',
              color: 'var(--sand-600)', fontSize: '13px', fontWeight: '500',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <Plus size={15} />
            Add income stream
          </button>

          {/* Add income stream modal */}
          {showAddStream && (
            <div
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
              }}
              onClick={e => { if (e.target === e.currentTarget) setShowAddStream(false) }}
            >
              <div style={{
                background: 'var(--bg)', borderRadius: '18px 18px 0 0', padding: '24px 20px 36px',
                width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--sand-900)', margin: 0 }}>Add income stream</p>
                  <button onClick={() => setShowAddStream(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sand-500)', fontSize: '18px', padding: '4px' }}>✕</button>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-500)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Freelance design, Rental income"
                    value={streamName}
                    onChange={e => setStreamName(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', background: 'var(--sand-100)',
                      border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-sm)',
                      fontSize: '14px', color: 'var(--sand-900)', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-500)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Type</label>
                  <select
                    value={streamType}
                    onChange={e => setStreamType(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', background: 'var(--sand-100)',
                      border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-sm)',
                      fontSize: '14px', color: 'var(--sand-900)', appearance: 'none'
                    }}
                  >
                    <option value="salary">Salary</option>
                    <option value="freelance">Freelance</option>
                    <option value="business">Business</option>
                    <option value="investment">Investment</option>
                    <option value="rental">Rental</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-500)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Amount</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={streamAmount}
                      onChange={e => setStreamAmount(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', background: 'var(--sand-100)',
                        border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-sm)',
                        fontSize: '14px', color: 'var(--sand-900)', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-500)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Frequency</label>
                    <select
                      value={streamFrequency}
                      onChange={e => setStreamFrequency(e.target.value as 'monthly' | 'annual' | 'weekly')}
                      style={{
                        width: '100%', padding: '10px 12px', background: 'var(--sand-100)',
                        border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-sm)',
                        fontSize: '14px', color: 'var(--sand-900)', appearance: 'none'
                      }}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={saveNewStream}
                  disabled={streamSaving || !streamName.trim() || !streamAmount}
                  style={{
                    padding: '13px', background: 'var(--sand-900)', border: 'none',
                    borderRadius: 'var(--radius-md)', color: 'white', fontSize: '15px',
                    fontWeight: '600', cursor: 'pointer', marginTop: '4px',
                    opacity: streamSaving || !streamName.trim() || !streamAmount ? 0.5 : 1
                  }}
                >
                  {streamSaving ? 'Saving…' : 'Add stream'}
                </button>
              </div>
            </div>
          )}

          {/* What to do next */}
          <div style={{ padding: '12px 14px', background: 'var(--sand-100)', borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--sand-300)' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--sand-500)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Next step</p>
            {earningCount === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--sand-700)', margin: 0, lineHeight: '1.55' }}>Browse income ideas below and pick one to start this week. Mark it "In progress" to start tracking.</p>
            )}
            {earningCount > 0 && earningCount < 3 && (
              <p style={{ fontSize: '12px', color: 'var(--sand-700)', margin: 0, lineHeight: '1.55' }}>
                {earningCount} stream{earningCount > 1 ? 's' : ''} active. Aim for 3+ diversified sources for real financial resilience.
              </p>
            )}
            {earningCount >= 3 && (
              <p style={{ fontSize: '12px', color: 'var(--success)', margin: 0, lineHeight: '1.55' }}>
                {earningCount} streams — strong diversification. Focus on scaling your highest-earning one.
              </p>
            )}
            {availableToSave > 500 && (
              <p style={{ fontSize: '12px', color: 'var(--sand-600)', margin: '6px 0 0', lineHeight: '1.55' }}>
                {fmt(availableToSave)}/mo surplus — redirect it toward goals or investments to compound growth.
              </p>
            )}
            {availableToSave <= 0 && (
              <p style={{ fontSize: '12px', color: 'var(--danger)', margin: '6px 0 0', lineHeight: '1.55' }}>
                Expenses exceed income — one new stream would immediately improve your position.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StockDetail({
  quote, onClose, alertPrice, onSetAlert, sharesOwned, onSetShares, profile
}: {
  quote: StockQuote
  onClose: () => void
  alertPrice?: number
  onSetAlert: (price: number | null) => void
  sharesOwned: number
  onSetShares: (shares: number) => void
  profile: any
}) {
  const [period, setPeriod] = useState('1M')
  const [chartData, setChartData] = useState<{ labels: string[]; prices: number[] } | null>(null)
  const [analysis, setAnalysis] = useState('')
  const [loadingChart, setLoadingChart] = useState(true)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)
  const [alertInput, setAlertInput] = useState(alertPrice ? String(alertPrice) : '')
  const [sharesInput, setSharesInput] = useState(sharesOwned > 0 ? String(sharesOwned) : '')
  const [minimizedAI, setMinimizedAI] = useState(false)

  // Stock chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const sendChatMessage = async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    const userMsg = { role: 'user' as const, content: text }
    const updated = [...chatMessages, userMsg]
    setChatMessages(updated)
    setChatInput('')
    setChatLoading(true)
    try {
      const stockContext = `The user is asking about ${quote.symbol}${quote.name ? ` (${quote.name})` : ''}. Current price: $${quote.price.toFixed(2)}, change today: ${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)} (${quote.changePercent}%)${quote.fiftyTwoWeekHigh ? `, 52-week range: $${quote.fiftyTwoWeekLow?.toFixed(2)}–$${quote.fiftyTwoWeekHigh?.toFixed(2)}` : ''}. Answer questions about this specific stock.`
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated,
          profile,
          topic: stockContext,
        })
      })
      const data = await res.json()
      const reply = data.message || 'No response.'
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setChatLoading(false)
  }

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

  const formatAnalysis = (text: string) =>
    formatAIText(text, { textColor: 'var(--sand-700)' })

  const has52w = quote.fiftyTwoWeekHigh && quote.fiftyTwoWeekLow
  const rangePercent = has52w
    ? ((quote.price - quote.fiftyTwoWeekLow!) / (quote.fiftyTwoWeekHigh! - quote.fiftyTwoWeekLow!)) * 100
    : null

  return (
    <div className="sheet-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="animate-slide" style={{ background: 'var(--sand-50)', borderRadius: '24px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--sand-50)', zIndex: 1, borderRadius: '24px 24px 0 0', flexShrink: 0 }}>
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
                <span style={{ fontSize: '26px', fontWeight: '300', color: 'var(--sand-900)', letterSpacing: '-0.5px' }}>${(quote.price ?? 0).toFixed(2)}</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                  {isPositive ? '+' : ''}{(quote.change ?? 0).toFixed(2)} ({(parseFloat(quote.changePercent) || 0).toFixed(2)}%)
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'var(--sand-200)', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', color: 'var(--sand-700)' }}>×</button>
          </div>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
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

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {[
              { label: 'High', value: quote.high != null ? `$${quote.high.toFixed(2)}` : '—' },
              { label: 'Low', value: quote.low != null ? `$${quote.low.toFixed(2)}` : '—' },
              { label: 'Volume', value: quote.volume > 1000000 ? `${(quote.volume / 1000000).toFixed(1)}M` : quote.volume > 0 ? `${(quote.volume / 1000).toFixed(0)}K` : '—' }
            ].map((item, i) => (
              <div key={i} className="card-muted" style={{ textAlign: 'center', padding: '10px' }}>
                <p className="label" style={{ marginBottom: '3px', fontSize: '9px' }}>{item.label}</p>
                <p style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* 52-week range bar */}
          {has52w && rangePercent !== null && (
            <div className="card-muted" style={{ padding: '12px 14px' }}>
              <p className="label" style={{ fontSize: '9px', marginBottom: '10px' }}>52-Week Range</p>
              <div style={{ position: 'relative', height: '6px', background: 'var(--sand-300)', borderRadius: '3px' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${Math.min(100, Math.max(0, rangePercent))}%`,
                  background: isPositive ? 'var(--success)' : 'var(--danger)',
                  borderRadius: '3px', transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)'
                }} />
                <div style={{
                  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                  left: `calc(${Math.min(100, Math.max(0, rangePercent))}% - 5px)`,
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: isPositive ? 'var(--success)' : 'var(--danger)',
                  border: '2px solid var(--sand-50)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>{quote.fiftyTwoWeekLow != null ? `$${quote.fiftyTwoWeekLow.toFixed(2)}` : '—'}</span>
                <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>{quote.fiftyTwoWeekHigh != null ? `$${quote.fiftyTwoWeekHigh.toFixed(2)}` : '—'}</span>
              </div>
            </div>
          )}

          {/* Price alert */}
          <div className="card-muted" style={{ padding: '12px 14px' }}>
            <p className="label" style={{ fontSize: '9px', marginBottom: '8px' }}>Price Alert</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={alertInput}
                onChange={e => setAlertInput(e.target.value)}
                placeholder={`Target price (e.g. ${quote.price ? (quote.price * 1.1).toFixed(0) : ''})`}
                type="number"
                style={{ flex: 1, fontSize: '13px' }}
              />
              <button
                onClick={() => {
                  const v = parseFloat(alertInput)
                  if (!isNaN(v) && v > 0) onSetAlert(v)
                }}
                style={{ padding: '0 14px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--accent-border)', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                Set
              </button>
              {alertPrice && (
                <button
                  onClick={() => { onSetAlert(null); setAlertInput('') }}
                  style={{ padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--sand-300)', background: 'var(--sand-100)', color: 'var(--sand-600)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Clear
                </button>
              )}
            </div>
            {alertPrice && (
              <p style={{ fontSize: '11px', color: 'var(--sand-500)', marginTop: '6px', margin: '6px 0 0' }}>
                Alert set at ${alertPrice.toFixed(2)} · {quote.price >= alertPrice ? 'Target reached' : `$${(alertPrice - quote.price).toFixed(2)} away`}
              </p>
            )}
          </div>

          {/* Shares owned */}
          <div className="card-muted" style={{ padding: '12px 14px' }}>
            <p className="label" style={{ fontSize: '9px', marginBottom: '8px' }}>Shares Owned</p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                value={sharesInput}
                onChange={e => setSharesInput(e.target.value)}
                placeholder="0"
                type="number"
                style={{ flex: 1, fontSize: '13px' }}
              />
              <button
                onClick={() => {
                  const v = parseFloat(sharesInput)
                  onSetShares(isNaN(v) ? 0 : v)
                }}
                style={{ padding: '0 14px', borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--accent-border)', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                Save
              </button>
            </div>
            {sharesOwned > 0 && (
              <p style={{ fontSize: '11px', color: 'var(--sand-500)', marginTop: '6px', margin: '6px 0 0' }}>
                Position: ${(quote.price * sharesOwned).toLocaleString(undefined, { maximumFractionDigits: 2 })} · Today: {quote.change >= 0 ? '+' : ''}${(quote.change * sharesOwned).toFixed(2)}
              </p>
            )}
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
                    {[0, 150, 300].map(d => <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                  </div>
                ) : <div>{formatAnalysis(analysis)}</div>}
                <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '10px 0 0' }}>Not financial advice.</p>
              </div>
            )}
          </div>

          {/* Ask follow-up questions */}
          <div className="card-muted" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: chatMessages.length > 0 ? '0.5px solid var(--sand-200)' : 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '22px', height: '22px', background: 'var(--sand-300)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MessageCircle size={12} color="var(--sand-600)" />
              </div>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-700)', margin: 0 }}>Ask about {quote.symbol}</p>
            </div>

            {chatMessages.length > 0 && (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '85%', padding: '9px 12px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: msg.role === 'user' ? 'var(--sand-900)' : 'var(--sand-200)',
                      fontSize: '13px', lineHeight: '1.5',
                      color: msg.role === 'user' ? 'var(--sand-50)' : 'var(--sand-800)'
                    }}>
                      {msg.role === 'assistant' ? formatAnalysis(msg.content) : msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', gap: '5px', padding: '4px 2px' }}>
                    {[0, 150, 300].map(d => <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            <div style={{ padding: '10px 12px', display: 'flex', gap: '8px', borderTop: chatMessages.length > 0 ? '0.5px solid var(--sand-200)' : 'none' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                placeholder={`Ask anything about ${quote.symbol}…`}
                style={{ flex: 1, fontSize: '13px', padding: '9px 12px', background: 'var(--sand-100)', border: '0.5px solid var(--sand-300)', borderRadius: '20px', outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || chatLoading}
                style={{
                  width: '34px', height: '34px', borderRadius: '50%', border: 'none', flexShrink: 0, alignSelf: 'center',
                  background: chatInput.trim() && !chatLoading ? 'var(--sand-900)' : 'var(--sand-300)',
                  cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s'
                }}
              >
                <Send size={14} color={chatInput.trim() && !chatLoading ? 'var(--sand-50)' : 'var(--sand-500)'} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Grow() {
  const navigate = useNavigate()
  const { preferences } = useTheme()
  const { userId, profileData: profile, analysis, chatRefs, watchlist, savedIdeas, incomeIdeas, loading: profileLoading, liveQuotes, liveQuotesLoading, refreshLiveQuotes, updateProfile } = useProfile()

  const [ideas, setIdeas] = useState<any[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [activeGrowTab, setActiveGrowTab] = useState<'holdings' | 'ideas' | 'news'>('holdings')
  const [articles, setArticles] = useState<Article[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [activeSection, setActiveSection] = useState('markets')
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [watchlistExpanded, setWatchlistExpanded] = useState(false)
  const [searching, setSearching] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [marketSnap, setMarketSnap] = useState<StockQuote[]>([])
  const [snapLoaded, setSnapLoaded] = useState(false)
  const [snapCounted, setSnapCounted] = useState(false)
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({})
  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null)
  const [activeCardSymbol, setActiveCardSymbol] = useState<string | null>(null)
  const [showAllIdeas, setShowAllIdeas] = useState(false)
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null)

  // Global search
  const [globalSearch, setGlobalSearch] = useState('')
  const [globalResults, setGlobalResults] = useState<SearchResult[]>([])
  const [globalSearching, setGlobalSearching] = useState(false)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const globalSearchTimeout = useRef<any>(null)

  // New state
  const [trendingGainers, setTrendingGainers] = useState<StockQuote[]>([])
  const [trendingLosers, setTrendingLosers] = useState<StockQuote[]>([])
  const [priceAlerts, setPriceAlerts] = useState<Record<string, number>>({})
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({})
  const [ideaProgress, setIdeaProgress] = useState<Record<string, string>>({})
  const [bookmarks, setBookmarks] = useState<Article[]>([])
  const [ideaPrompt, setIdeaPrompt] = useState('')
  const [likedIdeas, setLikedIdeas] = useState<Set<string>>(new Set())
  const [refinementText, setRefinementText] = useState('')
  const [showRefinement, setShowRefinement] = useState(false)

  const [goalSuggestions, setGoalSuggestions] = useState<GoalSuggestion[]>([])
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)
  const [goalRotation] = useState(0)


  const searchTimeout = useRef<any>(null)
  const longPressTimer = useRef<any>(null)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const dragInfo = useRef<{ symbol: string; startX: number; originalOrder: StockQuote[]; currentIndex: number } | null>(null)
  const dragOrderRef = useRef<StockQuote[] | null>(null)
  const [dragOrder, setDragOrder] = useState<StockQuote[] | null>(null)

  // Load localStorage state
  useEffect(() => {
    const key = userId || 'guest'
    try {
      const alerts = localStorage.getItem(`grow_alerts_${key}`)
      if (alerts) setPriceAlerts(JSON.parse(alerts))
      const shares = localStorage.getItem(`grow_shares_${key}`)
      if (shares) setShareCounts(JSON.parse(shares))
      const progress = localStorage.getItem(`grow_progress_${key}`)
      if (progress) setIdeaProgress(JSON.parse(progress))
      const bmarks = localStorage.getItem(`grow_bookmarks_${key}`)
      if (bmarks) setBookmarks(JSON.parse(bmarks))
    } catch { /* ignore */ }
  }, [userId])

  // Track whether we've done the initial watchlist fetch so the watchlist
  // effect doesn't duplicate it on mount.
  const initialFetchDoneRef = useRef(false)

  useEffect(() => {
    if (profileLoading) return
    initialFetchDoneRef.current = true
    fetchStocks(watchlist)
    fetchSnap()
    fetchTrending()
    // Live quotes are auto-fetched by ProfileContext on load; only refresh
    // here if they haven't come in yet.
    if (Object.keys(liveQuotes).length === 0) refreshLiveQuotes()
    if (incomeIdeas.length > 0) setIdeas(incomeIdeas)
    else if (profile) generateIdeas(profile)
    if (profile?.goals || profile?.financial_goals) {
      const goals = profile.goals || profile.financial_goals || []
      setGoalSuggestions(getGoalSuggestions(Array.isArray(goals) ? goals : [], goalRotation))
    }
  }, [profileLoading])

  // Poll market snap every 5 minutes instead of every 60 seconds
  useEffect(() => {
    const id = setInterval(fetchSnap, 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (snapLoaded && !snapCounted) setSnapCounted(true)
  }, [snapLoaded])

  useEffect(() => {
    // Skip the initial mount — the profileLoading effect already fetches.
    if (!initialFetchDoneRef.current) return
    if (!profileLoading && watchlist.length > 0) fetchStocks(watchlist)
  }, [watchlist])

  useEffect(() => {
    if (activeSection === 'saved') return
    fetchNews(activeSection, 1, true)
    setPage(1)
  }, [activeSection])


  const fetchSnap = async () => {
    try {
      const res = await fetch(`/api/stocks?symbols=${SNAP_SYMBOLS.join(',')}`)
      const data = await res.json()
      setMarketSnap(data.quotes || [])
      setSnapLoaded(true)
    } catch { }
  }

  const fetchTrending = async () => {
    try {
      const res = await fetch('/api/stocks?trending=1')
      const data = await res.json()
      setTrendingGainers(data.gainers || [])
      setTrendingLosers(data.losers || [])
    } catch { }
  }


  const generateIdeas = async (profileData?: any, opts?: { prompt?: string; selectedIdeas?: any[]; refinement?: string; excludedIdeas?: any[] }) => {
    const p = profileData || profile
    if (!p) return
    setLoadingIdeas(true)
    try {
      const res = await fetch('/api/money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_ideas', profile: p, ...opts })
      })
      const data = await res.json()
      const newIdeas = data.ideas || []
      setIdeas(newIdeas)
      await updateProfile({ income_ideas: newIdeas })
    } catch { }
    setLoadingIdeas(false)
  }

  const handleIdeaAsk = () => {
    setLikedIdeas(new Set())
    setShowRefinement(false)
    generateIdeas(undefined, { prompt: ideaPrompt || undefined })
  }

  const handleRefinement = () => {
    const selected = ideas.filter(idea => {
      const t = typeof idea === 'string' ? idea : idea.title
      return likedIdeas.has(t)
    })
    generateIdeas(undefined, {
      selectedIdeas: selected.length > 0 ? selected : undefined,
      refinement: refinementText || undefined,
      excludedIdeas: ideas,
    })
    setRefinementText('')
    setLikedIdeas(new Set())
    setShowRefinement(false)
  }

  const toggleLikedIdea = (title: string) => {
    setLikedIdeas(prev => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  const fetchNews = async (category: string, pageNum: number, reset = false) => {
    if (reset) setLoadingNews(true)
    else setLoadingMore(true)
    try {
      let newArticles: Article[] = []
      if (category === 'portfolio') {
        // Collect actual portfolio holdings first (most relevant), then fill from watchlist
        const holdingSymbols: string[] = []
        for (const asset of profile?.assets || []) {
          for (const pos of asset.positions || []) {
            if (pos.symbol && !holdingSymbols.includes(pos.symbol)) holdingSymbols.push(pos.symbol)
          }
        }
        const allSymbols = [...new Set([...holdingSymbols, ...watchlist])].slice(0, 8)

        if (allSymbols.length === 0) {
          newArticles = []
        } else {
          // Build terms: use "ticker OR company_name" pairs for each holding so both forms match
          const terms = allSymbols.map(sym => {
            const stock = stocks.find(s => s.symbol === sym)
            if (stock?.name) {
              const cleanName = stock.name.replace(/\s+(Inc\.?|Corp\.?|Ltd\.?|LLC\.?|Holdings?|Group|Co\.?|plc)$/i, '').trim()
              // Include both ticker and company name for precision
              return `(${sym} OR "${cleanName}")`
            }
            return sym
          })
          const q = terms.join(' OR ')
          const res = await fetch(`/api/news?q=${encodeURIComponent(q)}&page=${pageNum}`)
          const data = await res.json()
          newArticles = data.articles || []
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

  const handleGlobalSearch = (value: string) => {
    setGlobalSearch(value)
    clearTimeout(globalSearchTimeout.current)
    if (!value.trim()) { setGlobalResults([]); setGlobalSearchOpen(false); return }
    setGlobalSearchOpen(true)
    globalSearchTimeout.current = setTimeout(async () => {
      setGlobalSearching(true)
      try {
        const res = await fetch(`/api/stocks?search=${encodeURIComponent(value)}`)
        const data = await res.json()
        setGlobalResults(data.results || [])
      } catch { }
      setGlobalSearching(false)
    }, 350)
  }

  const openSearchResult = async (symbol: string) => {
    setGlobalSearch('')
    setGlobalResults([])
    setGlobalSearchOpen(false)
    try {
      const res = await fetch(`/api/stocks?symbols=${symbol}`)
      const data = await res.json()
      const quote = data.quotes?.[0]
      if (quote) setSelectedStock(quote)
    } catch { }
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

  const openTickerDetail = async (symbol: string) => {
    const upper = symbol.toUpperCase().trim()
    // Check if already in watchlist stocks
    const existing = stocks.find(s => s.symbol === upper)
    if (existing) { setSelectedStock(existing); return }
    try {
      const res = await fetch(`/api/stocks?symbols=${upper}`)
      const data = await res.json()
      const quote = data.quotes?.[0]
      if (quote) setSelectedStock(quote)
    } catch { }
  }

  const removeFromWatchlist = async (symbol: string) => {
    const newList = watchlist.filter(s => s !== symbol)
    setStocks(prev => prev.filter(s => s.symbol !== symbol))
    setActiveCardSymbol(null)
    await updateProfile({ watchlist: newList })
  }

  const toggleSaved = async (idea: any) => {
    const key = typeof idea === 'string' ? idea : idea.title
    const newSaved = savedIdeas.includes(key) ? savedIdeas.filter(i => i !== key) : [...savedIdeas, key]
    await updateProfile({ saved_income_ideas: newSaved })
  }

  const openIdeaChat = async (idea: any) => {
    if (!userId) return
    const ideaTitle = typeof idea === 'string' ? idea : idea.title
    const ideaDesc = typeof idea === 'string' ? '' : idea.description
    const key = `money_idea_${ideaTitle.slice(0, 30)}`
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data } = await supabase.from('chats').insert({ user_id: userId, title: ideaTitle.slice(0, 40), topic: 'general', messages: [] }).select().single()
    if (data) {
      await updateProfile({ chat_refs: { ...chatRefs, [key]: data.id } })
      const prompt = `I want to do a deep dive on this income idea: "${ideaTitle}"${ideaDesc ? `\n\n${ideaDesc}` : ''}

Please give me a thorough breakdown:
1. Why this specifically fits my situation and background
2. Realistic income expectations — what I'd likely earn in month 1, month 3, month 6, and year 1
3. Barriers to entry — what makes this hard and how to get past them
4. Startup costs and capital I'd need upfront and ongoing
5. The exact 5 steps to get started this week
6. What separates people who succeed at this vs those who don't
7. Common mistakes and pitfalls to avoid`
      navigate(`/chat/${data.id}`, { state: { prompt } })
    }
  }

  const handleCardPointerDown = (e: React.PointerEvent, symbol: string) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
    longPressTimer.current = setTimeout(() => {
      setActiveCardSymbol(symbol)
      const idx = stocks.findIndex(s => s.symbol === symbol)
      const originalOrder = [...stocks]
      dragInfo.current = { symbol, startX: e.clientX, originalOrder, currentIndex: idx }
      dragOrderRef.current = originalOrder
      setDragOrder(originalOrder)
    }, 500)
  }

  const handleCardPointerMove = (e: React.PointerEvent) => {
    if (!pointerDownPos.current) return
    const dx = e.clientX - pointerDownPos.current.x
    const dy = Math.abs(e.clientY - pointerDownPos.current.y)
    if (!dragInfo.current && (Math.abs(dx) > 8 || dy > 8)) {
      clearTimeout(longPressTimer.current)
      pointerDownPos.current = null
      return
    }
    if (dragInfo.current) {
      const { symbol, startX, originalOrder } = dragInfo.current
      const CARD_WIDTH = 140
      const shift = Math.round((e.clientX - startX) / CARD_WIDTH)
      const origIdx = originalOrder.findIndex(s => s.symbol === symbol)
      const newIdx = Math.max(0, Math.min(originalOrder.length - 1, origIdx + shift))
      if (newIdx !== dragInfo.current.currentIndex) {
        dragInfo.current.currentIndex = newIdx
        const arr = [...originalOrder]
        const [item] = arr.splice(origIdx, 1)
        arr.splice(newIdx, 0, item)
        dragOrderRef.current = arr
        setDragOrder(arr)
      }
    }
  }

  const handleCardPointerUp = async () => {
    clearTimeout(longPressTimer.current)
    pointerDownPos.current = null
    if (dragInfo.current) {
      const finalOrder = dragOrderRef.current
      dragInfo.current = null
      dragOrderRef.current = null
      setDragOrder(null)
      setActiveCardSymbol(null)
      if (finalOrder) {
        setStocks(finalOrder)
        await updateProfile({ watchlist: finalOrder.map(s => s.symbol) })
      }
    }
  }

  const savePriceAlert = (symbol: string, price: number | null) => {
    const key = userId || 'guest'
    const next = { ...priceAlerts }
    if (price === null) delete next[symbol]
    else next[symbol] = price
    setPriceAlerts(next)
    localStorage.setItem(`grow_alerts_${key}`, JSON.stringify(next))
  }

  const saveShareCount = (symbol: string, shares: number) => {
    const key = userId || 'guest'
    const next = { ...shareCounts, [symbol]: shares }
    if (shares === 0) delete next[symbol]
    setShareCounts(next)
    localStorage.setItem(`grow_shares_${key}`, JSON.stringify(next))
  }

  const saveIdeaProgress = (idea: string, status: string) => {
    const key = userId || 'guest'
    const next = { ...ideaProgress, [idea]: status }
    setIdeaProgress(next)
    localStorage.setItem(`grow_progress_${key}`, JSON.stringify(next))
  }

  const toggleBookmark = (article: Article) => {
    const key = userId || 'guest'
    const exists = bookmarks.some(b => b.url === article.url)
    const next = exists ? bookmarks.filter(b => b.url !== article.url) : [...bookmarks, article]
    setBookmarks(next)
    localStorage.setItem(`grow_bookmarks_${key}`, JSON.stringify(next))
  }

  const isBookmarked = (url: string) => bookmarks.some(b => b.url === url)

  const isVisible = (id: string) => !preferences.hiddenSections.includes(id)
  const visibleIdeas = ideas.slice(0, showAllIdeas ? ideas.length : 4)

  // Portfolio total calculation
  const portfolioValue = stocks.reduce((sum, s) => sum + (s.price * (shareCounts[s.symbol] || 0)), 0)
  const portfolioDailyChange = stocks.reduce((sum, s) => sum + (s.change * (shareCounts[s.symbol] || 0)), 0)
  const hasPortfolio = portfolioValue > 0

  const displayedArticles = activeSection === 'saved' ? bookmarks : articles

  return (
    <div className="page" style={{ paddingTop: '0' }} onClick={() => { setActiveCardSymbol(null); setGlobalSearchOpen(false) }}>

      {/* Header */}
      <div style={{ padding: '52px 0 12px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '300', color: 'var(--sand-900)', margin: '0', letterSpacing: '-0.5px' }}>Grow</h1>
      </div>

      {/* Global Search Bar */}
      <div style={{ marginBottom: '16px', position: 'relative' }} onClick={e => e.stopPropagation()}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-400)', pointerEvents: 'none', display: 'flex' }}><Search size={14} strokeWidth={1.5} /></span>
          <input
            value={globalSearch}
            onChange={e => handleGlobalSearch(e.target.value)}
            onFocus={() => globalSearch.trim() && setGlobalSearchOpen(true)}
            placeholder="Search stocks, ETFs, crypto..."
            style={{ width: '100%', paddingLeft: '36px', paddingRight: globalSearch ? '36px' : '12px', boxSizing: 'border-box' }}
          />
          {globalSearch && (
            <button
              onClick={() => { setGlobalSearch(''); setGlobalResults([]); setGlobalSearchOpen(false) }}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'var(--sand-300)', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', fontSize: '11px', color: 'var(--sand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              ×
            </button>
          )}
        </div>
        {globalSearchOpen && (globalResults.length > 0 || globalSearching) && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', overflow: 'hidden', zIndex: 30, marginTop: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
            {globalSearching ? (
              <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--sand-500)' }}>Searching...</div>
            ) : globalResults.map(r => (
              <button key={r.symbol} onClick={() => openSearchResult(r.symbol)}
                style={{ width: '100%', padding: '11px 16px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--sand-200)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'inherit' }}>
                <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--sand-900)' }}>{r.symbol}</span>
                <span style={{ fontSize: '12px', color: 'var(--sand-500)', maxWidth: '65%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Biggest Movers Ticker Tape */}
      {(trendingGainers.length > 0 || trendingLosers.length > 0) && (() => {
        const allMovers = [...trendingGainers, ...trendingLosers]
        // Duplicate for seamless loop
        const tickerItems = [...allMovers, ...allMovers]
        const duration = allMovers.length * 4
        return (
          <div style={{ margin: '0 -16px', marginBottom: '20px', overflow: 'hidden', borderTop: '0.5px solid var(--sand-200)', borderBottom: '0.5px solid var(--sand-200)', background: 'var(--sand-100)' }}>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <div style={{ flexShrink: 0, padding: '7px 12px', borderRight: '0.5px solid var(--sand-200)', background: 'var(--sand-200)', display: 'flex', alignItems: 'center' }}>
                <p style={{ fontSize: '8px', fontWeight: '800', color: 'var(--sand-600)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase', writingMode: 'horizontal-tb' }}>TOP MOVERS</p>
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ display: 'flex', animation: `tickerScroll ${duration}s linear infinite`, width: 'max-content' }}>
                  {tickerItems.map((stock, idx) => {
                    const isPos = stock.change >= 0
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedStock(stock)}
                        style={{ flexShrink: 0, padding: '7px 16px', background: 'none', border: 'none', borderRight: '0.5px solid var(--sand-200)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--sand-800)', letterSpacing: '0.02em' }}>{stock.symbol}</span>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: isPos ? 'var(--success)' : 'var(--danger)' }}>
                          {isPos ? '▲' : '▼'} {isPos ? '+' : ''}{(parseFloat(stock.changePercent) || 0).toFixed(2)}%
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>${(stock.price ?? 0).toFixed(2)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ flexShrink: 0, padding: '7px 12px', borderLeft: '0.5px solid var(--sand-200)', background: 'var(--sand-200)', display: 'flex', alignItems: 'center' }}>
                <p style={{ fontSize: '8px', fontWeight: '800', color: 'var(--sand-600)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase', writingMode: 'horizontal-tb' }}>TOP MOVERS</p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'var(--sand-200)', borderRadius: '12px', padding: '3px', marginBottom: '20px' }}>
        {([
          { id: 'holdings' as const, label: 'Holdings' },
          { id: 'ideas' as const, label: 'Ideas' },
          { id: 'news' as const, label: 'News' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveGrowTab(t.id)}
            style={{
              flex: 1, padding: '9px 6px', border: 'none', borderRadius: '9px',
              background: activeGrowTab === t.id ? 'var(--sand-50)' : 'transparent',
              color: activeGrowTab === t.id ? 'var(--sand-900)' : 'var(--sand-600)',
              fontSize: '13px', fontWeight: activeGrowTab === t.id ? '600' : '400',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              boxShadow: activeGrowTab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── HOLDINGS TAB ── */}
      {activeGrowTab === 'holdings' && (
      <div className="animate-fade">

      {/* Growth Section */}
      <GrowthSection
        profile={profile}
        analysis={analysis}
        ideaProgress={ideaProgress}
        navigate={navigate}
        liveQuotes={liveQuotes}
        liveQuotesLoading={liveQuotesLoading}
        refreshLiveQuotes={refreshLiveQuotes}
        updateProfile={updateProfile}
        onSelectStock={openTickerDetail}
      />

      {/* Watchlist */}
      {isVisible('watchlist') && (
        <div className="animate-fade" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p className="label">Watchlist</p>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {stocks.length > 0 && (
                <button className="btn-ghost" onClick={() => setWatchlistExpanded(v => !v)} style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {watchlistExpanded ? 'Collapse' : 'Expand'}
                </button>
              )}
              <button className="btn-ghost" onClick={e => { e.stopPropagation(); setShowSearch(!showSearch) }} style={{ fontSize: '11px', padding: '3px 8px' }}>
                {showSearch ? 'Done' : '+ Add'}
              </button>
            </div>
          </div>

          {/* Portfolio total card */}
          {hasPortfolio && (
            <div className="card-muted animate-fade" style={{ padding: '12px 14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p className="label" style={{ fontSize: '9px', marginBottom: '2px' }}>Portfolio Total</p>
                <p style={{ fontSize: '20px', fontWeight: '300', color: 'var(--sand-900)', margin: 0, letterSpacing: '-0.5px' }}>
                  ${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="label" style={{ fontSize: '9px', marginBottom: '2px' }}>Today</p>
                <p style={{ fontSize: '16px', fontWeight: '500', margin: 0, color: portfolioDailyChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {portfolioDailyChange >= 0 ? '+' : ''}${portfolioDailyChange.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {showSearch && (
            <div className="animate-fade" style={{ marginBottom: '10px', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <input value={searchQuery} onChange={e => handleSearch(e.target.value)} placeholder="Search any stock, ETF, fund..." autoFocus />
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

          {watchlistExpanded ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {(dragOrder ?? stocks).map(stock => {
                const isPos = stock.change >= 0
                const isActive = activeCardSymbol === stock.symbol
                const alert = priceAlerts[stock.symbol]
                const alertNear = alert && Math.abs(stock.price - alert) / alert < 0.05
                const alertHit = alert && stock.price >= alert
                return (
                  <div key={stock.symbol} style={{ position: 'relative' }}
                    onMouseEnter={() => setActiveCardSymbol(stock.symbol)}
                    onMouseLeave={() => setActiveCardSymbol(null)}
                  >
                    <button
                      onClick={() => setSelectedStock(stock)}
                      style={{ width: '100%', background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', padding: '12px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--sand-900)', margin: '0 0 2px' }}>{stock.symbol}</p>
                        <p style={{ fontSize: '15px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 1px' }}>${stock.price?.toFixed(2)}</p>
                        <p style={{ fontSize: '11px', color: isPos ? 'var(--success)' : 'var(--danger)', margin: 0 }}>{isPos ? '+' : ''}{parseFloat(stock.changePercent)?.toFixed(2)}%</p>
                        {alert && (
                          <p style={{ fontSize: '10px', margin: '3px 0 0', color: alertHit ? 'var(--success)' : alertNear ? '#c8943a' : 'var(--sand-400)' }}>
                            {alertHit ? '● ' : alertNear ? '◐ ' : '○ '}${alert}
                          </p>
                        )}
                        {shareCounts[stock.symbol] > 0 && (
                          <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: '2px 0 0' }}>{shareCounts[stock.symbol]} sh</p>
                        )}
                      </div>
                      {sparklines[stock.symbol]?.length > 1 && (
                        <svg width="60" height="28" style={{ flexShrink: 0, overflow: 'visible' }}>
                          <path d={buildSparkPath(sparklines[stock.symbol], 60, 26)} fill="none" stroke={isPos ? 'var(--success)' : 'var(--danger)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); removeFromWatchlist(stock.symbol) }}
                      style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', background: 'var(--sand-700)', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none', transition: 'opacity 0.15s' }}>
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              style={{ display: 'flex', gap: '8px', overflowX: dragOrder ? 'hidden' : 'auto', paddingBottom: '4px', touchAction: dragOrder ? 'none' : 'pan-x' }}
              onPointerMove={handleCardPointerMove}
              onPointerUp={handleCardPointerUp}
              onPointerCancel={handleCardPointerUp}
            >
              {(dragOrder ?? stocks).map(stock => {
                const isPos = stock.change >= 0
                const isActive = activeCardSymbol === stock.symbol
                const isDragging = isActive && !!dragInfo.current
                const alert = priceAlerts[stock.symbol]
                const alertNear = alert && Math.abs(stock.price - alert) / alert < 0.05
                const alertHit = alert && stock.price >= alert
                return (
                  <div
                    key={stock.symbol}
                    style={{ position: 'relative', flexShrink: 0, transition: isDragging ? 'none' : 'transform 0.15s', transform: isDragging ? 'scale(1.06)' : 'scale(1)', zIndex: isDragging ? 10 : 1, boxShadow: isDragging ? '0 6px 16px rgba(0,0,0,0.13)' : 'none', borderRadius: 'var(--radius-md)' }}
                    onMouseEnter={() => { if (!dragInfo.current) setActiveCardSymbol(stock.symbol) }}
                    onMouseLeave={() => { if (!dragInfo.current) setActiveCardSymbol(null) }}
                    onPointerDown={e => handleCardPointerDown(e, stock.symbol)}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setSelectedStock(stock)}
                      style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', padding: '12px 14px', minWidth: '120px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'transform var(--transition)', transform: isActive ? 'scale(0.97)' : 'scale(1)' }}>
                      <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 4px' }}>{stock.symbol}</p>
                      <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 2px' }}>${stock.price?.toFixed(2)}</p>
                      <p style={{ fontSize: '11px', color: isPos ? 'var(--success)' : 'var(--danger)', margin: 0 }}>{isPos ? '+' : ''}{parseFloat(stock.changePercent)?.toFixed(2)}%</p>
                      {alert && (
                        <p style={{ fontSize: '10px', margin: '3px 0 0', color: alertHit ? 'var(--success)' : alertNear ? '#c8943a' : 'var(--sand-400)' }}>
                          {alertHit ? '● ' : alertNear ? '◐ ' : '○ '}${alert}
                        </p>
                      )}
                      {shareCounts[stock.symbol] > 0 && (
                        <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: '2px 0 0' }}>
                          {shareCounts[stock.symbol]} sh
                        </p>
                      )}
                      {sparklines[stock.symbol]?.length > 1 && (
                        <svg width="90" height="20" style={{ display: 'block', marginTop: '8px', overflow: 'visible' }}>
                          <path d={buildSparkPath(sparklines[stock.symbol], 90, 18)} fill="none" stroke={isPos ? 'var(--success)' : 'var(--danger)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); removeFromWatchlist(stock.symbol) }}
                      style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', background: 'var(--sand-700)', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none', transition: 'opacity 0.15s' }}>
                      ×
                    </button>
                  </div>
                )
              })}
              {stocks.length === 0 && (
                <p style={{ color: 'var(--sand-500)', fontSize: '13px', padding: '12px 0' }}>Add stocks to your watchlist</p>
              )}
            </div>
          )}
          {stocks.length > 0 && !hasPortfolio && (
            <p style={{ fontSize: '11px', color: 'var(--sand-400)', marginTop: '6px' }}>
              Tap a stock to add shares and track your portfolio value
            </p>
          )}
        </div>
      )}


</div>
      )} {/* end holdings tab */}

      {/* ── IDEAS TAB ── */}
      {activeGrowTab === 'ideas' && (
      <div className="animate-fade">

      {/* Goal-Aligned Strategy */}
      {goalSuggestions.length > 0 && (
        <div className="animate-fade" style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <p className="label" style={{ marginBottom: '2px' }}>Goal-Aligned Strategy</p>
              <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>
                Investment ideas tailored to each of your {goalSuggestions.length} active goal{goalSuggestions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {goalSuggestions.map((gs, i) => {
              const isOpen = expandedGoal === gs.goal
              const totalIdeas = gs.ideas.length
              return (
                <div key={i} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                  {/* Goal header — always visible */}
                  <div
                    onClick={() => setExpandedGoal(isOpen ? null : gs.goal)}
                    style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                        <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sand-900)', margin: 0 }}>{gs.goal}</p>
                        <span style={{ fontSize: '10px', color: 'var(--sand-500)', background: 'var(--sand-200)', padding: '1px 7px', borderRadius: '20px', fontWeight: '500', flexShrink: 0 }}>{gs.timeline}</span>
                        {gs.target && (
                          <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'var(--sand-100)', padding: '1px 7px', borderRadius: '20px', fontWeight: '600', flexShrink: 0, border: '0.5px solid var(--sand-200)' }}>
                            ${gs.target.toLocaleString()} target
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--sand-700)', margin: 0, lineHeight: '1.5' }}>{gs.strategy}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {[...new Set(gs.ideas.map(i => i.type))].slice(0, 4).map(type => (
                            <div key={type} title={IDEA_TYPE_META[type].label} style={{ width: '8px', height: '8px', borderRadius: '50%', background: IDEA_TYPE_META[type].color }} />
                          ))}
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--sand-400)', fontWeight: '500' }}>{totalIdeas} idea{totalIdeas !== 1 ? 's' : ''}</span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--sand-400)', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </div>
                  </div>

                  {/* Expanded ideas */}
                  {isOpen && (
                    <div className="animate-fade" style={{ borderTop: '0.5px solid var(--sand-200)' }}>
                      {gs.ideas.map((idea, j) => {
                        const typeMeta = IDEA_TYPE_META[idea.type]
                        const riskMeta = RISK_META[idea.risk]
                        return (
                          <div
                            key={j}
                            style={{
                              padding: '12px 16px',
                              borderBottom: j < gs.ideas.length - 1 ? '0.5px solid var(--sand-200)' : 'none',
                              display: 'flex', flexDirection: 'column', gap: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--sand-900)' }}>{idea.name}</span>
                                <span style={{ fontSize: '9px', fontWeight: '700', color: typeMeta.color, background: typeMeta.bg, padding: '2px 7px', borderRadius: '20px', letterSpacing: '0.04em' }}>{typeMeta.label}</span>
                                <span style={{ fontSize: '9px', fontWeight: '700', color: riskMeta.color, background: riskMeta.bg, padding: '2px 7px', borderRadius: '20px' }}>{idea.risk} risk</span>
                              </div>
                              {idea.ticker && (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                  <button
                                    onClick={() => openTickerDetail(idea.ticker!)}
                                    style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', border: '0.5px solid var(--sand-300)', background: 'var(--sand-900)', color: 'var(--sand-50)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                    {idea.ticker}
                                  </button>
                                  <button
                                    onClick={() => addToWatchlist(idea.ticker!)}
                                    style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', border: '0.5px solid var(--sand-300)', background: 'var(--sand-100)', color: 'var(--sand-700)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                    + Watch
                                  </button>
                                </div>
                              )}
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--sand-600)', margin: 0, lineHeight: '1.55' }}>{idea.reason}</p>
                            {idea.action && !idea.ticker && (
                              <p style={{ fontSize: '11px', color: 'var(--accent)', margin: 0, fontWeight: '500' }}>→ {idea.action}</p>
                            )}
                          </div>
                        )
                      })}
                      <div style={{ padding: '8px 16px', borderTop: '0.5px solid var(--sand-200)' }}>
                        <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: 0 }}>AI-generated suggestions. Not financial advice — consult a financial advisor.</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Income Ideas */}
      {isVisible('income') && (
        <div className="animate-fade stagger-2" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p className="label">Income Ideas</p>
            <button className="btn-ghost" onClick={() => navigate('/money')} style={{ fontSize: '11px', padding: '3px 8px' }}>Saved ({savedIdeas.length})</button>
          </div>

          {/* Prompt input */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '6px' }}>
              {[
                { label: 'Passive', value: 'passive income ideas that require minimal ongoing work' },
                { label: 'Skill-based', value: 'ideas that leverage my professional skills and expertise' },
                { label: 'Digital', value: 'online or digital income ideas I can run from anywhere' },
                { label: 'Business', value: 'business or entrepreneurship ideas' },
                { label: 'Low effort', value: 'low effort ideas under 5 hours per week' },
                { label: 'High income', value: 'ideas with the highest income potential' },
              ].map(chip => (
                <button
                  key={chip.label}
                  onClick={() => setIdeaPrompt(ideaPrompt === chip.value ? '' : chip.value)}
                  style={{
                    flexShrink: 0, padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '500',
                    cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid var(--sand-300)', transition: 'all 0.15s',
                    background: ideaPrompt === chip.value ? 'var(--accent)' : 'var(--sand-100)',
                    color: ideaPrompt === chip.value ? 'var(--sand-50)' : 'var(--sand-600)',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={ideaPrompt}
                onChange={e => setIdeaPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loadingIdeas && handleIdeaAsk()}
                placeholder="What kind of income ideas are you looking for?"
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px',
                  border: '0.5px solid var(--sand-300)', background: 'var(--sand-100)', color: 'var(--sand-900)',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={handleIdeaAsk}
                disabled={loadingIdeas}
                style={{
                  padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                  background: 'var(--accent)', color: 'var(--sand-50)', flexShrink: 0,
                  opacity: loadingIdeas ? 0.5 : 1,
                }}
              >
                {loadingIdeas ? '...' : 'Generate'}
              </button>
            </div>
          </div>

          {/* Ideas list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {loadingIdeas ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', height: '72px', animation: 'pulse 1.5s infinite' }} />
              ))
            ) : visibleIdeas.map((idea, i) => {
              const ideaTitle = typeof idea === 'string' ? idea : idea.title
              const ideaDesc = typeof idea === 'string' ? '' : idea.description
              const ideaRange = typeof idea === 'string' ? '' : idea.monthly_range
              const ideaTimeline = typeof idea === 'string' ? '' : idea.timeline
              const isExpanded = expandedIdea === ideaTitle
              const tags = getIdeaTags(idea)
              const progress = ideaProgress[ideaTitle]
              const progressOpt = PROGRESS_OPTIONS.find(p => p.key === progress)
              const isLiked = likedIdeas.has(ideaTitle)
              return (
                <div
                  key={i}
                  className="card"
                  onClick={() => setExpandedIdea(isExpanded ? null : ideaTitle)}
                  style={{ padding: '14px', cursor: 'pointer', animationDelay: `${i * 0.05}s`, transition: 'all var(--transition)', userSelect: 'none', border: isLiked ? '1px solid var(--accent-border)' : undefined, background: isLiked ? 'var(--accent-light)' : undefined }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: (tags.length > 0 || ideaRange) ? '6px' : '0' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
                      {tags.map(tag => (
                        <span key={tag.label} style={{ fontSize: '9px', fontWeight: '700', color: tag.color, background: tag.bg, padding: '2px 7px', borderRadius: '20px', letterSpacing: '0.04em' }}>
                          {tag.label}
                        </span>
                      ))}
                      {ideaRange && (
                        <span style={{ fontSize: '9px', fontWeight: '700', color: '#7a9e6e', background: 'rgba(122,158,110,0.12)', padding: '2px 7px', borderRadius: '20px', letterSpacing: '0.04em' }}>
                          {ideaRange}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0, marginLeft: '4px' }}>
                      {showRefinement && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleLikedIdea(ideaTitle) }}
                          style={{
                            width: '20px', height: '20px', borderRadius: '50%', fontSize: '10px', fontWeight: '700',
                            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `0.5px solid ${isLiked ? 'var(--accent)' : 'var(--sand-300)'}`,
                            background: isLiked ? 'var(--accent)' : 'var(--sand-100)',
                            color: isLiked ? 'var(--sand-50)' : 'var(--sand-400)', transition: 'all 0.15s',
                          }}
                        >
                          ✓
                        </button>
                      )}
                      {progressOpt && (
                        <span style={{ fontSize: '9px', fontWeight: '700', color: progressOpt.color, background: progressOpt.bg, padding: '2px 7px', borderRadius: '20px', letterSpacing: '0.04em' }}>
                          {progressOpt.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: ideaDesc ? '600' : '400', color: 'var(--sand-900)', margin: '0', lineHeight: '1.4' }}>
                    {ideaTitle}
                  </p>
                  {ideaDesc && (
                    <p style={{
                      fontSize: '12px', color: 'var(--sand-600)', margin: '3px 0 0', lineHeight: '1.5',
                      display: isExpanded ? 'block' : '-webkit-box',
                      WebkitLineClamp: isExpanded ? undefined : 2,
                      WebkitBoxOrient: isExpanded ? undefined : 'vertical' as any,
                      overflow: isExpanded ? 'visible' : 'hidden'
                    }}>
                      {ideaDesc}
                    </p>
                  )}
                  {isExpanded && (
                    <div className="animate-fade" onClick={e => e.stopPropagation()}>
                      {ideaTimeline && (
                        <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '8px 0 0', fontStyle: 'italic' }}>{ideaTimeline}</p>
                      )}
                      {/* Progress selector */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
                        {PROGRESS_OPTIONS.map(opt => (
                          <button
                            key={opt.key}
                            onClick={() => saveIdeaProgress(ideaTitle, opt.key)}
                            style={{
                              flex: 1, padding: '6px 4px', borderRadius: 'var(--radius-sm)', fontSize: '10px', fontWeight: '600',
                              cursor: 'pointer', fontFamily: 'inherit', border: `0.5px solid ${progress === opt.key ? opt.color : 'var(--sand-300)'}`,
                              background: progress === opt.key ? opt.bg : 'var(--sand-100)',
                              color: progress === opt.key ? opt.color : 'var(--sand-500)', transition: 'all 0.15s'
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <button
                          onClick={() => toggleSaved(idea)}
                          style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', border: '0.5px solid var(--sand-300)', background: savedIdeas.includes(ideaTitle) ? 'rgba(200,148,58,0.1)' : 'var(--sand-100)', color: savedIdeas.includes(ideaTitle) ? 'var(--warning)' : 'var(--sand-700)' }}>
                          {savedIdeas.includes(ideaTitle) ? 'Saved' : 'Save'}
                        </button>
                        <button
                          onClick={() => openIdeaChat(idea)}
                          style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', color: 'var(--accent)' }}>
                          Explore with AI
                        </button>
                      </div>
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
            <button className="btn-ghost" onClick={() => setShowAllIdeas(!showAllIdeas)} style={{ width: '100%', marginTop: '6px', fontSize: '12px' }}>
              {showAllIdeas ? '▲ Show less' : `▼ Show ${ideas.length - 4} more idea${ideas.length - 4 > 1 ? 's' : ''}`}
            </button>
          )}

          {/* Refinement chat */}
          {ideas.length > 0 && !loadingIdeas && (
            <div style={{ marginTop: '10px' }}>
              {!showRefinement ? (
                <button
                  className="btn-ghost"
                  onClick={() => setShowRefinement(true)}
                  style={{ width: '100%', fontSize: '12px', color: 'var(--sand-500)' }}
                >
                  ↺ Refine these ideas
                </button>
              ) : (
                <div className="animate-fade" style={{ background: 'var(--sand-100)', borderRadius: 'var(--radius-md)', padding: '12px', border: '0.5px solid var(--sand-300)' }}>
                  {likedIdeas.size > 0 && (
                    <p style={{ fontSize: '11px', color: 'var(--accent)', margin: '0 0 8px', fontWeight: '600' }}>
                      {likedIdeas.size} idea{likedIdeas.size > 1 ? 's' : ''} selected — AI will generate ideas in that direction
                    </p>
                  )}
                  {likedIdeas.size === 0 && (
                    <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '0 0 8px' }}>
                      Tap ✓ on ideas you like, or just describe what you want below
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      value={refinementText}
                      onChange={e => setRefinementText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !loadingIdeas && handleRefinement()}
                      placeholder='e.g. "more passive", "use my tech skills", "lower startup cost"'
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px',
                        border: '0.5px solid var(--sand-300)', background: 'var(--card)', color: 'var(--sand-900)',
                        fontFamily: 'inherit', outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleRefinement}
                      disabled={loadingIdeas || (likedIdeas.size === 0 && !refinementText.trim())}
                      style={{
                        padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: '600',
                        cursor: 'pointer', fontFamily: 'inherit', border: 'none', flexShrink: 0,
                        background: 'var(--accent)', color: 'var(--sand-50)',
                        opacity: (loadingIdeas || (likedIdeas.size === 0 && !refinementText.trim())) ? 0.4 : 1,
                      }}
                    >
                      Regenerate
                    </button>
                  </div>
                  <button
                    onClick={() => { setShowRefinement(false); setLikedIdeas(new Set()); setRefinementText('') }}
                    style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--sand-400)', cursor: 'pointer', marginTop: '6px', padding: 0, fontFamily: 'inherit' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      </div>
      )} {/* end ideas tab */}

      {/* ── MARKETS TAB ── */}
      {activeGrowTab === 'news' && (
      <div className="animate-fade">

      {/* News */}
      <div style={{ marginBottom: '24px' }}>
        {/* Section tabs */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '10px' }}>
          {NEWS_SECTIONS.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              style={{ flexShrink: 0, padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', background: activeSection === s.key ? 'var(--accent)' : 'var(--sand-200)', color: activeSection === s.key ? 'var(--sand-50)' : 'var(--sand-600)', border: 'none', transition: 'all 0.2s' }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Saved empty state */}
        {activeSection === 'saved' && bookmarks.length === 0 && (
          <div className="card-muted animate-fade" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--sand-600)', margin: 0 }}>Bookmark articles to read later</p>
          </div>
        )}

        {/* Articles list */}
        {(activeSection !== 'saved' ? loadingNews : false) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', height: '80px', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : displayedArticles.length > 0 ? (
          <div className="card" style={{ padding: '4px 0' }}>
            {displayedArticles.map((article, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 16px', borderBottom: i < displayedArticles.length - 1 ? '0.5px solid var(--sand-200)' : 'none', alignItems: 'flex-start' }}>
                <div style={{ width: '60px', height: '52px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: 'var(--sand-200)' }}>
                  {article.image && (
                    <img src={article.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                  )}
                </div>
                <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
                  <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 3px', lineHeight: '1.4' }}>{article.title}</p>
                  {article.description && (
                    <p style={{ fontSize: '11px', color: 'var(--sand-600)', margin: '0 0 4px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
                      {article.description}
                    </p>
                  )}
                  <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: 0 }}>{article.source} · {timeAgo(article.publishedAt)}</p>
                </a>
                <button
                  onClick={() => toggleBookmark(article)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 0', flexShrink: 0, fontSize: '16px', color: isBookmarked(article.url) ? 'var(--accent)' : 'var(--sand-300)', lineHeight: 1 }}>
                  {isBookmarked(article.url) ? '★' : '☆'}
                </button>
              </div>
            ))}
            {hasMore && activeSection !== 'saved' && (
              <div style={{ padding: '12px 16px', textAlign: 'center' }}>
                <button onClick={() => { const next = page + 1; setPage(next); fetchNews(activeSection, next) }} disabled={loadingMore} className="btn-ghost" style={{ fontSize: '12px' }}>
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      </div>
      )} {/* end news tab */}

      {/* Stock detail sheet */}
      {selectedStock && (
        <StockDetail
          quote={selectedStock}
          onClose={() => setSelectedStock(null)}
          alertPrice={priceAlerts[selectedStock.symbol]}
          onSetAlert={price => savePriceAlert(selectedStock.symbol, price)}
          sharesOwned={shareCounts[selectedStock.symbol] || 0}
          onSetShares={shares => saveShareCount(selectedStock.symbol, shares)}
          profile={profile}
        />
      )}
    </div>
  )
}
