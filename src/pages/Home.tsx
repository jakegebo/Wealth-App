import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { useProfile } from '../contexts/ProfileContext'
import NetWorthChart from '../components/NetWorthChart'

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
  const income = profile?.monthly_income || 1
  const debtRatio = totalDebtPmt / income
  const hasDebts = (profile?.debts?.length || 0) > 0
  const debtScore = !hasDebts ? 25 : debtRatio < 0.10 ? 22 : debtRatio < 0.20 ? 15 : debtRatio < 0.30 ? 8 : 2

  const liquid = profile?.assets?.filter((a: any) => a.category === 'savings').reduce((s: number, a: any) => s + (a.value || 0), 0) || 0
  const monthlyExp = profile?.monthly_expenses || 1
  const emoMonths = liquid / monthlyExp
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
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

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
  const monthlyExp = profile?.monthly_expenses || 1
  const emoMonths = liquid / monthlyExp
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
        chatSeed: `My closest goal "${closest.name}" is ${Math.round(closest.percentage || 0)}% funded with ${remaining} left to go. The monthly needed is ${fmt(closest.monthlyNeeded)}. Help me figure out the most efficient way to fully fund this goal.`
      })
    }
  }

  return insights.slice(0, 3)
}

function CountUp({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef<number | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!value) return
    startRef.current = null
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      const progress = Math.min((timestamp - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value])

  return <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(display)}</span>
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

