import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { useProfile } from '../contexts/ProfileContext'
import NetWorthChart from '../components/NetWorthChart'
import { formatAIText } from '../lib/formatAIText'

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

interface MiniDashboard {
  type: 'assets' | 'debts' | 'savings'
  analysis: string
  loading: boolean
}

const MILESTONES = [10000, 25000, 50000, 100000, 250000, 500000, 1000000]

function getMilestoneKey(netWorth: number) {
  const hit = MILESTONES.filter(m => netWorth >= m)
  return hit.length > 0 ? `milestone_${hit[hit.length - 1]}` : null
}

function computeHealthScore(analysis: Analysis, profile: any) {
  const sr = analysis.savingsRate || 0
  const savingsScore = sr >= 20 ? 30 : sr >= 15 ? 24 : sr >= 10 ? 18 : sr >= 5 ? 10 : 3

  const totalDebtPmt = profile?.debts?.reduce((s: number, d: any) => s + (d.minimum_payment || 0), 0) || 0
  const income = profile?.monthly_income || 0
  const debtRatio = income > 0 ? totalDebtPmt / income : 0
  const hasDebts = (profile?.debts?.length || 0) > 0
  const debtScore = !hasDebts ? 25 : debtRatio < 0.10 ? 22 : debtRatio < 0.20 ? 15 : debtRatio < 0.30 ? 8 : 2

  const liquid = profile?.assets?.filter((a: any) => a.category === 'savings').reduce((s: number, a: any) => s + (a.value || 0), 0) || 0
  const monthlyExp = profile?.monthly_expenses || 0
  const emoMonths = monthlyExp > 0 ? liquid / monthlyExp : 0
  const emergencyScore = emoMonths >= 6 ? 25 : emoMonths >= 3 ? 18 : emoMonths >= 1 ? 10 : 2

  const cats = new Set(profile?.assets?.map((a: any) => a.category) || [])
  const diversityScore = cats.size >= 4 ? 10 : cats.size >= 3 ? 8 : cats.size >= 2 ? 5 : cats.size >= 1 ? 3 : 0

  const goals = analysis.goals || []
  const avgGoal = goals.length > 0 ? goals.reduce((s: number, g: any) => s + Math.min(100, g.percentage || 0), 0) / goals.length : 50
  const goalScore = avgGoal >= 75 ? 10 : avgGoal >= 50 ? 7 : avgGoal >= 25 ? 4 : 2

  const total = Math.min(100, savingsScore + debtScore + emergencyScore + diversityScore + goalScore)
  return {
    score: total,
    label: total >= 80 ? 'Excellent' : total >= 65 ? 'Good' : total >= 45 ? 'Fair' : 'Needs work',
    color: total >= 80 ? 'var(--success)' : total >= 65 ? 'var(--accent)' : total >= 45 ? 'var(--warning)' : 'var(--danger)',
    breakdown: [
      { label: 'Savings rate', score: savingsScore, max: 30, note: `${Math.round(sr)}%` },
      { label: 'Debt load', score: debtScore, max: 25, note: hasDebts ? `${Math.round(debtRatio * 100)}% of income` : 'Debt-free' },
      { label: 'Emergency fund', score: emergencyScore, max: 25, note: `${emoMonths.toFixed(1)} months` },
      { label: 'Diversification', score: diversityScore, max: 10, note: `${cats.size} asset ${cats.size === 1 ? 'type' : 'types'}` },
      { label: 'Goal progress', score: goalScore, max: 10, note: goals.length > 0 ? `${Math.round(avgGoal)}% avg` : 'No goals set' },
    ]
  }
}

interface Insight {
  title: string
  text: string
  type: 'positive' | 'neutral' | 'warning'
  actions: string[]
  chatSeed: string
}

function generateInsights(analysis: Analysis, profile: any): Insight[] {
  const insights: Insight[] = []
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)

  const sr = Math.round(analysis.savingsRate || 0)
  const income = profile?.monthly_income || 0
  const gap = Math.round(income * 0.20 - (analysis.availableToSave || 0))
  if (sr >= 20) {
    insights.push({
      title: 'Savings Rate',
      text: `${sr}% savings rate — top tier. Most Americans save under 5%.`,
      type: 'positive',
      actions: [
        'Keep savings automated so lifestyle inflation doesn\'t erode this.',
        'Consider bumping to 25–30% if your retirement target is aggressive.',
        'Direct surplus to tax-advantaged accounts (Roth IRA, 401k) before taxable.'
      ],
      chatSeed: `My savings rate is ${sr}%, which is above the 20% benchmark. Help me understand how to maintain this and whether I should be doing more with this savings rate given my financial profile.`
    })
  } else if (sr >= 10) {
    insights.push({
      title: 'Savings Rate',
      text: `${sr}% savings rate. ${gap > 0 ? `Adding ${fmt(gap)}/mo reaches the 20% benchmark.` : 'Approaching the 20% target.'}`,
      type: 'neutral',
      actions: [
        gap > 0 ? `Find ${fmt(gap)}/mo to cut — subscriptions, dining out, and recurring charges are the fastest wins.` : 'You\'re close to 20% — one small adjustment could get you there.',
        'Automate your savings on payday before you can spend it.',
        'Track spending for 30 days to find where money actually goes.'
      ],
      chatSeed: `My savings rate is ${sr}%. I need to get to 20% — that's an extra ${fmt(Math.max(0, gap))}/mo. My income is ${fmt(income)}/mo. Help me find specific ways to close this gap based on my financial situation.`
    })
  } else {
    insights.push({
      title: 'Savings Rate',
      text: `${sr}% savings rate. Target 20%+ for serious wealth building.`,
      type: 'warning',
      actions: [
        'Do a spending audit — categorize every expense this month to find cuts.',
        'Even saving 1% more each month compounds dramatically over time.',
        'Look for income increases: side income, negotiating salary, or freelance work.'
      ],
      chatSeed: `My savings rate is only ${sr}%, which is below the recommended 20%. My monthly income is ${fmt(income)}. I need a concrete plan to increase my savings rate. What should I do first?`
    })
  }

  if ((analysis.totalLiabilities || 0) === 0) {
    insights.push({
      title: 'Debt',
      text: `Debt-free. Every dollar earned goes straight to building wealth.`,
      type: 'positive',
      actions: [
        'Stay debt-free by building a buffer before any large purchase.',
        'If you take on future debt (mortgage, car), keep payments under 28% of income.',
        'Consider investing the money you used to put toward debt payments.'
      ],
      chatSeed: `I'm completely debt-free. Help me make the most of this position — where should I be directing my money now that I have no debt payments eating into my income?`
    })
  } else {
    const highDebt = [...(analysis.debts || [])].sort((a, b) => b.interestRate - a.interestRate)[0]
    if (highDebt && highDebt.interestRate > 15) {
      insights.push({
        title: 'High-Interest Debt',
        text: `${highDebt.name} at ${highDebt.interestRate}% APR is costing you the most — tackle this first.`,
        type: 'warning',
        actions: [
          `Pay more than the minimum on ${highDebt.name} every month — even $50 extra saves significant interest.`,
          'Look into a balance transfer card (0% intro APR) to buy time while paying down principal.',
          'Use the avalanche method: minimum on everything, maximum on the highest-rate debt.'
        ],
        chatSeed: `I have a ${highDebt.name} with a ${highDebt.interestRate}% APR and a balance of ${fmt(highDebt.balance)}. This is my highest-interest debt. Give me a specific payoff plan and help me understand how much interest I'll save by attacking this aggressively.`
      })
    } else if (highDebt) {
      insights.push({
        title: 'Debt Payoff',
        text: `Highest-rate debt: ${highDebt.name} at ${highDebt.interestRate}% — ${highDebt.monthsToPayoff} months to payoff.`,
        type: 'neutral',
        actions: [
          `At ${highDebt.interestRate}%, compare whether paying extra beats investing the same amount.`,
          'Keep minimum payments current — missed payments hurt your credit score and add fees.',
          `${highDebt.monthsToPayoff} months is manageable — stay consistent and it\'s gone.`
        ],
        chatSeed: `I have a ${highDebt.name} at ${highDebt.interestRate}% with ${highDebt.monthsToPayoff} months left. Should I pay it down faster or invest instead? Help me think through the math based on my situation.`
      })
    }
  }

  const liquid = profile?.assets?.filter((a: any) => a.category === 'savings').reduce((s: number, a: any) => s + (a.value || 0), 0) || 0
  const monthlyExp = profile?.monthly_expenses || 0
  const emoMonths = monthlyExp > 0 ? liquid / monthlyExp : 0
  const target3mo = fmt(monthlyExp * 3)
  const target6mo = fmt(monthlyExp * 6)
  if (emoMonths < 1) {
    insights.push({
      title: 'Emergency Fund',
      text: `Emergency fund covers less than 1 month. This is your most urgent financial gap.`,
      type: 'warning',
      actions: [
        `Target ${target3mo} (3 months) as your first milestone — pause extra investing until you hit it.`,
        'Open a high-yield savings account (HYSA) separate from your checking.',
        'Automate a fixed transfer to savings on every payday, even if small.'
      ],
      chatSeed: `My emergency fund covers less than 1 month of expenses (${fmt(liquid)} saved, ${fmt(monthlyExp)}/mo in expenses). I need to build this to ${target3mo}–${target6mo}. Give me a step-by-step plan to build my emergency fund as fast as possible.`
    })
  } else if (emoMonths < 3) {
    insights.push({
      title: 'Emergency Fund',
      text: `${emoMonths.toFixed(1)}-month emergency fund. Advisors recommend 3–6 months.`,
      type: 'neutral',
      actions: [
        `You need ${fmt(monthlyExp * 3 - liquid)} more to hit 3 months — that's your next milestone.`,
        'Keep this in a high-yield savings account earning 4–5% APY, not a regular savings account.',
        'Don\'t invest new money aggressively until your fund hits 3 months.'
      ],
      chatSeed: `My emergency fund covers ${emoMonths.toFixed(1)} months (${fmt(liquid)}). I need to get to ${target3mo}–${target6mo}. Help me make a plan to build it up while also managing my other financial goals.`
    })
  } else if (emoMonths >= 6) {
    insights.push({
      title: 'Emergency Fund',
      text: `${Math.floor(emoMonths)}-month emergency fund — fully covered.`,
      type: 'positive',
      actions: [
        'Your emergency fund is solid — keep it in a high-yield savings account (HYSA).',
        `Any cash beyond ${target6mo} is over-insured — consider investing the surplus.`,
        'Review the fund amount if your expenses increase significantly.'
      ],
      chatSeed: `My emergency fund covers ${Math.floor(emoMonths)} months (${fmt(liquid)}). That's above the recommended 6 months. Should I invest the excess, and if so, what should I invest in given my current financial profile?`
    })
  }

  const achievedGoals = (analysis.goals || []).filter(g => (g.percentage || 0) >= 100)
  if (achievedGoals.length > 0 && insights.length < 4) {
    insights.push({
      title: 'Goals',
      text: `${achievedGoals.length} goal${achievedGoals.length > 1 ? 's' : ''} fully funded. Time to put that capital to work.`,
      type: 'positive',
      actions: [
        'Decide: withdraw and use the funds, or redirect them to another goal.',
        'If the goal is long-term (retirement), keep invested and let it grow.',
        'Set your next goal now so this momentum doesn\'t get wasted on lifestyle inflation.'
      ],
      chatSeed: `I've fully funded ${achievedGoals.length} of my goals (${achievedGoals.map(g => g.name).join(', ')}). Help me figure out the best next move — should I use the money, reinvest it, or set a new goal?`
    })
  } else {
    const closest = [...(analysis.goals || [])].sort((a, b) => (b.percentage || 0) - (a.percentage || 0))[0]
    if (closest && insights.length < 4) {
      const remaining = fmt(closest.targetAmount - closest.currentAmount)
      insights.push({
        title: 'Closest Goal',
        text: `${closest.name} is ${Math.round(closest.percentage || 0)}% funded — ${remaining} to go.`,
        type: 'neutral',
        actions: [
          `You need ${remaining} more — at your current rate, is the timeline realistic?`,
          'Set up automatic monthly contributions specifically for this goal.',
          'Consider whether a higher-return investment makes sense for this goal\'s timeline.'
        ],
        chatSeed: `My closest goal "${closest.name}" is ${Math.round(closest.percentage || 0)}% funded with ${remaining} left to go. The monthly needed is ${fmt(closest.monthlyNeeded || 0)}. Help me figure out the most efficient way to fully fund this goal.`
      })
    }
  }

  return insights.slice(0, 3)
}

function CountUp({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef<number | null>(null)
  const frameRef = useRef<number>(0)
  const prevValue = useRef(0)

  useEffect(() => {
    if (!value) return
    const from = prevValue.current
    prevValue.current = value
    startRef.current = null
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      const progress = Math.min((timestamp - startRef.current) / duration, 1)
      // Expo ease-out for a crisp, punchy feel
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setDisplay(Math.round(from + eased * (value - from)))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value])

  return <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(display)}</span>
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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'good morning'
  if (h < 17) return 'good afternoon'
  return 'good evening'
}

const HEALTH_ITEM_META: Record<string, { icon: string; target: string; tip: string }> = {
  'Savings rate':    { icon: '💰', target: 'Target: 20%+', tip: 'Increase savings by automating transfers on payday.' },
  'Debt load':       { icon: '💳', target: 'Target: <10% of income', tip: 'Extra payments on high-rate debt free up cash fast.' },
  'Emergency fund':  { icon: '🛡️', target: 'Target: 6 months', tip: 'Build to 3 months first, then stretch to 6.' },
  'Diversification': { icon: '📊', target: 'Target: 4+ asset types', tip: 'Add a retirement or brokerage account to diversify.' },
  'Goal progress':   { icon: '🎯', target: 'Target: 75%+ avg', tip: 'Review goal amounts — smaller targets stay motivating.' },
}

function HealthScoreCard({ analysis, profile }: { analysis: Analysis; profile: any }) {
  const { score, label, color, breakdown } = computeHealthScore(analysis, profile)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Find weakest item (lowest pct of max)
  const weakest = [...breakdown].sort((a, b) => (a.score / a.max) - (b.score / b.max))[0]
  const weakestMeta = HEALTH_ITEM_META[weakest.label]

  const ringCirc = 163.4
  const ringFill = (score / 100) * ringCirc

  return (
    <div className="card animate-fade" style={{ marginBottom: '12px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: detailsOpen ? '20px' : '0' }}>
        {/* Score ring */}
        <div style={{ flexShrink: 0, position: 'relative' }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--sand-200)" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="6"
              strokeDasharray={`${ringFill} ${ringCirc}`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '22px', fontWeight: '700', color, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: '9px', color: 'var(--sand-500)', fontWeight: '600', letterSpacing: '0.04em' }}>/ 100</span>
          </div>
        </div>

        {/* Score label + summary */}
        <div style={{ flex: 1 }}>
          <p className="label" style={{ marginBottom: '4px' }}>Financial Health</p>
          <p style={{ fontSize: '22px', fontWeight: '700', color, margin: '0 0 6px', letterSpacing: '-0.5px' }}>{label}</p>
          {detailsOpen && (
            <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0, lineHeight: '1.4' }}>
              {score >= 80 ? 'You\'re in great shape — keep the momentum.' :
               score >= 65 ? 'Solid foundation with a few areas to sharpen.' :
               score >= 45 ? 'Making progress, but a couple areas need attention.' :
               'Let\'s work on the basics first — you\'ve got this.'}
            </p>
          )}
        </div>
        <button
          onClick={() => setDetailsOpen(o => !o)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--sand-400)', padding: '4px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label={detailsOpen ? 'Minimize details' : 'Expand details'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transition: 'transform 0.2s', transform: detailsOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Breakdown grid */}
      {detailsOpen && (<>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {breakdown.map((item, i) => {
          const pct = item.score / item.max
          const barColor = pct >= 0.8 ? 'var(--success)' : pct >= 0.5 ? 'var(--accent)' : pct >= 0.3 ? 'var(--warning)' : 'var(--danger)'
          const meta = HEALTH_ITEM_META[item.label]
          const grade = pct >= 0.9 ? 'A' : pct >= 0.75 ? 'B' : pct >= 0.55 ? 'C' : pct >= 0.35 ? 'D' : 'F'
          return (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{meta?.icon}</span>
                <span style={{ fontSize: '13px', color: 'var(--sand-800)', fontWeight: '500', flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--sand-500)', marginRight: '6px' }}>{item.note}</span>
                <span style={{
                  fontSize: '11px', fontWeight: '700', color: barColor,
                  background: pct >= 0.8 ? 'rgba(122,158,110,0.1)' : pct >= 0.5 ? 'var(--accent-light)' : pct >= 0.3 ? 'rgba(200,148,58,0.1)' : 'rgba(192,57,43,0.08)',
                  padding: '2px 7px', borderRadius: '6px', flexShrink: 0,
                }}>{grade}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="progress-bar" style={{ flex: 1 }}>
                  <div className="progress-fill" style={{ width: `${pct * 100}%`, background: barColor, transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }} />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--sand-400)', flexShrink: 0, width: '44px', textAlign: 'right' }}>{meta?.target.replace('Target: ', '')}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Improvement tip based on weakest area */}
      <div style={{
        background: 'var(--sand-200)', borderRadius: 'var(--radius-sm)',
        padding: '10px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: '14px', flexShrink: 0 }}>{weakestMeta?.icon}</span>
        <div>
          <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-500)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>
            Biggest opportunity — {weakest.label}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--sand-700)', margin: 0, lineHeight: '1.45' }}>
            {weakestMeta?.tip}
          </p>
        </div>
      </div>
      </>)}
    </div>
  )
}

function InsightChatModal({ insight, profile, onClose }: { insight: Insight; profile: any; onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-send the seed message on open
    const seed = { role: 'user' as const, content: insight.chatSeed }
    setMessages([seed])
    setLoading(true)
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [seed], profile: profile || {}, topic: 'insights' })
    })
      .then(r => r.json())
      .then(d => setMessages(prev => [...prev, { role: 'assistant', content: d.message || '' }]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user' as const, content: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, profile: profile || {}, topic: 'insights' })
      })
      const d = await r.json()
      setMessages(prev => [...prev, { role: 'assistant', content: d.message || '' }])
    } catch {}
    setLoading(false)
  }

  const typeColors = {
    positive: { dot: 'var(--success)' },
    neutral: { dot: 'var(--accent)' },
    warning: { dot: 'var(--danger)' },
  }
  const dot = typeColors[insight.type].dot

  return (
    <div className="sheet-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.4)', zIndex: 300, display: 'flex', alignItems: 'flex-end', padding: '0' }} onClick={onClose}>
      <div style={{ background: 'var(--sand-50)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Handle + header */}
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--sand-300)', borderRadius: '2px', margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
            <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sand-900)', margin: 0 }}>{insight.title}</p>
            <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '20px', color: 'var(--sand-400)', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '8px' }}>
          {messages.slice(1).map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: '26px', height: '26px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
                </div>
              )}
              <div style={{ maxWidth: '82%', background: msg.role === 'user' ? 'var(--accent)' : 'var(--sand-100)', border: msg.role === 'user' ? 'none' : '0.5px solid var(--sand-300)', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px' }}>
                <p style={{ fontSize: '13px', margin: 0, color: msg.role === 'user' ? 'var(--sand-50)' : 'var(--sand-800)', lineHeight: '1.55' }}>{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
              </div>
              <div style={{ background: 'var(--sand-100)', border: '0.5px solid var(--sand-300)', borderRadius: '16px 16px 16px 4px', padding: '12px 14px', display: 'flex', gap: '4px' }}>
                {[0,150,300].map(d => <div key={d} style={{ width: '5px', height: '5px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 20px 32px', borderTop: '0.5px solid var(--sand-200)', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask a follow-up..."
            style={{ flex: 1, borderRadius: '20px', fontSize: '14px' }}
          />
          <button onClick={send} disabled={!input.trim() || loading}
            style={{ width: '40px', height: '40px', borderRadius: '50%', background: input.trim() ? 'var(--accent)' : 'var(--sand-300)', border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? 'var(--sand-50)' : 'var(--sand-500)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function InsightsStrip({ analysis, profile, refreshing }: { analysis: Analysis; profile: any; refreshing?: boolean }) {
  const insights = generateInsights(analysis, profile)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [chatInsight, setChatInsight] = useState<Insight | null>(null)

  const typeColors = {
    positive: { bg: 'rgba(122,158,110,0.08)', border: 'rgba(122,158,110,0.2)', dot: 'var(--success)', label: 'On track' },
    neutral: { bg: 'var(--sand-50)', border: 'var(--sand-300)', dot: 'var(--accent)', label: 'Room to improve' },
    warning: { bg: 'rgba(192,57,43,0.04)', border: 'rgba(192,57,43,0.18)', dot: 'var(--danger)', label: 'Needs attention' },
  }

  return (
    <>
      <div className="animate-fade stagger-1" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <p className="label" style={{ margin: 0 }}>Key Insights</p>
          {refreshing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '10px', height: '10px', border: '1.5px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              <span style={{ fontSize: '10px', color: 'var(--sand-400)', fontWeight: '500' }}>updating</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {insights.map((insight, i) => {
            const c = typeColors[insight.type]
            const isOpen = expandedIdx === i
            return (
              <div key={i} style={{ background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 'var(--radius-md)', overflow: 'hidden', transition: 'all var(--transition)' }}>
                {/* Header row — always visible */}
                <button
                  onClick={() => setExpandedIdx(isOpen ? null : i)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'flex-start', gap: '10px' }}
                >
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.dot, marginTop: '5px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: c.dot, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 2px' }}>{insight.title}</p>
                    <p style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--sand-800)', margin: 0 }}>{insight.text}</p>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--sand-400)', flexShrink: 0, marginTop: '2px', transition: `transform var(--spring-fast)`, display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="animate-fade" style={{ padding: '0 16px 14px', borderTop: `0.5px solid ${c.border}` }}>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-500)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '12px 0 8px' }}>Next steps</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                      {insight.actions.map((action, ai) => (
                        <div key={ai} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <span style={{ color: c.dot, fontWeight: '700', fontSize: '13px', flexShrink: 0, marginTop: '1px' }}>·</span>
                          <p style={{ fontSize: '13px', color: 'var(--sand-700)', margin: 0, lineHeight: '1.5' }}>{action}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setChatInsight(insight)}
                      style={{ background: c.dot, border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--sand-50)', fontSize: '12px', fontWeight: '600', padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Chat about this →
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {chatInsight && (
        <InsightChatModal insight={chatInsight} profile={profile} onClose={() => setChatInsight(null)} />
      )}
    </>
  )
}

const CONFETTI_COLORS = ['#FFD700','#FF6B6B','#4FC3F7','#81C784','#CE93D8','#FFB74D','#F06292','#4DB6AC','#FFF176','#80DEEA']

function Confetti() {
  const particles = useMemo(() => Array.from({ length: 65 }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    w: 5 + Math.random() * 7,
    h: Math.random() > 0.45 ? (5 + Math.random() * 7) : (10 + Math.random() * 14),
    delay: Math.random() * 1.4,
    dur: 2.2 + Math.random() * 2,
    drift: (-70 + Math.random() * 140).toFixed(0),
    rot: (200 + Math.random() * 560).toFixed(0),
    round: Math.random() > 0.55,
  })), [])

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 202 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`,
          top: '-14px',
          width: `${p.w}px`,
          height: `${p.h}px`,
          background: p.color,
          borderRadius: p.round ? '50%' : '2px',
          animationName: 'confettiFall',
          animationDuration: `${p.dur}s`,
          animationDelay: `${p.delay}s`,
          animationTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
          animationFillMode: 'both',
          '--drift': `${p.drift}px`,
          '--rot': `${p.rot}deg`,
        } as any} />
      ))}
    </div>
  )
}

function MilestoneOverlay({ amount, onClose }: { amount: number; onClose: () => void }) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const t = setTimeout(onClose, 9000)
    return () => clearTimeout(t)
  }, [])

  // Count-up animation for the amount
  useEffect(() => {
    let start: number | null = null
    const dur = 1400
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / dur, 1)
      const eased = 1 - Math.pow(2, -10 * p)
      setCount(Math.round(eased * amount))
      if (p < 1) requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [amount])

  const trophyEmoji = amount >= 1000000 ? '💎' : amount >= 500000 ? '🏆' : amount >= 100000 ? '⭐' : '🎯'
  const milestone_label = amount >= 1000000 ? 'Millionaire' : amount >= 500000 ? 'Half a million' : amount >= 250000 ? 'Quarter million' : amount >= 100000 ? 'Six figures' : amount >= 50000 ? 'Fifty thousand' : amount >= 25000 ? 'Twenty-five thousand' : 'Ten thousand'

  return (
    <>
      <Confetti />
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,4,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <div
          style={{ background: 'var(--sand-50)', borderRadius: 'var(--radius-xl)', padding: '40px 32px', textAlign: 'center', maxWidth: '340px', width: '100%', animationName: 'celebrateCardIn', animationDuration: '0.65s', animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)', animationFillMode: 'both', position: 'relative', overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Glow ring */}
          <div style={{ position: 'absolute', inset: '-2px', borderRadius: 'calc(var(--radius-xl) + 2px)', background: 'linear-gradient(135deg, #FFD700, #FF6B6B, #4FC3F7, #81C784)', opacity: 0.25, zIndex: -1 }} />

          {/* Trophy emoji with bounce */}
          <div style={{ fontSize: '64px', marginBottom: '16px', display: 'inline-block', animationName: 'trophyBounce', animationDuration: '0.7s', animationDelay: '0.3s', animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)', animationFillMode: 'both' }}>
            {trophyEmoji}
          </div>

          <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--sand-500)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Milestone reached
          </p>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)', margin: '0 0 14px' }}>
            {milestone_label}
          </p>

          {/* Animated amount */}
          <div style={{ fontSize: '42px', fontWeight: '300', color: 'var(--sand-900)', letterSpacing: '-2px', lineHeight: '1', margin: '0 0 16px', animationName: 'shimmerGold', animationDuration: '2s', animationIterationCount: '3', animationTimingFunction: 'ease-in-out' }}>
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(count)}
          </div>

          <p style={{ fontSize: '14px', color: 'var(--sand-600)', margin: '0 0 28px', lineHeight: '1.6' }}>
            Your net worth just crossed {fmt(amount)}.<br />That's a real achievement — keep building.
          </p>

          <button
            onClick={onClose}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: '700', borderRadius: 'var(--radius-md)', letterSpacing: '0.01em' }}
          >
            Keep building →
          </button>

          <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '12px 0 0' }}>
            Saved to your achievements ↗
          </p>
        </div>
      </div>
    </>
  )
}

function TrophySection({ userId, goals }: { userId: string; goals: any[] }) {
  const fmtAmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`
    return `$${n}`
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return null
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const milestoneMeta: Record<number, { icon: string; label: string }> = {
    10000:   { icon: '🪙', label: '$10k club' },
    25000:   { icon: '💫', label: '$25k reached' },
    50000:   { icon: '🎯', label: 'Fifty thousand' },
    100000:  { icon: '⭐', label: 'Six figures' },
    250000:  { icon: '🔥', label: 'Quarter million' },
    500000:  { icon: '🏆', label: 'Half million' },
    1000000: { icon: '💎', label: 'Millionaire' },
  }

  const milestones = MILESTONES.map(m => {
    const raw = localStorage.getItem(`${userId}_milestone_${m}`)
    if (!raw) return null
    let date: string | null = null
    if (raw !== '1') { try { date = JSON.parse(raw).date } catch {} }
    const meta = milestoneMeta[m] || { icon: '🏅', label: fmtAmt(m) }
    return { key: `m_${m}`, icon: meta.icon, title: meta.label, sub: fmtAmt(m) + ' net worth', date }
  }).filter(Boolean) as { key: string; icon: string; title: string; sub: string; date: string | null }[]

  const completedGoals = goals
    .filter(g => g.target_amount > 0 && g.current_amount >= g.target_amount)
    .map(g => {
      let date: string | null = null
      const raw = localStorage.getItem(`${userId}_goal_done_${g.name}`)
      if (raw) { try { date = JSON.parse(raw).date } catch {} }
      return { key: `g_${g.name}`, icon: '✅', title: g.name, sub: `${fmtAmt(g.target_amount)} goal`, date }
    })

  const all = [...milestones, ...completedGoals]
  if (!all.length) return null

  return (
    <div className="animate-fade" style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <p className="label" style={{ margin: 0 }}>Achievements</p>
        <span style={{ fontSize: '10px', color: 'var(--sand-400)', fontWeight: '500' }}>{all.length} earned</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
        {all.map((item, i) => (
          <div
            key={item.key}
            style={{
              flexShrink: 0,
              background: 'var(--sand-50)',
              border: '0.5px solid var(--sand-300)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 14px 12px',
              minWidth: '112px',
              textAlign: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              animationName: 'achieveBadgeIn',
              animationDuration: '0.35s',
              animationDelay: `${i * 0.06}s`,
              animationFillMode: 'both',
              animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '7px', lineHeight: 1 }}>{item.icon}</div>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--sand-900)', margin: '0 0 2px', lineHeight: '1.2' }}>{item.title}</p>
            <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '0 0 5px' }}>{item.sub}</p>
            {item.date && (
              <p style={{ fontSize: '9px', color: 'var(--sand-400)', margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{fmtDate(item.date)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const RECAP_PERIODS = ['1D', '1W', '1M'] as const
type RecapPeriod = typeof RECAP_PERIODS[number] | 'custom'

function buildPortfolioNewsQuery(profile: any): string {
  const terms: string[] = []

  // Specific ticker symbols from all positions
  const symbols: string[] = []
  for (const asset of profile?.assets || []) {
    for (const pos of asset.positions || []) {
      if (pos.symbol && !symbols.includes(pos.symbol)) symbols.push(pos.symbol)
    }
  }
  if (symbols.length) terms.push(...symbols.slice(0, 6))

  // Asset categories → relevant financial topics
  const categories = [...new Set((profile?.assets || []).map((a: any) => a.category))]
  if (categories.includes('crypto')) terms.push('cryptocurrency bitcoin')
  if (categories.includes('real_estate')) terms.push('real estate housing market')
  if (categories.includes('retirement')) terms.push('401k IRA retirement investing')
  if (categories.includes('brokerage')) terms.push('stock market investing')

  // Debt types → relevant news
  const debtTypes = (profile?.debts || []).map((d: any) => d.type?.toLowerCase())
  if (debtTypes.some((t: string) => t?.includes('mortgage'))) terms.push('mortgage rates')
  if (debtTypes.some((t: string) => t?.includes('student'))) terms.push('student loan')

  // Concerns from onboarding
  const concerns: string[] = profile?.concerns || []
  if (concerns.includes('Reduce taxes')) terms.push('tax strategy')
  if (concerns.includes('Retire early (FIRE)')) terms.push('FIRE financial independence')
  if (concerns.includes('Buy a home')) terms.push('housing market mortgage')

  // Fallback if nothing specific
  if (terms.length === 0) terms.push('stock market investing personal finance')

  return [...new Set(terms)].slice(0, 8).join(' ')
}

function MarketRecap({ profile }: { profile?: any }) {
  const [period, setPeriod] = useState<RecapPeriod>('1W')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  const [recap, setRecap] = useState('')
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [followUpInput, setFollowUpInput] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [lastContext, setLastContext] = useState<{ snapshot: any[]; news: any[]; period: string; fromDate: string; toDate: string } | null>(null)

  const formatText = (text: string) => formatAIText(text)

  const KEY_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'GLD', 'BTC-USD']

  const fetchRecap = async (p: RecapPeriod, from?: string, to?: string) => {
    setLoading(true)
    setRecap('')
    setChatMessages([])
    const todayStr = new Date().toISOString().split('T')[0]
    let fromStr = todayStr
    let toStr = todayStr
    let apiPeriod = '1W'

    if (p === '1D') {
      fromStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      apiPeriod = '1D'
    } else if (p === '1W') {
      fromStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      apiPeriod = '1W'
    } else if (p === '1M') {
      fromStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
      apiPeriod = '1M'
    } else if (p === 'custom' && from && to) {
      fromStr = from
      toStr = to
      const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000
      apiPeriod = days <= 2 ? '1D' : days <= 10 ? '1W' : days <= 45 ? '1M' : '1Y'
    } else {
      setLoading(false)
      return
    }

    try {
      // Fetch news + period-specific historical prices for key symbols in parallel
      const newsQuery = encodeURIComponent(buildPortfolioNewsQuery(profile))
      const [newsRes, ...histResponses] = await Promise.all([
        fetch(`/api/news?q=${newsQuery}&from=${fromStr}&to=${toStr}`).catch(() => null),
        ...KEY_SYMBOLS.map(sym => fetch(`/api/stocks?symbol=${sym}&period=${apiPeriod}`).catch(() => null)),
      ])
      const newsData = newsRes ? await newsRes.json().catch(() => ({})) : {}
      const histData = await Promise.all(histResponses.map(r => r ? r.json().catch(() => ({})) : Promise.resolve({})))

      // Build period snapshot: start price → end price → % change over the actual period
      const periodSnapshot = KEY_SYMBOLS.map((sym, i) => {
        const prices: number[] = (histData[i].prices || []).filter((p: any) => p != null)
        if (prices.length < 2) return null
        const startPrice = prices[0]
        const endPrice = prices[prices.length - 1]
        const change = endPrice - startPrice
        const changePercent = ((change / startPrice) * 100).toFixed(2)
        return { symbol: sym, startPrice, endPrice, change, changePercent }
      }).filter(Boolean)

      const newsArticles = (newsData.articles || []).slice(0, 10).map((a: any) => ({ title: a.title, description: a.description }))

      // Summarise user holdings for the AI recap
      const holdings = (profile?.assets || []).flatMap((a: any) =>
        (a.positions || []).map((pos: any) => pos.symbol).filter(Boolean)
      )
      const ctx = { snapshot: periodSnapshot, news: newsArticles, period: p, fromDate: fromStr, toDate: toStr, holdings }
      setLastContext(ctx)

      const res = await fetch('/api/market-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ctx),
      })
      const data = await res.json()
      setRecap(data.brief || 'Unable to generate recap.')
      setUpdatedAt(new Date())
    } catch {
      setRecap('Unable to load market recap. Check your connection.')
    }
    setLoading(false)
  }

  const sendFollowUp = async () => {
    if (!followUpInput.trim() || followUpLoading || !recap) return
    const userMsg = { role: 'user' as const, content: followUpInput.trim() }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setFollowUpInput('')
    setFollowUpLoading(true)
    try {
      const res = await fetch('/api/market-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(lastContext || {}),
          messages: [{ role: 'assistant', content: recap }, ...newMessages],
        }),
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Unable to respond.' }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setFollowUpLoading(false)
  }

  useEffect(() => { fetchRecap('1W') }, [])

  const handlePeriod = (p: RecapPeriod) => {
    setPeriod(p)
    if (p !== 'custom') {
      setShowCalendar(false)
      fetchRecap(p)
    } else {
      setShowCalendar(true)
    }
  }

  const applyCustom = () => {
    if (!fromDate || !toDate) return
    setShowCalendar(false)
    fetchRecap('custom', fromDate, toDate)
  }

  return (
    <div className="animate-fade" style={{ marginBottom: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <p className="label">Market Recap</p>
        <button
          onClick={() => fetchRecap(period, fromDate || undefined, toDate || undefined)}
          disabled={loading}
          style={{ background: 'none', border: 'none', color: 'var(--sand-400)', cursor: loading ? 'not-allowed' : 'pointer', padding: '2px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'inherit' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          {updatedAt && !loading && <span style={{ color: 'var(--sand-400)' }}>Updated {updatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>}
        </button>
      </div>

      <div className="card" style={{ padding: '14px' }}>
        {/* Period selector */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '12px', alignItems: 'center' }}>
          {RECAP_PERIODS.map(p => (
            <button
              key={p}
              onClick={() => handlePeriod(p)}
              style={{
                padding: '5px 12px', borderRadius: '16px', fontSize: '11px', fontWeight: '600',
                cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                background: period === p ? 'var(--accent)' : 'var(--sand-200)',
                color: period === p ? 'var(--sand-50)' : 'var(--sand-600)',
                transition: 'all 0.15s',
              }}
            >
              {p}
            </button>
          ))}
          {/* Calendar toggle */}
          <button
            onClick={() => handlePeriod('custom')}
            title="Custom date range"
            style={{
              padding: '5px 10px', borderRadius: '16px', fontSize: '11px', fontWeight: '600',
              cursor: 'pointer', fontFamily: 'inherit', border: 'none', display: 'flex', alignItems: 'center', gap: '4px',
              background: period === 'custom' ? 'var(--accent)' : 'var(--sand-200)',
              color: period === 'custom' ? 'var(--sand-50)' : 'var(--sand-600)',
              transition: 'all 0.15s',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Custom
          </button>
        </div>

        {/* Custom date range inputs */}
        {showCalendar && (
          <div className="animate-fade" style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={fromDate}
              max={toDate || new Date().toISOString().split('T')[0]}
              onChange={e => setFromDate(e.target.value)}
              style={{ flex: 1, minWidth: '120px', fontSize: '12px', padding: '6px 10px', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-sm)', background: 'var(--sand-100)', color: 'var(--sand-900)', fontFamily: 'inherit', outline: 'none' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--sand-400)' }}>to</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setToDate(e.target.value)}
              style={{ flex: 1, minWidth: '120px', fontSize: '12px', padding: '6px 10px', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-sm)', background: 'var(--sand-100)', color: 'var(--sand-900)', fontFamily: 'inherit', outline: 'none' }}
            />
            <button
              onClick={applyCustom}
              disabled={!fromDate || !toDate}
              className="btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px', flexShrink: 0, opacity: (!fromDate || !toDate) ? 0.5 : 1 }}
            >
              Go
            </button>
          </div>
        )}

        {/* Period label for custom */}
        {period === 'custom' && fromDate && toDate && !showCalendar && (
          <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: '-4px 0 10px', fontWeight: '500' }}>
            {new Date(fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(toDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}

        {/* Content */}
        {loading ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '20px', height: '20px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '7px', fontWeight: '700' }}>AI</span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 150, 300].map(d => <div key={d} style={{ width: '5px', height: '5px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
              </div>
            </div>
            {[80, 60, 90, 55, 75].map((w, i) => (
              <div key={i} style={{ height: '10px', width: `${w}%`, background: 'var(--sand-200)', borderRadius: '4px', marginBottom: '8px', animation: 'pulse 1.2s infinite', animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : recap ? (
          <div>
            {/* Recap */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <div style={{ width: '18px', height: '18px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '7px', fontWeight: '700' }}>AI</span>
              </div>
              <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-500)', margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>AI Market Recap</p>
            </div>
            <div>{formatText(recap)}</div>

            {/* Follow-up conversation */}
            {chatMessages.length > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ height: '0.5px', background: 'var(--sand-200)', marginBottom: '4px' }} />
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: '20px', height: '20px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                        <span style={{ color: 'var(--sand-50)', fontSize: '7px', fontWeight: '700' }}>AI</span>
                      </div>
                    )}
                    <div style={{
                      maxWidth: '85%',
                      background: msg.role === 'user' ? 'var(--accent)' : 'var(--sand-100)',
                      border: msg.role === 'user' ? 'none' : '0.5px solid var(--sand-200)',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                      padding: '10px 13px',
                    }}>
                      {msg.role === 'user'
                        ? <p style={{ fontSize: '13px', margin: 0, color: 'var(--sand-50)', lineHeight: '1.5' }}>{msg.content}</p>
                        : <div style={{ fontSize: '13px' }}>{formatText(msg.content)}</div>
                      }
                    </div>
                  </div>
                ))}
                {followUpLoading && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'var(--sand-50)', fontSize: '7px', fontWeight: '700' }}>AI</span>
                    </div>
                    <div style={{ background: 'var(--sand-100)', border: '0.5px solid var(--sand-200)', borderRadius: '4px 16px 16px 16px', padding: '12px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {[0, 150, 300].map(d => <div key={d} style={{ width: '5px', height: '5px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Follow-up input */}
            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                value={followUpInput}
                onChange={e => setFollowUpInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFollowUp() } }}
                placeholder="Ask a follow-up question..."
                disabled={followUpLoading}
                style={{
                  flex: 1, fontSize: '13px', padding: '9px 14px', borderRadius: '20px',
                  border: '0.5px solid var(--sand-300)', background: 'var(--sand-100)',
                  color: 'var(--sand-900)', outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={sendFollowUp}
                disabled={!followUpInput.trim() || followUpLoading}
                style={{
                  width: '34px', height: '34px', borderRadius: '50%', border: 'none', flexShrink: 0,
                  background: followUpInput.trim() && !followUpLoading ? 'var(--accent)' : 'var(--sand-300)',
                  cursor: followUpInput.trim() && !followUpLoading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={followUpInput.trim() && !followUpLoading ? 'var(--sand-50)' : 'var(--sand-500)'}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function parsTimelineMonths(timeline: string): number {
  if (!timeline) return 60
  const yearsMatch = timeline.match(/(\d+)\s*year/i)
  const monthsMatch = timeline.match(/(\d+)\s*month/i)
  if (yearsMatch) return parseInt(yearsMatch[1]) * 12
  if (monthsMatch) return parseInt(monthsMatch[1])
  const yearNumMatch = timeline.match(/20(\d{2})/)
  if (yearNumMatch) {
    const targetYear = 2000 + parseInt(yearNumMatch[1])
    const monthsLeft = Math.max(1, (targetYear - new Date().getFullYear()) * 12)
    return monthsLeft
  }
  return 60
}

function CashFlowSheet({ financials, aiAnalysis, loading, onClose, profile }: {
  financials: Analysis
  aiAnalysis: string
  loading: boolean
  onClose: () => void
  profile: any
}) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chips, setChips] = useState<string[]>([])
  const [minimizedAI, setMinimizedAI] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const income = financials.monthlyIncome || 0
  const expenses = financials.monthlyExpenses || 0
  const savings = financials.availableToSave || 0
  const savingsRate = financials.savingsRate || 0
  const expenseRatio = income > 0 ? expenses / income : 0

  // Score components (0-100 total)
  const savingsScore = Math.min(40, Math.max(0, (savingsRate / 20) * 40))
  const expenseScore = Math.max(0, 30 * (1 - Math.min(1, Math.max(0, expenseRatio - 0.4) / 0.6)))
  const surplusScore = savings > 0 ? Math.min(20, (savings / (income * 0.2)) * 20) : 0

  const goals = profile?.goals || []
  const goalAnalysis = goals.map((g: any) => {
    const remaining = Math.max(0, (g.target_amount || 0) - (g.current_amount || 0))
    const months = parsTimelineMonths(g.timeline || '')
    const monthlyNeeded = remaining > 0 && months > 0 ? remaining / months : 0
    const canAfford = savings > 0 && monthlyNeeded > 0 && monthlyNeeded <= savings
    const pctOfSurplus = savings > 0 && monthlyNeeded > 0 ? Math.min(200, (monthlyNeeded / savings) * 100) : monthlyNeeded > 0 ? 200 : 0
    return { ...g, remaining, months, monthlyNeeded, canAfford, pctOfSurplus }
  })
  const feasibleCount = goalAnalysis.filter((g: any) => g.canAfford).length
  const goalScore = goals.length > 0 ? (feasibleCount / goals.length) * 10 : 5

  const score = Math.round(savingsScore + expenseScore + surplusScore + goalScore)
  const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : score >= 20 ? 'Needs Work' : 'Critical'
  const scoreColor = score >= 80 ? 'var(--success)' : score >= 60 ? '#5a8fc4' : score >= 40 ? '#c4955a' : 'var(--danger)'

  const totalMonthlyNeeded = goalAnalysis.reduce((s: number, g: any) => s + g.monthlyNeeded, 0)

  const parseFollowUps = (text: string): string[] => {
    const m = text.match(/<followups>([\s\S]*?)<\/followups>/)
    if (!m) return []
    try { return JSON.parse(m[1]) } catch { return [] }
  }
  const stripMeta = (text: string) =>
    text.replace(/<followups>[\s\S]*?<\/followups>/g, '').replace(/<chart>[\s\S]*?<\/chart>/g, '').trim()

  useEffect(() => {
    if (!loading && aiAnalysis) {
      const parsed = parseFollowUps(aiAnalysis)
      setChips(parsed.length ? parsed : [
        'How can I improve my cash flow score?',
        savings > 0 ? `How should I allocate my ${fmt(savings)}/mo surplus?` : 'How do I cut my expenses?',
        goals.length > 0 ? 'Which goal should I fund first?' : 'What goals should I set?',
      ])
    }
  }, [aiAnalysis, loading])

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages, chatLoading])

  const sendChat = async (question: string) => {
    if (!question.trim() || chatLoading || loading) return
    const userMsg = { role: 'user' as const, content: question }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    setChips([])
    const apiMessages = chatMessages.length === 0 && aiAnalysis
      ? [{ role: 'assistant' as const, content: stripMeta(aiAnalysis) }, userMsg]
      : newMessages
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, profile, topic: 'cashflow' })
      })
      const d = await r.json()
      const raw = d.message || ''
      setChips(parseFollowUps(raw))
      setChatMessages(prev => [...prev, { role: 'assistant', content: stripMeta(raw) }])
    } catch {}
    setChatLoading(false)
  }

  const formatText = (text: string) => formatAIText(stripMeta(text), { baseFontSize: '14px' })

  return (
    <div className="sheet-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.35)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div className="animate-slide" style={{ background: 'var(--sand-50)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '680px', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--sand-300)', borderRadius: '2px' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '12px 24px 14px', borderBottom: '0.5px solid var(--sand-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>Cash Flow Details</h2>
          <button onClick={onClose} style={{ background: 'var(--sand-200)', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', color: 'var(--sand-700)' }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px 8px', flex: 1 }}>

          {/* Cash Flow Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px', padding: '18px', background: 'var(--sand-100)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--sand-200)' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
              <svg viewBox="0 0 80 80" style={{ width: '80px', height: '80px', transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--sand-200)" strokeWidth="8" />
                <circle cx="40" cy="40" r="34" fill="none" stroke={scoreColor} strokeWidth="8"
                  strokeDasharray={`${(score / 100) * 213.6} 213.6`}
                  strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '22px', fontWeight: '700', color: scoreColor, lineHeight: 1 }}>{score}</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '20px', fontWeight: '600', color: scoreColor, margin: '0 0 1px' }}>{scoreLabel}</p>
              <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '0 0 12px' }}>Cash Flow Health Score</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {[
                  { label: 'Savings rate', pts: Math.round(savingsScore), max: 40 },
                  { label: 'Expense control', pts: Math.round(expenseScore), max: 30 },
                  { label: 'Monthly surplus', pts: Math.round(surplusScore), max: 20 },
                  { label: 'Goal coverage', pts: Math.round(goalScore), max: 10 },
                ].map(c => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: c.pts / c.max >= 0.8 ? 'var(--success)' : c.pts / c.max >= 0.4 ? '#c4955a' : 'var(--danger)' }} />
                    <span style={{ fontSize: '10px', color: 'var(--sand-600)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--sand-700)' }}>{c.pts}<span style={{ fontWeight: '400', color: 'var(--sand-400)' }}>/{c.max}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly Breakdown */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--sand-500)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Monthly Breakdown</p>
            {[
              { label: 'Income', value: income, color: 'var(--success)', pct: 100, sub: '' },
              { label: 'Expenses', value: expenses, color: 'var(--danger)', pct: Math.min(100, expenseRatio * 100), sub: `${(expenseRatio * 100).toFixed(0)}% of income` },
              { label: 'Surplus', value: savings, color: savings >= 0 ? 'var(--accent)' : 'var(--danger)', pct: Math.max(0, (savings / income) * 100), sub: `${Math.round(savingsRate)}% savings rate` },
            ].map((row, i) => (
              <div key={row.label} style={{ marginBottom: i < 2 ? '12px' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--sand-700)', fontWeight: '500' }}>{row.label}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--sand-900)' }}>{fmt(row.value)}</span>
                    {row.sub && <span style={{ fontSize: '11px', color: 'var(--sand-400)', marginLeft: '6px' }}>{row.sub}</span>}
                  </div>
                </div>
                <div style={{ height: '5px', background: 'var(--sand-200)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, row.pct)}%`, background: row.color, borderRadius: '3px', transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Goal Feasibility */}
          {goalAnalysis.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--sand-500)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Goal Feasibility</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {goalAnalysis.map((g: any, i: number) => {
                  const status = g.monthlyNeeded === 0 ? 'complete' : g.canAfford ? 'on-track' : savings <= 0 ? 'at-risk' : 'needs-more'
                  const statusColor = status === 'on-track' || status === 'complete' ? 'var(--success)' : status === 'at-risk' ? 'var(--danger)' : '#c4955a'
                  const statusBg = status === 'on-track' || status === 'complete' ? 'rgba(122,158,110,0.07)' : status === 'at-risk' ? 'rgba(192,57,43,0.06)' : 'rgba(196,149,90,0.08)'
                  const statusBorder = status === 'on-track' || status === 'complete' ? 'rgba(122,158,110,0.2)' : status === 'at-risk' ? 'rgba(192,57,43,0.15)' : 'rgba(196,149,90,0.2)'
                  const statusLabel = status === 'complete' ? 'Complete' : status === 'on-track' ? 'On Track' : status === 'at-risk' ? 'At Risk' : 'Needs More'
                  return (
                    <div key={i} style={{ padding: '12px 14px', background: statusBg, borderRadius: 'var(--radius-sm)', border: `0.5px solid ${statusBorder}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 2px' }}>{g.name}</p>
                          <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>
                            {g.timeline && `${g.timeline} · `}{fmt(g.remaining)} remaining
                          </p>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: statusColor, padding: '2px 8px', background: statusBg, border: `0.5px solid ${statusBorder}`, borderRadius: '10px', flexShrink: 0, marginLeft: '8px' }}>
                          {statusLabel}
                        </span>
                      </div>
                      {g.monthlyNeeded > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, height: '4px', background: 'var(--sand-200)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, g.pctOfSurplus)}%`, background: g.canAfford ? 'var(--success)' : '#c4955a', borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--sand-500)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {fmt(g.monthlyNeeded)}/mo{savings > 0 ? ` · ${g.pctOfSurplus.toFixed(0)}% of surplus` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {savings > 0 && totalMonthlyNeeded > 0 && (
                <div style={{ marginTop: '10px', padding: '10px 14px', background: 'var(--sand-200)', borderRadius: 'var(--radius-sm)' }}>
                  <p style={{ fontSize: '12px', color: 'var(--sand-700)', margin: 0 }}>
                    <strong>{fmt(totalMonthlyNeeded)}/mo</strong> total needed across all goals
                    <span style={{ color: totalMonthlyNeeded <= savings ? 'var(--success)' : 'var(--danger)' }}>
                      {totalMonthlyNeeded <= savings
                        ? ` · fully covered by your ${fmt(savings)}/mo surplus`
                        : ` · ${fmt(totalMonthlyNeeded - savings)} short of your ${fmt(savings)}/mo surplus`}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* AI Analysis */}
          <div style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', marginBottom: '16px', overflow: 'hidden' }}>
            <button
              onClick={() => setMinimizedAI(m => !m)}
              style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}>
              <div style={{ width: '24px', height: '24px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
              </div>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-700)', margin: 0, flex: 1, textAlign: 'left' }}>AI Analysis</p>
              <span style={{ fontSize: '11px', color: 'var(--sand-400)', transition: 'transform 0.2s', display: 'inline-block', transform: minimizedAI ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            {!minimizedAI && (
              <div style={{ padding: '0 16px 14px' }}>
                {loading ? (
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '4px 0' }}>
                    {[0, 150, 300].map(d => <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                  </div>
                ) : (
                  <div>{formatText(aiAnalysis)}</div>
                )}
              </div>
            )}
          </div>

          {/* Chat thread */}
          {chatMessages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '8px' }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width: '26px', height: '26px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
                    </div>
                  )}
                  <div style={{ maxWidth: '85%', background: msg.role === 'user' ? 'var(--accent)' : 'var(--sand-100)', border: msg.role === 'user' ? 'none' : '0.5px solid var(--sand-300)', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px' }}>
                    {msg.role === 'assistant'
                      ? <div style={{ fontSize: '13px', color: 'var(--sand-800)', lineHeight: '1.55' }}>{formatText(msg.content)}</div>
                      : <p style={{ fontSize: '13px', margin: 0, color: 'var(--sand-50)', lineHeight: '1.55' }}>{msg.content}</p>
                    }
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: '26px', height: '26px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
                  </div>
                  <div style={{ background: 'var(--sand-100)', border: '0.5px solid var(--sand-300)', borderRadius: '16px 16px 16px 4px', padding: '12px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[0, 150, 300].map(d => <div key={d} style={{ width: '5px', height: '5px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
          )}
        </div>

        {/* Fixed bottom: chips + input */}
        <div style={{ borderTop: '0.5px solid var(--sand-200)', padding: '10px 20px 28px', flexShrink: 0, background: 'var(--sand-50)' }}>
          {chips.length > 0 && !chatLoading && (
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '10px', paddingBottom: '2px', WebkitOverflowScrolling: 'touch' as any }}>
              {chips.map((q, i) => (
                <button key={i} onClick={() => sendChat(q)} disabled={loading} style={{ flexShrink: 0, background: 'var(--sand-100)', border: '0.5px solid var(--sand-300)', borderRadius: '20px', padding: '6px 12px', fontSize: '12px', color: 'var(--sand-700)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {q}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat(chatInput)} placeholder={loading ? 'Generating analysis…' : 'Ask a follow-up question…'} disabled={loading || chatLoading} style={{ flex: 1, borderRadius: '20px', fontSize: '14px', padding: '10px 16px', border: '0.5px solid var(--sand-300)', background: 'var(--sand-100)', color: 'var(--sand-900)', fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={() => sendChat(chatInput)} disabled={!chatInput.trim() || loading || chatLoading} style={{ width: '40px', height: '40px', borderRadius: '50%', background: chatInput.trim() && !loading && !chatLoading ? 'var(--accent)' : 'var(--sand-300)', border: 'none', cursor: chatInput.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={chatInput.trim() && !loading ? 'var(--sand-50)' : 'var(--sand-500)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function getSuggestedQuestions(type: 'assets' | 'debts' | 'savings', profile: any): string[] {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)
  const assets = profile?.assets || []
  const debts = profile?.debts || []

  if (type === 'assets') {
    const topAsset = [...assets].sort((a: any, b: any) => (b.value || 0) - (a.value || 0))[0]
    const cats = new Set(assets.map((a: any) => a.category))
    const q: string[] = []
    if (topAsset) q.push(`Am I too concentrated in ${topAsset.name}?`)
    if (!cats.has('retirement')) q.push('Should I open a retirement account?')
    else q.push('Am I contributing enough to my retirement accounts?')
    q.push('Where should I put my next dollar?')
    return q.slice(0, 3)
  }
  if (type === 'debts') {
    const sorted = [...debts].sort((a: any, b: any) => (b.interest_rate || 0) - (a.interest_rate || 0))
    const highRate = sorted[0]
    const q: string[] = []
    if (highRate) q.push(`Should I pay off ${highRate.name} first or invest instead?`)
    if (debts.length > 1) q.push('What order should I pay off my debts?')
    q.push('Should I use avalanche or snowball method?')
    if (highRate && (highRate.interest_rate || 0) > 15) q.push(`Can I refinance or balance-transfer ${highRate.name}?`)
    return q.slice(0, 3)
  }
  if (type === 'savings') {
    const avail = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)
    return [
      avail > 0 ? `What's the best way to split my ${fmt(avail)}/mo surplus?` : 'How do I free up more money to save?',
      'Should I prioritize emergency fund, retirement, or debt payoff?',
      'What accounts should I be using to maximize returns?',
    ]
  }
  return []
}

function MiniDashboardSheet({ type, analysis, loading, onClose, profile, netWorth, totalAssets, totalLiabilities, availableToSave, liveQuotes }: {
  type: 'assets' | 'debts' | 'savings'
  analysis: string
  loading: boolean
  onClose: () => void
  profile: any
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  availableToSave: number
  liveQuotes: Record<string, { price: number; change: number; changePercent: string }>
}) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)
  const titles = { assets: 'Asset Breakdown', debts: 'Debt Overview', savings: 'Savings Power' }
  const colors = { assets: 'var(--sand-900)', debts: 'var(--danger)', savings: 'var(--success)' }

  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chips, setChips] = useState<string[]>([])
  const [minimizedAI, setMinimizedAI] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const parseFollowUps = (text: string): string[] => {
    const m = text.match(/<followups>([\s\S]*?)<\/followups>/)
    if (!m) return []
    try { return JSON.parse(m[1]) } catch { return [] }
  }
  const stripMeta = (text: string) =>
    text.replace(/<followups>[\s\S]*?<\/followups>/g, '').replace(/<chart>[\s\S]*?<\/chart>/g, '').trim()

  useEffect(() => {
    if (!loading && analysis) {
      const parsed = parseFollowUps(analysis)
      setChips(parsed.length ? parsed : getSuggestedQuestions(type, profile))
    }
  }, [analysis, loading])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  const sendChat = async (question: string) => {
    if (!question.trim() || chatLoading || loading) return
    const userMsg = { role: 'user' as const, content: question }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    setChips([])

    // First follow-up: give the AI context of what analysis was shown
    const apiMessages = chatMessages.length === 0 && analysis
      ? [{ role: 'assistant' as const, content: stripMeta(analysis) }, userMsg]
      : newMessages

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, profile, topic: type })
      })
      const d = await r.json()
      const raw = d.message || ''
      setChips(parseFollowUps(raw))
      setChatMessages(prev => [...prev, { role: 'assistant', content: stripMeta(raw) }])
    } catch {}
    setChatLoading(false)
  }

  const formatText = (text: string) => formatAIText(stripMeta(text), { baseFontSize: '14px' })

  const categoryColors: Record<string, string> = {
    retirement: 'var(--accent)', investment: 'var(--success)', savings: '#5a8fc4',
    real_estate: '#c4955a', crypto: '#9b5ac4', other: 'var(--sand-400)',
  }

  return (
    <div className="sheet-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.35)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div className="animate-slide" style={{ background: 'var(--sand-50)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '680px', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--sand-300)', borderRadius: '2px' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '12px 24px 14px', borderBottom: '0.5px solid var(--sand-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: colors[type] }}>{titles[type]}</h2>
          <button onClick={onClose} style={{ background: 'var(--sand-200)', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', color: 'var(--sand-700)' }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px 8px', flex: 1 }}>

          {/* Type-specific data */}
          {type === 'assets' && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '36px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 4px', letterSpacing: '-1px' }}>{fmt(totalAssets)}</p>
              <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 16px' }}>total assets</p>
              {(() => {
                const byCategory: Record<string, number> = {}
                profile?.assets?.forEach((a: any) => { byCategory[a.category] = (byCategory[a.category] || 0) + (a.value || 0) })
                return Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                  <div key={cat} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--sand-700)', textTransform: 'capitalize' }}>{cat.replace('_', ' ')}</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-900)' }}>{fmt(val)} · {totalAssets > 0 ? ((val / totalAssets) * 100).toFixed(0) : '0'}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${totalAssets > 0 ? (val / totalAssets) * 100 : 0}%`, background: categoryColors[cat] || 'var(--sand-400)' }} />
                    </div>
                  </div>
                ))
              })()}
              <div style={{ marginTop: '16px', borderTop: '0.5px solid var(--sand-200)', paddingTop: '12px' }}>
                {profile?.assets?.map((asset: any, i: number) => {
                  // Compute live value from positions if available
                  const positions = asset.positions || []
                  let liveValue: number | null = null
                  let todayChange: number | null = null
                  let hasAllQuotes = positions.length > 0
                  for (const pos of positions) {
                    const q = liveQuotes[pos.symbol]
                    if (q && pos.shares > 0) {
                      liveValue = (liveValue || 0) + pos.shares * q.price
                      todayChange = (todayChange || 0) + pos.shares * q.change
                    } else if (pos.shares > 0) {
                      hasAllQuotes = false
                    }
                  }
                  const displayValue = liveValue !== null ? liveValue : (asset.value || 0)
                  const isLive = liveValue !== null && hasAllQuotes

                  return (
                    <div key={i} style={{ padding: '10px 0', borderBottom: '0.5px solid var(--sand-200)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <p style={{ fontSize: '14px', fontWeight: '500', margin: 0, color: 'var(--sand-900)' }}>{asset.name}</p>
                            {isLive && (
                              <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--success)', background: 'rgba(122,158,110,0.12)', border: '0.5px solid var(--success)', borderRadius: '6px', padding: '1px 5px', letterSpacing: '0.04em' }}>LIVE</span>
                            )}
                          </div>
                          {asset.holdings && !positions.length && (
                            <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '1px 0 0' }}>{asset.holdings}</p>
                          )}
                          {isLive && positions.length > 0 && (
                            <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '1px 0 0' }}>
                              {positions.map((p: any) => p.symbol).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>{fmt(displayValue)}</p>
                          {isLive && todayChange !== null ? (
                            <p style={{ fontSize: '11px', fontWeight: '600', margin: '1px 0 0', color: todayChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {todayChange >= 0 ? '+' : ''}{fmt(todayChange)} today
                            </p>
                          ) : (
                            <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '1px 0 0' }}>{totalAssets > 0 ? ((displayValue / totalAssets) * 100).toFixed(1) : '0'}%</p>
                          )}
                        </div>
                      </div>
                      {/* Per-position breakdown when live */}
                      {isLive && positions.length > 1 && (
                        <div style={{ marginTop: '6px', paddingLeft: '0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {positions.map((pos: any, pi: number) => {
                            const q = liveQuotes[pos.symbol]
                            if (!q || !pos.shares) return null
                            const posValue = pos.shares * q.price
                            const posChange = pos.shares * q.change
                            return (
                              <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px', borderLeft: '2px solid var(--sand-200)' }}>
                                <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>{pos.symbol} · {pos.shares} {asset.category === 'crypto' ? 'units' : 'sh'} @ ${q.price.toFixed(2)}</span>
                                <span style={{ fontSize: '11px', fontWeight: '500', color: posChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                  {posChange >= 0 ? '+' : ''}{fmt(posChange)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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

          {/* AI Analysis */}
          <div style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', marginBottom: '16px', overflow: 'hidden' }}>
            <button
              onClick={() => setMinimizedAI(m => !m)}
              style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}>
              <div style={{ width: '24px', height: '24px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
              </div>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-700)', margin: 0, flex: 1, textAlign: 'left' }}>AI Analysis</p>
              <span style={{ fontSize: '11px', color: 'var(--sand-400)', transition: 'transform 0.2s', display: 'inline-block', transform: minimizedAI ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            {!minimizedAI && (
              <div style={{ padding: '0 16px 14px' }}>
                {loading ? (
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '4px 0' }}>
                    {[0, 150, 300].map(d => <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                  </div>
                ) : (
                  <div>{formatText(analysis)}</div>
                )}
              </div>
            )}
          </div>

          {/* Chat thread */}
          {chatMessages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '8px' }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width: '26px', height: '26px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
                    </div>
                  )}
                  <div style={{ maxWidth: '85%', background: msg.role === 'user' ? 'var(--accent)' : 'var(--sand-100)', border: msg.role === 'user' ? 'none' : '0.5px solid var(--sand-300)', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px' }}>
                    {msg.role === 'assistant'
                      ? <div style={{ fontSize: '13px', color: 'var(--sand-800)', lineHeight: '1.55' }}>{formatText(msg.content)}</div>
                      : <p style={{ fontSize: '13px', margin: 0, color: 'var(--sand-50)', lineHeight: '1.55' }}>{msg.content}</p>
                    }
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: '26px', height: '26px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
                  </div>
                  <div style={{ background: 'var(--sand-100)', border: '0.5px solid var(--sand-300)', borderRadius: '16px 16px 16px 4px', padding: '12px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[0, 150, 300].map(d => <div key={d} style={{ width: '5px', height: '5px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
          )}
        </div>

        {/* Fixed bottom: suggested chips + input */}
        <div style={{ borderTop: '0.5px solid var(--sand-200)', padding: '10px 20px 28px', flexShrink: 0, background: 'var(--sand-50)' }}>
          {/* Suggested question chips */}
          {chips.length > 0 && !chatLoading && (
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '10px', paddingBottom: '2px', WebkitOverflowScrolling: 'touch' as any }}>
              {chips.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendChat(q)}
                  disabled={loading}
                  style={{ flexShrink: 0, background: 'var(--sand-100)', border: '0.5px solid var(--sand-300)', borderRadius: '20px', padding: '6px 12px', fontSize: '12px', color: 'var(--sand-700)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Text input */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat(chatInput)}
              placeholder={loading ? 'Generating analysis…' : 'Ask a follow-up question…'}
              disabled={loading || chatLoading}
              style={{ flex: 1, borderRadius: '20px', fontSize: '14px', padding: '10px 16px', border: '0.5px solid var(--sand-300)', background: 'var(--sand-100)', color: 'var(--sand-900)', fontFamily: 'inherit', outline: 'none' }}
            />
            <button
              onClick={() => sendChat(chatInput)}
              disabled={!chatInput.trim() || loading || chatLoading}
              style={{ width: '40px', height: '40px', borderRadius: '50%', background: chatInput.trim() && !loading && !chatLoading ? 'var(--accent)' : 'var(--sand-300)', border: 'none', cursor: chatInput.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={chatInput.trim() && !loading ? 'var(--sand-50)' : 'var(--sand-500)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ASSET_CATEGORIES = [
  { value: 'retirement', label: 'Retirement account' },
  { value: 'brokerage', label: 'Brokerage / taxable investment' },
  { value: 'savings', label: 'Savings / cash' },
  { value: 'real_estate', label: 'Real estate' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'business', label: 'Business equity' },
  { value: 'other', label: 'Other' },
]

function AddAssetSheet({ onClose, onSave }: {
  onClose: () => void
  onSave: (asset: { name: string; category: string; value: number }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('savings')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const numVal = parseFloat(value.replace(/,/g, ''))
    if (!name.trim() || isNaN(numVal) || numVal < 0) return
    setSaving(true)
    await onSave({ name: name.trim(), category, value: numVal })
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '15px',
    border: '1px solid var(--sand-300)', borderRadius: 'var(--radius-sm)',
    background: 'var(--sand-50)', color: 'var(--sand-900)', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div className="sheet-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.35)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div className="animate-slide" style={{ background: 'var(--sand-50)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '680px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--sand-300)', borderRadius: '2px' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '12px 20px 14px', borderBottom: '0.5px solid var(--sand-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>Add Asset</h2>
          <button onClick={onClose} style={{ background: 'var(--sand-200)', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', color: 'var(--sand-700)' }}>×</button>
        </div>

        {/* Form */}
        <div style={{ padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-600)', display: 'block', marginBottom: '6px' }}>Name</label>
            <input
              style={inputStyle}
              placeholder="e.g. Vanguard 401(k), Home equity"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-600)', display: 'block', marginBottom: '6px' }}>Type</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={category} onChange={e => setCategory(e.target.value)}>
              {ASSET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-600)', display: 'block', marginBottom: '6px' }}>Current value</label>
            <input
              style={inputStyle}
              placeholder="0"
              inputMode="decimal"
              value={value}
              onChange={e => setValue(e.target.value)}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !value}
            style={{
              background: saving || !name.trim() || !value ? 'var(--sand-300)' : 'var(--accent)',
              color: 'var(--sand-50)', border: 'none', borderRadius: 'var(--radius-sm)',
              padding: '12px', fontSize: '15px', fontWeight: '600', cursor: saving || !name.trim() || !value ? 'default' : 'pointer',
              fontFamily: 'inherit', marginTop: '4px',
            }}
          >
            {saving ? 'Saving…' : 'Add Asset'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FocusPlanSheet({ action, analysis, loading, profile, onClose }: {
  action: { priority: number; title: string; description: string; impact: string; timeframe: string }
  analysis: string
  loading: boolean
  profile: any
  onClose: () => void
}) {
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chips, setChips] = useState<string[]>([])
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const parseFollowUps = (text: string): string[] => {
    const m = text.match(/<followups>([\s\S]*?)<\/followups>/)
    if (!m) return []
    try { return JSON.parse(m[1]) } catch { return [] }
  }
  const stripMeta = (text: string) =>
    text.replace(/<followups>[\s\S]*?<\/followups>/g, '').replace(/<chart>[\s\S]*?<\/chart>/g, '').trim()

  useEffect(() => {
    if (!loading && analysis) {
      const parsed = parseFollowUps(analysis)
      setChips(parsed.length ? parsed : [
        'What do I do on day one to start this?',
        'How long until I see real results?',
        'What are the biggest risks I should watch for?',
      ])
    }
  }, [analysis, loading])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  const sendChat = async (question: string) => {
    if (!question.trim() || chatLoading || loading) return
    const userMsg = { role: 'user' as const, content: question }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    setChips([])

    const apiMessages = chatMessages.length === 0 && analysis
      ? [{ role: 'assistant' as const, content: stripMeta(analysis) }, userMsg]
      : newMessages

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, profile, topic: 'general' })
      })
      const d = await r.json()
      const raw = d.message || ''
      setChips(parseFollowUps(raw))
      setChatMessages(prev => [...prev, { role: 'assistant', content: stripMeta(raw) }])
    } catch {}
    setChatLoading(false)
  }

  const formatText = (text: string) => formatAIText(stripMeta(text))

  return (
    <div className="sheet-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.35)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div className="animate-slide" style={{ background: 'var(--sand-50)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '680px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--sand-300)', borderRadius: '2px' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '12px 20px 14px', borderBottom: '0.5px solid var(--sand-200)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, marginRight: '12px' }}>
              <p style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 4px' }}>This week's focus</p>
              <h2 style={{ fontSize: '17px', fontWeight: '600', margin: '0 0 6px', color: 'var(--sand-900)', lineHeight: '1.35' }}>{action.title}</h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--sand-500)', background: 'var(--sand-200)', padding: '2px 8px', borderRadius: '20px', fontWeight: '500' }}>{action.timeframe}</span>
                <span style={{ fontSize: '10px', color: 'var(--sand-500)', background: 'var(--sand-200)', padding: '2px 8px', borderRadius: '20px', fontWeight: '500' }}>{action.impact} impact</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'var(--sand-200)', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', color: 'var(--sand-700)', flexShrink: 0 }}>×</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '16px 20px 8px', flex: 1 }}>

          {/* AI plan */}
          <div style={{ background: 'var(--sand-100)', border: '0.5px solid var(--sand-200)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '24px', height: '24px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
              </div>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-700)', margin: 0 }}>Your game plan</p>
            </div>
            {loading ? (
              <div>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '12px' }}>
                  {[0, 150, 300].map(d => <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                </div>
                {[75, 55, 90, 60, 80, 45].map((w, i) => (
                  <div key={i} style={{ height: '9px', width: `${w}%`, background: 'var(--sand-200)', borderRadius: '4px', marginBottom: '8px', animation: 'pulse 1.2s infinite', animationDelay: `${i * 70}ms` }} />
                ))}
              </div>
            ) : (
              <div>{formatText(analysis)}</div>
            )}
          </div>

          {/* Chat thread */}
          {chatMessages.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '8px' }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width: '26px', height: '26px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
                    </div>
                  )}
                  <div style={{ maxWidth: '85%', background: msg.role === 'user' ? 'var(--accent)' : 'var(--sand-100)', border: msg.role === 'user' ? 'none' : '0.5px solid var(--sand-300)', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px' }}>
                    {msg.role === 'assistant'
                      ? <div style={{ fontSize: '13px', color: 'var(--sand-800)', lineHeight: '1.55' }}>{formatText(msg.content)}</div>
                      : <p style={{ fontSize: '13px', margin: 0, color: 'var(--sand-50)', lineHeight: '1.55' }}>{msg.content}</p>
                    }
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: '26px', height: '26px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
                  </div>
                  <div style={{ background: 'var(--sand-100)', border: '0.5px solid var(--sand-300)', borderRadius: '16px 16px 16px 4px', padding: '12px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[0, 150, 300].map(d => <div key={d} style={{ width: '5px', height: '5px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
          )}
        </div>

        {/* Fixed bottom: chips + input */}
        <div style={{ borderTop: '0.5px solid var(--sand-200)', padding: '10px 20px 28px', flexShrink: 0, background: 'var(--sand-50)' }}>
          {chips.length > 0 && !chatLoading && (
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '10px', paddingBottom: '2px', WebkitOverflowScrolling: 'touch' as any }}>
              {chips.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendChat(q)}
                  disabled={loading}
                  style={{ flexShrink: 0, background: 'var(--sand-100)', border: '0.5px solid var(--sand-300)', borderRadius: '20px', padding: '6px 12px', fontSize: '12px', color: 'var(--sand-700)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat(chatInput)}
              placeholder={loading ? 'Building your plan…' : 'Ask about this plan…'}
              disabled={loading || chatLoading}
              style={{ flex: 1, borderRadius: '20px', fontSize: '14px', padding: '10px 16px', border: '0.5px solid var(--sand-300)', background: 'var(--sand-100)', color: 'var(--sand-900)', fontFamily: 'inherit', outline: 'none' }}
            />
            <button
              onClick={() => sendChat(chatInput)}
              disabled={!chatInput.trim() || loading || chatLoading}
              style={{ width: '38px', height: '38px', borderRadius: '50%', background: chatInput.trim() && !loading ? 'var(--accent)' : 'var(--sand-300)', border: 'none', cursor: chatInput.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={chatInput.trim() && !loading ? 'var(--sand-50)' : 'var(--sand-500)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function financialFingerprint(p: any): string {
  if (!p) return ''
  return JSON.stringify({
    assets: (p.assets || []).map((a: any) => ({ n: a.name, v: a.value })),
    debts: (p.debts || []).map((d: any) => ({ n: d.name, b: d.balance })),
    goals: (p.goals || []).map((g: any) => ({ n: g.name, c: g.current_amount })),
    income: p.monthly_income,
    expenses: p.monthly_expenses,
  })
}

export default function Home() {
  const navigate = useNavigate()
  const { preferences } = useTheme()
  const { userId, userEmail, profileData: profile, analysis, chatRefs, hasProfile, loading: profileLoading, liveQuotes, refreshLiveQuotes, updateProfile } = useProfile()
  const firstName = userEmail.split('@')[0] || 'there'
  const [analyzing, setAnalyzing] = useState(false)
  const [insightsRefreshing, setInsightsRefreshing] = useState(false)
  const [miniDash, setMiniDash] = useState<MiniDashboard | null>(null)
  const [cashFlowSheet, setCashFlowSheet] = useState<{ analysis: string; loading: boolean } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [analysisError, setAnalysisError] = useState(false)
  const [milestone, setMilestone] = useState<number | null>(null)
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null)
  const [editingGoalIdx, setEditingGoalIdx] = useState<number | null>(null)
  const [goalInputVal, setGoalInputVal] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)
  const [showAddAsset, setShowAddAsset] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'portfolio' | 'cashflow' | 'insights'>('overview')
  const [focusPlan, setFocusPlan] = useState<{ analysis: string; loading: boolean } | null>(null)
  const [nwHistory, setNwHistory] = useState<Array<{ net_worth: number; total_assets: number; total_liabilities: number; recorded_at: string; snapshot?: { assets: any[]; debts: any[]; goals: any[] } }>>([])
  const prevFingerprintRef = useRef<string>('')
  const analysisInProgressRef = useRef(false)

  useEffect(() => {
    if (profileLoading) return
    if (!hasProfile) { navigate('/onboarding'); return }
    const fp = profile ? financialFingerprint(profile) : ''
    const storedFp = userId ? localStorage.getItem(`lastAnalyzedFp_${userId}`) : null
    const profileChangedSinceAnalysis = fp && storedFp && fp !== storedFp
    if (analysis && !profileChangedSinceAnalysis) {
      saveNetWorthHistory(userId!, analysis, profile)
    } else if (profile) {
      // Either no analysis yet, or profile changed since last analysis ran
      runAnalysis(profile)
    }
    // Seed fingerprint on load so we only react to future changes
    if (fp) prevFingerprintRef.current = fp
    // Load last analyzed timestamp
    const stored = localStorage.getItem(`lastAnalyzed_${userId}`)
    if (stored) setLastAnalyzedAt(stored)
  }, [profileLoading])

  // Auto-refresh insights when financial data changes
  useEffect(() => {
    if (!profile || analysisInProgressRef.current) return
    const fp = financialFingerprint(profile)
    if (prevFingerprintRef.current && fp !== prevFingerprintRef.current) {
      prevFingerprintRef.current = fp
      runAnalysis(profile, !analysis) // full refresh if no analysis, silent if updating existing
    } else if (!prevFingerprintRef.current) {
      prevFingerprintRef.current = fp
    }
  }, [profile])

  useEffect(() => {
    if (!userId) return
    fetch(`/api/networth?userId=${userId}`)
      .then(r => r.json())
      .then(d => setNwHistory(d.history || []))
      .catch(() => {})
  }, [userId])

  // Track completed goals in localStorage so TrophySection can display them with dates
  useEffect(() => {
    if (!userId || !profile?.goals) return
    const now = JSON.stringify({ date: new Date().toISOString() })
    ;(profile.goals as any[]).forEach((g: any) => {
      if (g.target_amount > 0 && g.current_amount >= g.target_amount) {
        const k = `${userId}_goal_done_${g.name}`
        if (!localStorage.getItem(k)) localStorage.setItem(k, now)
      }
    })
  }, [profile?.goals, userId])

  const checkMilestone = (netWorth: number) => {
    if (!userId) return
    const allHit = MILESTONES.filter(m => netWorth >= m)
    if (!allHit.length) return

    const now = JSON.stringify({ date: new Date().toISOString() })

    // Silently backfill all lower milestones (no overlay — they were passed before we tracked)
    allHit.slice(0, -1).forEach(m => {
      const k = `${userId}_milestone_${m}`
      if (!localStorage.getItem(k)) localStorage.setItem(k, now)
    })

    // Show overlay only for the highest milestone if it's new
    const highest = allHit[allHit.length - 1]
    const highestKey = `${userId}_milestone_${highest}`
    if (!localStorage.getItem(highestKey)) {
      setMilestone(highest)
      localStorage.setItem(highestKey, now)
    }
  }

  const saveNetWorthHistory = async (uid: string, analysisData: Analysis, profileData?: any) => {
    try {
      const snapshot = profileData ? {
        assets: (profileData.assets || []).map((a: any) => ({ name: a.name, category: a.category, value: a.value || 0 })),
        debts: (profileData.debts || []).map((d: any) => ({ name: d.name, type: d.type, balance: d.balance || 0 })),
        goals: (profileData.goals || []).map((g: any) => ({ name: g.name, current_amount: g.current_amount || 0, target_amount: g.target_amount || 0 })),
        monthly_income: profileData.monthly_income || 0,
        monthly_expenses: profileData.monthly_expenses || 0,
      } : undefined
      await fetch('/api/networth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          netWorth: analysisData.netWorth,
          totalAssets: analysisData.totalAssets,
          totalLiabilities: analysisData.totalLiabilities,
          snapshot,
        })
      })
    } catch (err) { console.error('Failed to save net worth history:', err) }
  }

  const runAnalysis = async (profileData: any, silent = false) => {
    if (analysisInProgressRef.current) return
    analysisInProgressRef.current = true
    if (silent) setInsightsRefreshing(true)
    else setAnalyzing(true)
    setAnalysisError(false)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })
      const result = await res.json()
      if (!result || result.error || typeof result.netWorth !== 'number') {
        throw new Error(result?.error || 'Invalid analysis response')
      }
      await updateProfile({ analysis: result })
      if (userId) {
        saveNetWorthHistory(userId, result, profileData)
        checkMilestone(result.netWorth)
        const now = new Date().toISOString()
        localStorage.setItem(`lastAnalyzed_${userId}`, now)
        localStorage.setItem(`lastAnalyzedFp_${userId}`, financialFingerprint(profileData))
        setLastAnalyzedAt(now)
      }
    } catch (err) {
      console.error('Analysis failed:', err)
      setAnalysisError(true)
    }
    if (silent) setInsightsRefreshing(false)
    else setAnalyzing(false)
    analysisInProgressRef.current = false
  }

  const openMiniDash = async (type: 'assets' | 'debts' | 'savings') => {
    setMiniDash({ type, analysis: '', loading: true })
    if (type === 'assets') refreshLiveQuotes()
    const availableToSave = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)
    const totalAssets = analysis?.totalAssets ?? profile?.assets?.reduce((s: number, a: any) => s + (a.value || 0), 0) ?? 0
    const prompts = {
      assets: `Diversification score and top 2-3 optimizations for my assets: ${profile?.assets?.map((a: any) => `${a.name}(${a.category}):$${(a.value||0).toLocaleString()}`).join(', ') || 'none'}. Total $${totalAssets.toLocaleString()}.`,
      debts: `Optimal payoff strategy for: ${profile?.debts?.map((d: any) => `${d.name}:$${(d.balance||0).toLocaleString()}@${d.interest_rate}%`).join(', ') || 'none'}. Income $${(profile?.monthly_income||0).toLocaleString()}/mo. Priority order and exact monthly amounts.`,
      savings: `Exact dollar allocation for $${availableToSave.toLocaleString()}/mo surplus (income $${(profile?.monthly_income||0).toLocaleString()}, expenses $${(profile?.monthly_expenses||0).toLocaleString()}). Assets: ${profile?.assets?.map((a: any) => `${a.name}:$${(a.value||0).toLocaleString()}`).join(', ') || 'none'}.`
    }
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompts[type] }], profile: profile || {}, topic: 'general' })
      })
      const data = await res.json()
      setMiniDash({ type, analysis: data.message || 'No response received.', loading: false })
    } catch {
      setMiniDash({ type, analysis: 'Unable to load analysis. Check your connection and try again.', loading: false })
    }
  }

  const openCashFlowSheet = async () => {
    setCashFlowSheet({ analysis: '', loading: true })
    const avail = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)
    const savingsRate = profile?.monthly_income > 0 ? Math.round((avail / profile.monthly_income) * 100) : 0
    const goalsStr = profile?.goals?.map((g: any) => `${g.name}: need $${(g.target_amount || 0).toLocaleString()}, have $${(g.current_amount || 0).toLocaleString()}, timeline: ${g.timeline || 'unset'}`).join('; ') || 'none set'
    const debtsStr = profile?.debts?.map((d: any) => `${d.name}: $${d.balance} @ ${d.interest_rate}%`).join(', ') || 'none'
    const prompt = `Cash flow: income $${profile?.monthly_income||0}/mo, expenses $${profile?.monthly_expenses||0}/mo, surplus $${avail} (${savingsRate}%). Goals: ${goalsStr}. Debts: ${debtsStr}. Give: top 2 cash flow drivers using my numbers, highest-leverage action this month with exact dollar amount, which goals are on/off track, realistic surplus target and how to reach it.`
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], profile: profile || {}, topic: 'cashflow' })
      })
      const data = await res.json()
      setCashFlowSheet({ analysis: data.message || 'No response received.', loading: false })
    } catch {
      setCashFlowSheet({ analysis: 'Unable to load analysis. Check your connection and try again.', loading: false })
    }
  }

  const openFocusPlan = async (action: { title: string; description: string; impact: string; timeframe: string }) => {
    setFocusPlan({ analysis: '', loading: true })
    const goals = profile?.goals?.map((g: any) => `${g.name}: $${(g.current_amount || 0).toLocaleString()} / $${(g.target_amount || 0).toLocaleString()} (${g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0}%)`).join(', ') || 'none set'
    const debts = profile?.debts?.sort((a: any, b: any) => b.interest_rate - a.interest_rate).map((d: any) => `${d.name}: $${(d.balance || 0).toLocaleString()} @ ${d.interest_rate}%`).join(', ') || 'none'
    const avail = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)
    const priorWins = completedFocusItems.length
      ? ` Previously completed: ${completedFocusItems.slice(-5).map((c: any) => `"${c.title}"`).join(', ')} — acknowledge this progress and build on it.`
      : ''
    const prompt = `Priority: "${action.title}" (${action.impact} impact, ${action.timeframe}). ${action.description} Surplus $${avail.toLocaleString()}/mo. Goals: ${goals}. Debts: ${debts}.${priorWins} Give: why this is my best move now using my actual numbers, step-by-step execution plan this week with exact amounts, how it advances my goals, progress at 30/60/90 days with real numbers.`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], profile: profile || {}, topic: 'general' })
      })
      const data = await res.json()
      setFocusPlan({ analysis: data.message || 'No response received.', loading: false })
    } catch {
      setFocusPlan({ analysis: 'Unable to load plan. Check your connection and try again.', loading: false })
    }
  }

  const openChat = async (key: string, prompt: string, title: string) => {
    if (!userId) { navigate('/chats'); return }
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data, error } = await supabase.from('chats').insert({ user_id: userId, title, topic: 'general', messages: [] }).select().single()
    if (data) {
      await updateProfile({ chat_refs: { ...chatRefs, [key]: data.id } })
      navigate(`/chat/${data.id}`, { state: { prompt } })
    } else if (error) {
      navigate('/chats')
    }
  }

  const saveGoalProgress = async (idx: number) => {
    if (!profile) return
    const val = parseFloat(goalInputVal)
    if (isNaN(val)) { setEditingGoalIdx(null); return }
    setSavingGoal(true)
    const updatedGoals = profile.goals.map((g: any, i: number) =>
      i === idx ? { ...g, current_amount: val } : g
    )
    const updatedProfile = { ...profile, goals: updatedGoals }
    await updateProfile({ profile_data: updatedProfile })
    setSavingGoal(false)
    setEditingGoalIdx(null)
  }

  const saveNewAsset = async (asset: { name: string; category: string; value: number }) => {
    if (!profile) return
    const updatedProfile = { ...profile, assets: [...(profile.assets || []), asset] }
    await updateProfile({ profile_data: updatedProfile })
    setShowAddAsset(false)
    runAnalysis(updatedProfile, true)
  }

  const isVisible = (id: string) => !preferences.hiddenSections.includes(id)
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)

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

  const completedFocusItems: any[] = profile?.completed_focus_items || []
  const completedTitles = new Set(completedFocusItems.map((c: any) => c.title?.toLowerCase().trim()))
  const topAction = analysis.nextActions?.find((a: any) => !completedTitles.has(a.title?.toLowerCase().trim()))

  const completeFocusItem = async (action: { title: string; description: string }) => {
    const newItem = { title: action.title, description: action.description, completedAt: new Date().toISOString() }
    const updated = [...completedFocusItems, newItem]
    await updateProfile({ profile_data: { ...profile, completed_focus_items: updated } })
  }

  const HOME_TABS = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'portfolio' as const, label: 'Portfolio' },
    { id: 'cashflow' as const, label: 'Cash Flow' },
    { id: 'insights' as const, label: 'Insights' },
  ]

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 0 100px' }}>

      {/* Header */}
      <div style={{ padding: '52px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 2px' }}>{greeting()}, {firstName}</p>
          <h1 style={{ fontSize: '20px', fontWeight: '500', color: 'var(--sand-900)', margin: 0, letterSpacing: '-0.3px' }}>
            {activeTab === 'overview' ? 'Overview' : activeTab === 'portfolio' ? 'Portfolio' : activeTab === 'cashflow' ? 'Cash Flow' : 'Insights'}
          </h1>
          {lastAnalyzedAt && (
            <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '2px 0 0' }}>Updated {timeAgo(lastAnalyzedAt)}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', paddingTop: '4px' }}>
          <button onClick={() => navigate('/onboarding')}
            style={{ background: 'var(--sand-200)', border: 'none', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-600)' }}
            title="Update financials">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
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

      {/* Tab bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--sand-100)', paddingTop: '16px', paddingBottom: '2px' }}>
        <div style={{ display: 'flex', gap: '0', padding: '0 16px', borderBottom: '0.5px solid var(--sand-200)' }}>
          {HOME_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '13px', fontWeight: activeTab === tab.id ? '600' : '400',
                color: activeTab === tab.id ? 'var(--sand-900)' : 'var(--sand-400)',
                padding: '8px 14px 10px',
                borderBottom: activeTab === tab.id ? '2px solid var(--sand-900)' : '2px solid transparent',
                marginBottom: '-0.5px',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: '16px 16px 0' }}>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (<>

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

        {showHistory && userId && (
          <div className="animate-fade" style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '0.5px solid var(--sand-200)' }}>
            <NetWorthChart userId={userId} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { id: 'assets', label: 'Assets', value: fmt(analysis.totalAssets), color: 'var(--sand-900)', bg: 'var(--sand-200)' },
            { id: 'debts', label: 'Debts', value: fmt(analysis.totalLiabilities), color: 'var(--danger)', bg: 'rgba(192,57,43,0.06)' },
            { id: 'savings', label: 'Save/mo', value: fmt(analysis.availableToSave), color: 'var(--success)', bg: 'rgba(122,158,110,0.08)' }
          ].map(item => (
            <button key={item.id} onClick={() => openMiniDash(item.id as any)}
              style={{ background: item.bg, border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 8px', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit', transition: `transform var(--spring-fast), opacity var(--transition)` }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1.03)')}>
              <p className="label" style={{ marginBottom: '3px', fontSize: '9px' }}>{item.label}</p>
              <p style={{ fontSize: '13px', fontWeight: '600', color: item.color, margin: '0 0 3px' }}>{item.value}</p>
              <p style={{ fontSize: '9px', color: 'var(--sand-500)', margin: 0 }}>tap to analyze</p>
            </button>
          ))}
        </div>
      </div>

      {/* Financial Health Score */}
      {isVisible('health') && (
        <HealthScoreCard analysis={analysis} profile={profile} />
      )}

      {/* Today's Focus */}
      {isVisible('focus') && topAction && (
        <div className="animate-fade stagger-2" style={{ marginBottom: '12px', background: 'var(--accent)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => openFocusPlan(topAction)}
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-sm)', padding: '9px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', flex: 1, textAlign: 'center' }}>
              Attack this →
            </button>
            <button
              onClick={() => completeFocusItem(topAction)}
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              ✓ Done
            </button>
          </div>
        </div>
      )}

      </>)}

      {/* ── PORTFOLIO TAB ── */}
      {activeTab === 'portfolio' && (<>

      {/* Net Worth summary */}
      <div className="card animate-fade" style={{ marginBottom: '12px', padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p className="label" style={{ marginBottom: '2px' }}>Net Worth</p>
            <p style={{ fontSize: '28px', fontWeight: '300', color: 'var(--sand-900)', margin: 0, letterSpacing: '-1px', lineHeight: 1 }}>
              <CountUp value={analysis.netWorth} />
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '0 0 1px' }}>Assets</p>
              <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sand-900)', margin: 0 }}>{fmt(analysis.totalAssets)}</p>
            </div>
            <div style={{ width: '0.5px', background: 'var(--sand-200)' }} />
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '0 0 1px' }}>Debts</p>
              <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--danger)', margin: 0 }}>{fmt(analysis.totalLiabilities)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Assets breakdown */}
      {(() => {
        const assets: any[] = profile?.assets || []
        if (assets.length === 0) return null

        const historySpanMs = nwHistory.length >= 2
          ? new Date(nwHistory[nwHistory.length - 1].recorded_at).getTime() - new Date(nwHistory[0].recorded_at).getTime()
          : 0
        const hasHistory = nwHistory.length >= 2 && historySpanMs >= 24 * 60 * 60 * 1000

        const assetDeltaMap = new Map<string, number>()
        const debtDeltaMap = new Map<string, number>()
        const debtHistoryMap = new Map<string, number[]>()
        if (hasHistory) {
          const firstSnap = nwHistory.find(h => h.snapshot?.assets?.length)
          const lastSnap = [...nwHistory].reverse().find(h => h.snapshot?.assets?.length)
          if (firstSnap && lastSnap && firstSnap !== lastSnap) {
            for (const la of lastSnap.snapshot!.assets) {
              const ea = firstSnap.snapshot!.assets.find((a: any) => a.name === la.name)
              if (ea != null) assetDeltaMap.set(la.name, (la.value || 0) - (ea.value || 0))
            }
            for (const ld of (lastSnap.snapshot!.debts || [])) {
              const ed = firstSnap.snapshot!.debts?.find((d: any) => d.name === ld.name)
              if (ed != null) debtDeltaMap.set(ld.name, (ed.balance || 0) - (ld.balance || 0))
            }
          }
          for (const h of nwHistory) {
            if (!h.snapshot?.debts) continue
            for (const d of h.snapshot.debts) {
              if (!debtHistoryMap.has(d.name)) debtHistoryMap.set(d.name, [])
              debtHistoryMap.get(d.name)!.push(d.balance || 0)
            }
          }
        }

        const ASSET_META: Record<string, { icon: string; trend: 'up' | 'down' | 'neutral'; label: string }> = {
          retirement: { icon: '🏦', trend: 'up', label: 'Retirement' },
          investment: { icon: '📈', trend: 'up', label: 'Investment' },
          brokerage: { icon: '📈', trend: 'up', label: 'Brokerage' },
          real_estate: { icon: '🏠', trend: 'up', label: 'Real Estate' },
          cash: { icon: '💵', trend: 'neutral', label: 'Cash' },
          savings: { icon: '🏧', trend: 'neutral', label: 'Savings' },
          checking: { icon: '🏧', trend: 'neutral', label: 'Checking' },
          vehicle: { icon: '🚗', trend: 'down', label: 'Vehicle' },
          auto: { icon: '🚗', trend: 'down', label: 'Auto' },
          crypto: { icon: '₿', trend: 'up', label: 'Crypto' },
        }
        const getMeta = (cat: string) => ASSET_META[cat?.toLowerCase()] || { icon: '💼', trend: 'neutral' as const, label: cat || 'Asset' }

        const totalAssets = assets.reduce((s: number, a: any) => s + (a.value || 0), 0)

        const GROUPS = [
          { trend: 'up' as const, label: 'Appreciating', color: 'var(--success)', badgeBg: 'rgba(122,158,110,0.12)', arrow: '↑' },
          { trend: 'neutral' as const, label: 'Stable', color: 'var(--sand-500)', badgeBg: 'var(--sand-200)', arrow: '→' },
          { trend: 'down' as const, label: 'Depreciating', color: 'var(--danger)', badgeBg: 'rgba(192,80,59,0.10)', arrow: '↓' },
        ]
        const grouped = GROUPS.map(g => ({
          ...g,
          items: assets.filter((a: any) => getMeta(a.category).trend === g.trend),
        })).filter(g => g.items.length > 0)

        const fmtD = (n: number) => {
          const abs = Math.abs(n), prefix = n >= 0 ? '+' : '-'
          if (abs >= 1000000) return `${prefix}$${(abs / 1000000).toFixed(1)}M`
          if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
          return `${prefix}$${abs.toFixed(0)}`
        }

        const TYPICAL_GROWTH: Record<string, { label: string; color: 'up' | 'neutral' | 'down' }> = {
          retirement: { label: '~7–10%/yr avg', color: 'up' },
          investment: { label: '~7–10%/yr avg', color: 'up' },
          brokerage: { label: '~7–10%/yr avg', color: 'up' },
          real_estate: { label: '~4–6%/yr avg', color: 'up' },
          crypto: { label: 'High volatility', color: 'up' },
          cash: { label: '~4–5%/yr (HYSA)', color: 'neutral' },
          savings: { label: '~4–5%/yr (HYSA)', color: 'neutral' },
          checking: { label: 'Inflation risk', color: 'neutral' },
          vehicle: { label: '~15–20%/yr loss', color: 'down' },
          auto: { label: '~15–20%/yr loss', color: 'down' },
        }

        return (
          <div className="card animate-fade" style={{ marginBottom: '12px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--sand-600)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assets</p>
              <button
                onClick={() => setShowAddAsset(true)}
                style={{ background: 'var(--sand-200)', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-600)', flexShrink: 0 }}
                title="Add asset"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {grouped.map((group, gi) => (
                <div key={gi}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: group.color, background: group.badgeBg, padding: '3px 9px', borderRadius: '20px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {group.arrow} {group.label}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--sand-400)' }}>{group.items.length} asset{group.items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {group.items.map((asset: any, i: number) => {
                      const meta = getMeta(asset.category)
                      const pct = totalAssets > 0 ? Math.round(((asset.value || 0) / totalAssets) * 100) : 0
                      const delta = assetDeltaMap.has(asset.name) ? assetDeltaMap.get(asset.name)! : null
                      const oldVal = delta != null ? (asset.value || 0) - delta : null
                      const growthPct = delta != null && oldVal != null && oldVal > 0 ? (delta / oldVal) * 100 : null
                      const typical = TYPICAL_GROWTH[asset.category?.toLowerCase()]
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                            <span style={{ fontSize: '18px', flexShrink: 0 }}>{meta.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '13px', color: 'var(--sand-900)', margin: 0, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</p>
                              <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: 0 }}>{meta.label} · {pct}% of assets</p>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--sand-900)', margin: 0 }}>{fmt(asset.value || 0)}</p>
                              {growthPct != null ? (
                                <p style={{ fontSize: '10px', margin: '1px 0 0', fontWeight: '600', color: delta! >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                  {delta! >= 0 ? '+' : ''}{growthPct.toFixed(1)}% ({fmtD(delta!)}) all time
                                </p>
                              ) : typical ? (
                                <p style={{ fontSize: '10px', margin: '1px 0 0', fontWeight: '600', color: typical.color === 'up' ? 'var(--success)' : typical.color === 'down' ? 'var(--danger)' : 'var(--sand-400)' }}>
                                  {typical.label}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div style={{ height: '3px', background: 'var(--sand-200)', borderRadius: '2px' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: group.color, borderRadius: '2px', transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {gi < grouped.length - 1 && <div style={{ height: '0.5px', background: 'var(--sand-200)', marginTop: '16px' }} />}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Debts breakdown */}
      {(() => {
        const debts: any[] = profile?.debts || []
        if (debts.length === 0) return null

        const historySpanMs = nwHistory.length >= 2
          ? new Date(nwHistory[nwHistory.length - 1].recorded_at).getTime() - new Date(nwHistory[0].recorded_at).getTime()
          : 0
        const hasHistory = nwHistory.length >= 2 && historySpanMs >= 24 * 60 * 60 * 1000

        const debtDeltaMap = new Map<string, number>()
        const debtHistoryMap = new Map<string, number[]>()
        const totalLiab = nwHistory.length ? nwHistory[nwHistory.length - 1].total_liabilities : debts.reduce((s: number, d: any) => s + (d.balance || 0), 0)
        const liabChange = (() => {
          if (nwHistory.length < 2) return 0
          return nwHistory[nwHistory.length - 1].total_liabilities - nwHistory[0].total_liabilities
        })()

        if (hasHistory) {
          const firstSnap = nwHistory.find(h => h.snapshot?.assets?.length)
          const lastSnap = [...nwHistory].reverse().find(h => h.snapshot?.assets?.length)
          if (firstSnap && lastSnap && firstSnap !== lastSnap) {
            for (const ld of (lastSnap.snapshot!.debts || [])) {
              const ed = firstSnap.snapshot!.debts?.find((d: any) => d.name === ld.name)
              if (ed != null) debtDeltaMap.set(ld.name, (ed.balance || 0) - (ld.balance || 0))
            }
          }
          for (const h of nwHistory) {
            if (!h.snapshot?.debts) continue
            for (const d of h.snapshot.debts) {
              if (!debtHistoryMap.has(d.name)) debtHistoryMap.set(d.name, [])
              debtHistoryMap.get(d.name)!.push(d.balance || 0)
            }
          }
        }

        const fmtD = (n: number) => {
          const abs = Math.abs(n), prefix = n >= 0 ? '+' : '-'
          if (abs >= 1000000) return `${prefix}$${(abs / 1000000).toFixed(1)}M`
          if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
          return `${prefix}$${abs.toFixed(0)}`
        }

        const highRateDebt = debts.some((d: any) => (d.interest_rate || 0) >= 15)

        return (
          <div className="card animate-fade" style={{ marginBottom: '12px', padding: '14px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--sand-600)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Debts</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {debts.map((debt: any, i: number) => {
                const rate = debt.interest_rate || 0
                const isHigh = rate >= 15
                const isMed = rate >= 8
                const rateColor = isHigh ? 'var(--danger)' : isMed ? 'var(--warning)' : 'var(--success)'
                const maxDebt = Math.max(...debts.map((d: any) => d.balance || 0))
                const pct = maxDebt > 0 ? Math.round(((debt.balance || 0) / maxDebt) * 100) : 0
                const debtHist = debtHistoryMap.get(debt.name)
                const debtSparkPath = debtHist && debtHist.length >= 2 ? buildSparkPath(debtHist, 280, 28) : null
                const debtDelta = debtDeltaMap.get(debt.name)
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '18px', flexShrink: 0 }}>{isHigh ? '⚠️' : '💳'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', color: 'var(--sand-900)', margin: 0, fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{debt.name}</p>
                        <p style={{ fontSize: '10px', margin: 0, color: rateColor, fontWeight: isHigh ? '600' : '400' }}>
                          {rate}% APR · {isHigh ? 'High rate — prioritize payoff!' : isMed ? 'Medium rate' : 'Low rate'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--sand-900)', margin: 0 }}>{fmt(debt.balance || 0)}</p>
                        {debtDelta != null ? (
                          <p style={{ fontSize: '10px', margin: '1px 0 0', fontWeight: '600', color: debtDelta > 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {debtDelta > 0 ? `▼ ${fmtD(debtDelta)} paid off` : `▲ ${fmtD(Math.abs(debtDelta))} added`}
                          </p>
                        ) : (
                          <p style={{ fontSize: '10px', color: 'var(--success)', margin: '1px 0 0', fontWeight: '600' }}>▼ Paying off</p>
                        )}
                      </div>
                    </div>
                    <div style={{ height: '3px', background: 'var(--sand-200)', borderRadius: '2px', marginBottom: debtSparkPath ? '6px' : '0' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: rateColor, borderRadius: '2px', transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)', opacity: 0.6 }} />
                    </div>
                    {debtSparkPath && (
                      <svg width="100%" height="28" viewBox="0 0 280 28" preserveAspectRatio="none" style={{ display: 'block', opacity: 0.65 }}>
                        <path d={debtSparkPath} fill="none" stroke={rateColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
                      </svg>
                    )}
                  </div>
                )
              })}
            </div>
            {highRateDebt && (
              <div style={{ marginTop: '12px', padding: '8px 10px', background: 'rgba(192,57,43,0.07)', borderRadius: 'var(--radius-sm)', border: '0.5px solid rgba(192,57,43,0.15)' }}>
                <p style={{ fontSize: '12px', color: 'var(--danger)', margin: 0 }}>⚠ High-rate debt detected. Pay this off before investing further — you're losing more to interest than you'd gain.</p>
              </div>
            )}
          </div>
        )
      })()}

      </>)}

      {/* ── CASH FLOW TAB ── */}
      {activeTab === 'cashflow' && (() => {
        const totalDebtPayments = (profile?.debts || []).reduce((s: number, d: any) => s + (d.monthly_payment || d.minimum_payment || 0), 0)
        const totalGoalContributions = (profile?.goals || []).reduce((s: number, g: any) => s + (g.monthly_contribution || 0), 0)
        const efMonths = profile?.emergency_fund_months || 0
        const efTarget = 6
        const efPct = Math.min(100, (efMonths / efTarget) * 100)
        const surplus = analysis.availableToSave
        const income = analysis.monthlyIncome
        const expenses = analysis.monthlyExpenses
        const incomeSources = (profile?.income_sources || []).filter((s: any) => s.amount > 0)
        const budgetHealth = analysis.budgetHealth

        return (<>

        {/* Hero: monthly snapshot */}
        <div className="card animate-fade" style={{ padding: '20px 20px 16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <p className="label" style={{ marginBottom: '4px' }}>Monthly surplus</p>
              <p style={{ fontSize: '34px', fontWeight: '300', letterSpacing: '-1px', color: surplus >= 0 ? 'var(--sand-900)' : 'var(--danger)', margin: 0, lineHeight: 1 }}>
                {surplus >= 0 ? '+' : ''}{fmt(surplus)}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px',
                background: budgetHealth === 'healthy' ? 'rgba(122,158,110,0.12)' : budgetHealth === 'tight' ? 'rgba(210,160,60,0.12)' : 'rgba(192,57,43,0.1)',
                color: budgetHealth === 'healthy' ? 'var(--success)' : budgetHealth === 'tight' ? '#b8860b' : 'var(--danger)',
              }}>
                {budgetHealth === 'healthy' ? 'Healthy ✓' : budgetHealth === 'tight' ? 'Tight' : 'Over budget'}
              </span>
              <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '6px 0 0' }}>
                {income > 0 ? `${Math.round(analysis.savingsRate)}% savings rate` : ''}
              </p>
            </div>
          </div>

          {/* Income / Expenses / Left stacked bars */}
          {income > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Income', value: income, color: 'var(--success)', pct: 100 },
                { label: 'Expenses', value: expenses, color: 'var(--danger)', pct: income > 0 ? (expenses / income) * 100 : 0 },
                { label: 'Left over', value: surplus, color: 'var(--accent)', pct: income > 0 ? Math.max(0, (surplus / income) * 100) : 0 },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--sand-500)' }}>{row.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-800)' }}>{fmt(row.value)}</span>
                  </div>
                  <div style={{ height: '5px', background: 'var(--sand-200)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, row.pct))}%`, background: row.color, borderRadius: '3px', transition: 'width 1.1s cubic-bezier(0.22,1,0.36,1)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="btn-ghost" onClick={openCashFlowSheet} style={{ fontSize: '11px', padding: '3px 8px', marginTop: '14px', width: '100%', textAlign: 'center' }}>
            Get AI analysis →
          </button>
        </div>

        {/* Income sources */}
        {incomeSources.length > 0 && (
          <div className="animate-fade stagger-2" style={{ marginBottom: '12px' }}>
            <p className="label" style={{ marginBottom: '8px' }}>Income sources</p>
            <div className="card" style={{ padding: '4px 0' }}>
              <div style={{ padding: '12px 18px', borderBottom: '0.5px solid var(--sand-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--sand-700)' }}>Primary</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-900)' }}>{fmt(income)}/mo</span>
              </div>
              {incomeSources.map((src: any, i: number) => {
                const monthly = src.frequency === 'annual' ? src.amount / 12 : src.amount
                return (
                  <div key={i} style={{ padding: '12px 18px', borderBottom: i < incomeSources.length - 1 ? '0.5px solid var(--sand-200)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '13px', color: 'var(--sand-700)', textTransform: 'capitalize' }}>{src.type.replace(/_/g, ' ')}</span>
                      {src.description && <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '1px 0 0' }}>{src.description}</p>}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-900)' }}>{fmt(monthly)}/mo</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Where surplus goes */}
        {(totalDebtPayments > 0 || totalGoalContributions > 0) && (
          <div className="animate-fade stagger-3" style={{ marginBottom: '12px' }}>
            <p className="label" style={{ marginBottom: '8px' }}>Where it goes</p>
            <div className="card" style={{ padding: '4px 0' }}>
              {totalDebtPayments > 0 && (
                <div style={{ padding: '12px 18px', borderBottom: totalGoalContributions > 0 ? '0.5px solid var(--sand-200)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--sand-700)' }}>Debt payments</span>
                    <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '1px 0 0' }}>{(profile?.debts || []).length} account{(profile?.debts || []).length !== 1 ? 's' : ''}</p>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--danger)' }}>−{fmt(totalDebtPayments)}/mo</span>
                </div>
              )}
              {totalGoalContributions > 0 && (
                <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--sand-700)' }}>Goal savings</span>
                    <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '1px 0 0' }}>{(profile?.goals || []).filter((g: any) => g.monthly_contribution > 0).length} active goal{(profile?.goals || []).filter((g: any) => g.monthly_contribution > 0).length !== 1 ? 's' : ''}</p>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)' }}>{fmt(totalGoalContributions)}/mo</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Emergency fund */}
        {efMonths > 0 && (
          <div className="animate-fade stagger-4" style={{ marginBottom: '12px' }}>
            <p className="label" style={{ marginBottom: '8px' }}>Emergency fund</p>
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                <div>
                  <p style={{ fontSize: '26px', fontWeight: '300', color: 'var(--sand-900)', margin: 0, letterSpacing: '-0.5px', lineHeight: 1 }}>{efMonths} <span style={{ fontSize: '14px', color: 'var(--sand-500)', fontWeight: '400' }}>months</span></p>
                  <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '3px 0 0' }}>of expenses covered</p>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px',
                  background: efMonths >= 6 ? 'rgba(122,158,110,0.12)' : efMonths >= 3 ? 'rgba(210,160,60,0.1)' : 'rgba(192,57,43,0.08)',
                  color: efMonths >= 6 ? 'var(--success)' : efMonths >= 3 ? '#b8860b' : 'var(--danger)',
                }}>
                  {efMonths >= 6 ? 'Fully funded ✓' : efMonths >= 3 ? 'Partially funded' : 'Build this up'}
                </span>
              </div>
              <div style={{ height: '5px', background: 'var(--sand-200)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${efPct}%`, background: efMonths >= 6 ? 'var(--success)' : efMonths >= 3 ? '#d4a017' : 'var(--danger)', borderRadius: '3px', transition: 'width 1.1s cubic-bezier(0.22,1,0.36,1)' }} />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '8px 0 0' }}>Target: 6 months{efMonths < 6 ? ` — ${6 - efMonths} more to go` : ''}</p>
            </div>
          </div>
        )}

        {/* Savings goals */}
        {isVisible('goals') && (profile?.goals?.length || 0) > 0 && (
          <div className="animate-fade stagger-5" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <p className="label">Savings goals</p>
              <button className="btn-ghost" onClick={() => navigate('/onboarding?step=4')} style={{ fontSize: '11px', padding: '3px 8px' }}>Edit</button>
            </div>
            <div className="card" style={{ padding: '4px 0' }}>
              {profile.goals.map((goal: any, i: number) => {
                const pct = Math.min(100, goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0)
                const isEditing = editingGoalIdx === i
                return (
                  <div key={i} style={{ padding: '14px 18px', borderBottom: i < profile.goals.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 1px' }}>{goal.name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: 0 }}>
                          {goal.timeline && <span>{goal.timeline}</span>}
                          {goal.monthly_contribution > 0 && <span>{goal.timeline ? ' · ' : ''}{fmt(goal.monthly_contribution)}/mo</span>}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: pct >= 100 ? 'var(--success)' : 'var(--sand-900)', margin: '0 0 1px' }}>{pct}%</p>
                        <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: 0 }}>{fmt(goal.current_amount)} / {fmt(goal.target_amount)}</p>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: 'var(--sand-200)', borderRadius: '2px', marginBottom: '10px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : 'var(--accent)', borderRadius: '2px', transition: 'width 1.1s cubic-bezier(0.22,1,0.36,1)' }} />
                    </div>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--sand-600)' }}>$</span>
                          <input
                            autoFocus type="number" value={goalInputVal}
                            onChange={e => setGoalInputVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveGoalProgress(i); if (e.key === 'Escape') setEditingGoalIdx(null) }}
                            placeholder={goal.current_amount.toString()}
                            style={{ width: '100%', paddingLeft: '22px', paddingRight: '8px', paddingTop: '7px', paddingBottom: '7px', fontSize: '13px', background: 'var(--sand-200)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', color: 'var(--sand-900)', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <button onClick={() => saveGoalProgress(i)} disabled={savingGoal} className="btn-primary" style={{ padding: '7px 14px', fontSize: '12px', flexShrink: 0 }}>{savingGoal ? '...' : 'Save'}</button>
                        <button onClick={() => setEditingGoalIdx(null)} className="btn-ghost" style={{ padding: '7px 10px', fontSize: '12px', flexShrink: 0 }}>Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingGoalIdx(i); setGoalInputVal(goal.current_amount?.toString() || '0') }}
                        className="btn-ghost"
                        style={{ fontSize: '11px', padding: '4px 10px', width: '100%', textAlign: 'center' }}>
                        Update progress
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        </>)
      })()}

      {/* ── INSIGHTS TAB ── */}
      {activeTab === 'insights' && (<>

      {/* Key Insights */}
      {isVisible('insights') && (
        <InsightsStrip analysis={analysis} profile={profile} refreshing={insightsRefreshing} />
      )}

      {/* Market Recap */}
      <MarketRecap profile={profile} />

      {/* Achievements / Trophy collection */}
      {userId && (
        <TrophySection userId={userId} goals={profile?.goals || []} />
      )}

      </>)}

      </div>{/* end tab content */}

      {showAddAsset && (
        <AddAssetSheet
          onClose={() => setShowAddAsset(false)}
          onSave={saveNewAsset}
        />
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
          liveQuotes={liveQuotes}
        />
      )}

      {cashFlowSheet && (
        <CashFlowSheet
          financials={analysis}
          aiAnalysis={cashFlowSheet.analysis}
          loading={cashFlowSheet.loading}
          onClose={() => setCashFlowSheet(null)}
          profile={profile}
        />
      )}

      {focusPlan && analysis?.nextActions?.[0] && (
        <FocusPlanSheet
          action={analysis.nextActions[0]}
          analysis={focusPlan.analysis}
          loading={focusPlan.loading}
          profile={profile}
          onClose={() => setFocusPlan(null)}
        />
      )}

      {milestone && (
        <MilestoneOverlay amount={milestone} onClose={() => setMilestone(null)} />
      )}
    </div>
  )
}