function HealthScoreCard({ analysis, profile }: { analysis: Analysis; profile: any }) {
  const [expanded, setExpanded] = useState(false)
  const { score, label, color, breakdown } = computeHealthScore(analysis, profile)

  return (
    <div className="card animate-fade" style={{ marginBottom: '12px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="label" style={{ marginBottom: '4px' }}>Financial Health</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '44px', fontWeight: '300', color, letterSpacing: '-2px', lineHeight: '1' }}>{score}</span>
            <span style={{ fontSize: '13px', color: 'var(--sand-500)' }}>/ 100</span>
          </div>
          <span style={{ fontSize: '13px', fontWeight: '600', color }}>{label}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          {/* Score ring using SVG */}
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--sand-200)" strokeWidth="5" />
            <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="5"
              strokeDasharray={`${(score / 100) * 163.4} 163.4`}
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '-4px 0 0', textAlign: 'center' }}>{expanded ? 'collapse ▲' : 'details ▼'}</p>
        </div>
      </div>

      {expanded && (
        <div className="animate-fade" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '0.5px solid var(--sand-200)' }}>
          {breakdown.map((item, i) => (
            <div key={i} style={{ marginBottom: i < breakdown.length - 1 ? '12px' : '0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--sand-700)', fontWeight: '500' }}>{item.label}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>{item.note}</span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: item.score / item.max >= 0.8 ? 'var(--success)' : item.score / item.max >= 0.5 ? 'var(--accent)' : 'var(--warning)' }}>
                    {item.score}/{item.max}
                  </span>
                </div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${(item.score / item.max) * 100}%`,
                  background: item.score / item.max >= 0.8 ? 'var(--success)' : item.score / item.max >= 0.5 ? 'var(--accent)' : 'var(--warning)'
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', padding: '0' }} onClick={onClose}>
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
              <div key={i} style={{ background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 'var(--radius-md)', overflow: 'hidden', transition: 'all 0.2s' }}>
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
                  <span style={{ fontSize: '12px', color: 'var(--sand-400)', flexShrink: 0, marginTop: '2px', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
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

function MilestoneOverlay({ amount, onClose }: { amount: number; onClose: () => void }) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div className="animate-scale" style={{ background: 'var(--sand-50)', borderRadius: 'var(--radius-lg)', padding: '32px 28px', textAlign: 'center', maxWidth: '320px', width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
        <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Milestone reached</p>
        <p style={{ fontSize: '32px', fontWeight: '300', color: 'var(--sand-900)', letterSpacing: '-1px', margin: '0 0 8px' }}>{fmt(amount)}</p>
        <p style={{ fontSize: '14px', color: 'var(--sand-600)', margin: '0 0 20px', lineHeight: '1.5' }}>Your net worth just crossed {fmt(amount)}. That's a real achievement — keep going.</p>
        <button onClick={onClose} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '14px' }}>Keep building →</button>
      </div>
    </div>
  )
}

const RECAP_PERIODS = ['1D', '1W', '1M'] as const
type RecapPeriod = typeof RECAP_PERIODS[number] | 'custom'

function MarketRecap() {
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

  const formatText = (text: string) =>
    text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: '5px' }} />
      if (line.trim().startsWith('**') && line.trim().endsWith('**'))
        return <p key={i} style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', margin: '12px 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em', borderLeft: '3px solid var(--accent)', paddingLeft: '8px' }}>{line.trim().slice(2, -2)}</p>
      if (line.startsWith('- '))
        return <div key={i} style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent)', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>·</span>
          <span style={{ fontSize: '13px', lineHeight: '1.55', color: 'var(--sand-800)' }}>{line.slice(2)}</span>
        </div>
      return <p key={i} style={{ fontSize: '13px', lineHeight: '1.6', margin: '2px 0', color: 'var(--sand-800)' }}>{line}</p>
    })

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
      const [newsRes, ...histResponses] = await Promise.all([
        fetch(`/api/news?category=markets&from=${fromStr}&to=${toStr}`),
        ...KEY_SYMBOLS.map(sym => fetch(`/api/stocks?symbol=${sym}&period=${apiPeriod}`)),
      ])
      const newsData = await newsRes.json()
      const histData = await Promise.all(histResponses.map(r => r.json()))

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

      const ctx = { snapshot: periodSnapshot, news: newsArticles, period: p, fromDate: fromStr, toDate: toStr }
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

function getSuggestedQuestions(type: 'assets' | 'debts' | 'savings', profile: any): string[] {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
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

function MiniDashboardSheet({ type, analysis, loading, onClose, profile, netWorth, totalAssets, totalLiabilities, availableToSave }: {
  type: 'assets' | 'debts' | 'savings'
  analysis: string
  loading: boolean
  onClose: () => void
  profile: any
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  availableToSave: number
}) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  const titles = { assets: 'Asset Breakdown', debts: 'Debt Overview', savings: 'Savings Power' }
  const colors = { assets: 'var(--sand-900)', debts: 'var(--danger)', savings: 'var(--success)' }

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

  const formatText = (text: string) => stripMeta(text).split('\n').map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ fontWeight: '700', color: 'var(--sand-900)', margin: '10px 0 4px', fontSize: '14px' }}>{line.slice(2, -2)}</p>
    if (line.startsWith('- ')) return <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}><span style={{ color: 'var(--accent)', fontWeight: '700' }}>·</span><span style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--sand-800)' }}>{line.slice(2)}</span></div>
    if (line === '') return <div key={i} style={{ height: '6px' }} />
    return <p key={i} style={{ fontSize: '14px', lineHeight: '1.6', margin: '2px 0', color: 'var(--sand-800)' }}>{line}</p>
  })

  const categoryColors: Record<string, string> = {
    retirement: 'var(--accent)', investment: 'var(--success)', savings: '#5a8fc4',
    real_estate: '#c4955a', crypto: '#9b5ac4', other: 'var(--sand-400)',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
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
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-900)' }}>{fmt(val)} · {((val / totalAssets) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${(val / totalAssets) * 100}%`, background: categoryColors[cat] || 'var(--sand-400)' }} />
                    </div>
                  </div>
                ))
              })()}
              <div style={{ marginTop: '16px', borderTop: '0.5px solid var(--sand-200)', paddingTop: '12px' }}>
                {profile?.assets?.map((asset: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--sand-200)' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 2px', color: 'var(--sand-900)' }}>{asset.name}</p>
                      {asset.holdings && <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{asset.holdings}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>{fmt(asset.value)}</p>
                      <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{((asset.value / totalAssets) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
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
          <div style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '24px', height: '24px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '8px', fontWeight: '700' }}>AI</span>
              </div>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-700)', margin: 0 }}>AI Analysis</p>
            </div>
            {loading ? (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', padding: '4px 0' }}>
                {[0, 150, 300].map(d => <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
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

  const formatText = (text: string) => stripMeta(text).split('\n').map((line, i) => {
    if (/^\*\*(.+)\*\*$/.test(line)) return <p key={i} style={{ fontWeight: '700', color: 'var(--sand-900)', margin: '12px 0 4px', fontSize: '14px' }}>{line.replace(/\*\*/g, '')}</p>
    if (line.match(/^\d+\.\s/)) return <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '5px', alignItems: 'flex-start' }}><span style={{ color: 'var(--accent)', fontWeight: '700', fontSize: '13px', flexShrink: 0 }}>{line.match(/^(\d+\.)/)?.[1]}</span><span style={{ fontSize: '13px', lineHeight: '1.55', color: 'var(--sand-800)' }}>{line.replace(/^\d+\.\s/, '')}</span></div>
    if (line.startsWith('- ')) return <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'flex-start' }}><span style={{ color: 'var(--accent)', fontWeight: '700', flexShrink: 0 }}>·</span><span style={{ fontSize: '13px', lineHeight: '1.55', color: 'var(--sand-800)' }}>{line.slice(2)}</span></div>
    if (line === '') return <div key={i} style={{ height: '6px' }} />
    return <p key={i} style={{ fontSize: '13px', lineHeight: '1.6', margin: '2px 0', color: 'var(--sand-800)' }}>{line}</p>
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
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
  const { userId, userEmail, profileData: profile, analysis, chatRefs, hasProfile, loading: profileLoading, updateProfile } = useProfile()
  const firstName = userEmail.split('@')[0] || 'there'
  const [analyzing, setAnalyzing] = useState(false)
  const [insightsRefreshing, setInsightsRefreshing] = useState(false)
  const [miniDash, setMiniDash] = useState<MiniDashboard | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [analysisError, setAnalysisError] = useState(false)
  const [milestone, setMilestone] = useState<number | null>(null)
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null)
  const [editingGoalIdx, setEditingGoalIdx] = useState<number | null>(null)
  const [goalInputVal, setGoalInputVal] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)
  const [focusPlan, setFocusPlan] = useState<{ analysis: string; loading: boolean } | null>(null)
  const prevFingerprintRef = useRef<string>('')
  const analysisInProgressRef = useRef(false)

  useEffect(() => {
    if (profileLoading) return
    if (!hasProfile) { navigate('/onboarding'); return }
    if (analysis) {
      saveNetWorthHistory(userId!, analysis, profile)
      checkMilestone(analysis.netWorth)
    } else if (profile) {
      runAnalysis(profile)
    }
    // Seed fingerprint on load so we only react to future changes
    if (profile) prevFingerprintRef.current = financialFingerprint(profile)
    // Load last analyzed timestamp
    const stored = localStorage.getItem(`lastAnalyzed_${userId}`)
    if (stored) setLastAnalyzedAt(stored)
  }, [profileLoading])

  // Auto-refresh insights when financial data changes
  useEffect(() => {
    if (!profile || !analysis || analysisInProgressRef.current) return
    const fp = financialFingerprint(profile)
    if (prevFingerprintRef.current && fp !== prevFingerprintRef.current) {
      prevFingerprintRef.current = fp
      runAnalysis(profile, true)
    } else if (!prevFingerprintRef.current) {
      prevFingerprintRef.current = fp
    }
  }, [profile])

  const checkMilestone = (netWorth: number) => {
    const key = getMilestoneKey(netWorth)
    if (!key || !userId) return
    const storageKey = `${userId}_${key}`
    if (!localStorage.getItem(storageKey)) {
      const threshold = MILESTONES.filter(m => netWorth >= m).pop()!
      setMilestone(threshold)
      localStorage.setItem(storageKey, '1')
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
      await updateProfile({ analysis: result })
      if (userId) {
        saveNetWorthHistory(userId, result, profileData)
        checkMilestone(result.netWorth)
        const now = new Date().toISOString()
        localStorage.setItem(`lastAnalyzed_${userId}`, now)
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
    const availableToSave = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)
    const totalAssets = analysis?.totalAssets ?? profile?.assets?.reduce((s: number, a: any) => s + (a.value || 0), 0) ?? 0
    const prompts = {
      assets: `Analyze my asset allocation and give specific advice. Assets: ${JSON.stringify(profile?.assets || [])}. Total: $${totalAssets.toLocaleString()}. What's my diversification score and the top 2-3 things I should do to optimize it?`,
      debts: `Analyze my debts and build me an optimal payoff strategy. Debts: ${JSON.stringify(profile?.debts || [])}. Monthly income: $${profile?.monthly_income || 0}. Give me priority order and exact monthly amounts.`,
      savings: `I have $${availableToSave.toLocaleString()}/month to allocate. Income: $${profile?.monthly_income || 0}, Expenses: $${profile?.monthly_expenses || 0}. Assets: ${JSON.stringify(profile?.assets || [])}. Give me an exact dollar allocation across investing, emergency fund, and any debt.`
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

  const openFocusPlan = async (action: { title: string; description: string; impact: string; timeframe: string }) => {
    setFocusPlan({ analysis: '', loading: true })
    const goals = profile?.goals?.map((g: any) => `${g.name}: $${(g.current_amount || 0).toLocaleString()} / $${(g.target_amount || 0).toLocaleString()} (${g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0}%)`).join(', ') || 'none set'
    const debts = profile?.debts?.sort((a: any, b: any) => b.interest_rate - a.interest_rate).map((d: any) => `${d.name}: $${(d.balance || 0).toLocaleString()} @ ${d.interest_rate}%`).join(', ') || 'none'
    const avail = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)
    const prompt = `My #1 financial priority this week is: "${action.title}". ${action.description}

Here is my full financial context:
- Monthly surplus available: $${avail.toLocaleString()}
- Goals: ${goals}
- Debts (highest rate first): ${debts}
- This action has ${action.impact} impact and a ${action.timeframe} timeframe

Please give me:
1. WHY this is my best move right now — explain using my actual numbers, not generic advice
2. A concrete step-by-step execution plan for THIS WEEK — first action, second action, etc. with exact amounts and where to do it
3. How completing this specifically advances my goals
4. What progress will look like at 30, 60, and 90 days with real numbers`

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

  const isVisible = (id: string) => !preferences.hiddenSections.includes(id)
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

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

  const topAction = analysis.nextActions?.[0]

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 16px 100px' }}>

      {/* Header */}
      <div style={{ padding: '52px 0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 2px' }}>{greeting()}, {firstName}</p>
          <h1 style={{ fontSize: '20px', fontWeight: '500', color: 'var(--sand-900)', margin: 0, letterSpacing: '-0.3px' }}>Here's your overview</h1>
          {lastAnalyzedAt && (
            <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '2px 0 0' }}>Updated {timeAgo(lastAnalyzedAt)}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
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
              style={{ background: item.bg, border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 8px', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' }}>
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
          <button
            onClick={() => openFocusPlan(topAction)}
            style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-sm)', padding: '9px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'center' }}>
            Attack this →
          </button>
        </div>
      )}

      {/* Key Insights */}
      {isVisible('insights') && (
        <InsightsStrip analysis={analysis} profile={profile} refreshing={insightsRefreshing} />
      )}

      {/* Quick Stats */}
      {isVisible('stats') && (
        <div className="animate-fade stagger-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div className="card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => navigate('/plan')}>
            <p className="label" style={{ marginBottom: '4px' }}>Retire at</p>
            <p style={{ fontSize: '34px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 2px', letterSpacing: '-1px' }}>
              {profile?.retirement_plan?.targetAge || '—'}
            </p>
            <p style={{ fontSize: '11px', color: profile?.retirement_plan?.onTrack ? 'var(--success)' : 'var(--sand-500)', margin: 0 }}>
              {profile?.retirement_plan ? (profile.retirement_plan.onTrack ? 'on track ✓' : 'needs attention') : 'set up plan →'}
            </p>
          </div>
          <div className="card" style={{ padding: '16px' }}>
            <p className="label" style={{ marginBottom: '4px' }}>Savings rate</p>
            <p style={{ fontSize: '34px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 2px', letterSpacing: '-1px' }}>{Math.round(analysis.savingsRate)}%</p>
            <p style={{ fontSize: '11px', color: analysis.savingsRate >= 20 ? 'var(--success)' : 'var(--sand-500)', margin: 0 }}>
              {analysis.savingsRate >= 20 ? 'excellent ✓' : `${fmt(analysis.availableToSave)}/mo`}
            </p>
          </div>
        </div>
      )}

      {/* Cash Flow */}
      {isVisible('cashflow') && analysis.monthlyIncome > 0 && (
        <div className="animate-fade stagger-4" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p className="label">Monthly Cash Flow</p>
            <button className="btn-ghost" onClick={() => navigate('/plan')} style={{ fontSize: '11px', padding: '3px 8px' }}>Details →</button>
          </div>
          <div className="card" style={{ padding: '18px' }}>
            {[
              { label: 'Income', value: analysis.monthlyIncome, color: 'var(--success)', pct: 100 },
              { label: 'Expenses', value: analysis.monthlyExpenses, color: 'var(--danger)', pct: (analysis.monthlyExpenses / analysis.monthlyIncome) * 100 },
              { label: 'Saves', value: analysis.availableToSave, color: 'var(--accent)', pct: Math.max(0, (analysis.availableToSave / analysis.monthlyIncome) * 100) },
            ].map((row, i) => (
              <div key={row.label} style={{ marginBottom: i < 2 ? '14px' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--sand-500)' }}>{row.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-900)' }}>{fmt(row.value)}</span>
                </div>
                <div style={{ height: '4px', background: 'var(--sand-200)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, row.pct)}%`, background: row.color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market Recap */}
      <MarketRecap />

      {/* Goals */}
      {isVisible('goals') && (profile?.goals?.length || 0) > 0 && (
        <div className="animate-fade stagger-4" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p className="label">Goals</p>
            <button className="btn-ghost" onClick={() => navigate('/onboarding?step=3&from=settings')} style={{ fontSize: '11px', padding: '3px 8px' }}>Edit →</button>
          </div>
          <div className="card" style={{ padding: '4px 0' }}>
            {profile.goals.map((goal: any, i: number) => {
              const pct = Math.min(100, goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0)
              const isEditing = editingGoalIdx === i
              return (
                <div key={i} style={{ padding: '14px 18px', borderBottom: i < profile.goals.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 1px' }}>{goal.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{goal.timeline}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: pct >= 100 ? 'var(--success)' : 'var(--sand-900)', margin: '0 0 1px' }}>{pct}%</p>
                      <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: 0 }}>
                        {fmt(goal.current_amount)} / {fmt(goal.target_amount)}
                      </p>
                    </div>
                  </div>
                  <div style={{ height: '4px', background: 'var(--sand-200)', borderRadius: '2px', marginBottom: '10px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : 'var(--accent)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                  </div>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--sand-600)' }}>$</span>
                        <input
                          autoFocus
                          type="number"
                          value={goalInputVal}
                          onChange={e => setGoalInputVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveGoalProgress(i); if (e.key === 'Escape') setEditingGoalIdx(null) }}
                          placeholder={goal.current_amount.toString()}
                          style={{ width: '100%', paddingLeft: '22px', paddingRight: '8px', paddingTop: '7px', paddingBottom: '7px', fontSize: '13px', background: 'var(--sand-200)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', color: 'var(--sand-900)', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <button onClick={() => saveGoalProgress(i)} disabled={savingGoal} className="btn-primary" style={{ padding: '7px 14px', fontSize: '12px', flexShrink: 0 }}>
                        {savingGoal ? '...' : 'Save'}
                      </button>
                      <button onClick={() => setEditingGoalIdx(null)} className="btn-ghost" style={{ padding: '7px 10px', fontSize: '12px', flexShrink: 0 }}>
                        Cancel
                      </button>
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
