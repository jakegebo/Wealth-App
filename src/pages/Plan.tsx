import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { useProfile } from '../contexts/ProfileContext'

interface Goal {
  name: string
  targetAmount: number
  currentAmount: number
  percentage: number
  monthlyNeeded: number
  feasibility: string
}

interface Debt {
  name: string
  balance: number
  interestRate: number
  recommendedPayment: number
  monthsToPayoff: number
  strategy: string
}

interface Analysis {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  monthlyIncome: number
  availableToSave: number
  nextActions: { priority: number; title: string; description: string; impact: string; timeframe: string }[]
  goals: Goal[]
  debts: Debt[]
}

function ProgressBar({ value, color = 'var(--accent)' }: { value: number; color?: string }) {
  return (
    <div className="progress-bar" style={{ marginTop: '8px' }}>
      <div className="progress-fill" style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </div>
  )
}

function UpdateModal({ goal, onClose, onSave }: {
  goal: Goal
  onClose: () => void
  onSave: (newAmount: number) => void
}) {
  const [value, setValue] = useState(goal.currentAmount.toString())
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div className="animate-scale" style={{ background: 'var(--sand-50)', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: '36px', height: '4px', background: 'var(--sand-300)', borderRadius: '2px', margin: '0 auto 20px' }} />
        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px', color: 'var(--sand-900)' }}>Update progress</h3>
        <p style={{ fontSize: '13px', color: 'var(--sand-600)', margin: '0 0 20px' }}>{goal.name} · target {fmt(goal.targetAmount)}</p>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--sand-500)', marginBottom: '6px', fontWeight: '500' }}>Current amount saved</label>
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{ marginBottom: '16px', fontSize: '20px', fontWeight: '500' }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-ghost" onClick={onClose} style={{ flex: 1, padding: '12px', textAlign: 'center' }}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(parseFloat(value) || 0)} style={{ flex: 2, padding: '12px', fontSize: '14px' }}>Save progress</button>
        </div>
      </div>
    </div>
  )
}

function simulatePayoff(
  debts: { balance: number; interestRate: number; recommendedPayment: number }[],
  extraPerMonth: number,
  strategy: 'minimum' | 'avalanche' | 'snowball'
): { months: number; totalInterest: number } {
  if (!debts.length) return { months: 0, totalInterest: 0 }

  const state = debts.map(d => ({
    remaining: d.balance,
    monthlyRate: d.interestRate / 100 / 12,
    minPayment: Math.max(d.recommendedPayment || 25, 10),
    interestRate: d.interestRate,
  }))

  // Fixed total monthly budget = all minimums + extra (stays constant as debts are paid off,
  // so freed-up minimums automatically roll into the priority debt — this is the core mechanic)
  const totalMinimums = state.reduce((s, d) => s + d.minPayment, 0)
  const isMinimumOnly = strategy === 'minimum'

  let totalInterest = 0
  let months = 0

  while (state.some(d => d.remaining > 0.01) && months < 600) {
    months++

    // Step 1: Accrue interest on all active debts
    for (const d of state) {
      if (d.remaining <= 0) continue
      const interest = d.remaining * d.monthlyRate
      totalInterest += interest
      d.remaining += interest
    }

    // Step 2: Pay minimums on every debt; track how much budget is left
    let budgetLeft = totalMinimums + (isMinimumOnly ? 0 : extraPerMonth)
    for (const d of state) {
      if (d.remaining <= 0) continue
      const pmt = Math.min(d.remaining, d.minPayment)
      d.remaining -= pmt
      budgetLeft -= pmt
      if (d.remaining < 0.01) d.remaining = 0
    }

    // Step 3: Apply remaining budget (freed minimums + extra) to priority debt.
    // This is what makes avalanche ≠ snowball — where the surplus goes each month.
    if (budgetLeft > 0.01 && !isMinimumOnly) {
      const active = state
        .map((d, i) => ({ ...d, idx: i }))
        .filter(d => d.remaining > 0.01)

      if (strategy === 'avalanche') active.sort((a, b) => b.interestRate - a.interestRate)
      else if (strategy === 'snowball') active.sort((a, b) => a.remaining - b.remaining)

      for (const item of active) {
        if (budgetLeft <= 0.01) break
        const d = state[item.idx]
        const pay = Math.min(d.remaining, budgetLeft)
        d.remaining -= pay
        budgetLeft -= pay
        if (d.remaining < 0.01) d.remaining = 0
      }
    }
  }

  return { months, totalInterest: Math.round(totalInterest) }
}

function CashFlowCard({ income, expenses, availableToSave, savingsRate }: {
  income: number
  expenses: number
  availableToSave: number
  savingsRate: number
}) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  const expPct = income > 0 ? Math.min(100, (expenses / income) * 100) : 0
  const savePct = income > 0 ? Math.min(100, (Math.max(0, availableToSave) / income) * 100) : 0

  return (
    <div className="card animate-fade" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p className="label">Monthly Cash Flow</p>
        <span style={{
          fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '20px',
          background: savingsRate >= 20 ? 'rgba(122,158,110,0.1)' : savingsRate >= 10 ? 'var(--accent-light)' : 'rgba(192,57,43,0.07)',
          color: savingsRate >= 20 ? 'var(--success)' : savingsRate >= 10 ? 'var(--accent)' : 'var(--danger)'
        }}>
          {Math.round(savingsRate)}% savings rate
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Income bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', color: 'var(--sand-700)', fontWeight: '500' }}>Income</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-900)' }}>{fmt(income)}</span>
          </div>
          <div style={{ height: '8px', background: 'var(--sand-200)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '100%', background: 'var(--success)', borderRadius: '4px' }} />
          </div>
        </div>

        {/* Expenses bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', color: 'var(--sand-700)', fontWeight: '500' }}>Expenses</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--danger)' }}>{fmt(expenses)}</span>
          </div>
          <div style={{ height: '8px', background: 'var(--sand-200)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${expPct}%`, background: 'var(--danger)', borderRadius: '4px', transition: 'width 0.8s ease' }} />
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '0.5px', background: 'var(--sand-300)', margin: '2px 0' }} />

        {/* Available to save */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', color: 'var(--sand-700)', fontWeight: '500' }}>Available to invest</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: availableToSave >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(availableToSave)}</span>
          </div>
          <div style={{ height: '8px', background: 'var(--sand-200)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${savePct}%`, background: availableToSave >= 0 ? 'var(--accent)' : 'var(--danger)', borderRadius: '4px', transition: 'width 0.8s ease' }} />
          </div>
        </div>
      </div>

      {/* Context note */}
      <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '12px 0 0', lineHeight: '1.4' }}>
        {savingsRate >= 20
          ? `At ${Math.round(savingsRate)}% you're in wealth-building territory. Keep it consistent.`
          : savingsRate >= 10
          ? `At ${Math.round(savingsRate)}% you're on the right track. The 20% target is ${fmt(income * 0.2 - availableToSave)} away.`
          : `Increasing savings by ${fmt(income * 0.05)}/mo would bring your rate to ${Math.round(savingsRate + 5)}%.`}
      </p>
    </div>
  )
}

function DebtOptimizerCard({ debts, analysis }: { debts: Debt[]; analysis: Analysis }) {
  const [strategy, setStrategy] = useState<'minimum' | 'avalanche' | 'snowball'>('avalanche')
  const [extraPayment, setExtraPayment] = useState(0)
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  if (!debts.length) return null

  const avalancheResult = simulatePayoff(debts, extraPayment, 'avalanche')
  const snowballResult = simulatePayoff(debts, extraPayment, 'snowball')
  const minResult = simulatePayoff(debts, 0, 'minimum')
  const currentResult = strategy === 'avalanche' ? avalancheResult : strategy === 'snowball' ? snowballResult : minResult
  const interestSaved = minResult.totalInterest - currentResult.totalInterest
  const monthsSaved = minResult.months - currentResult.months

  const debtsByAvalanche = [...debts].sort((a, b) => b.interestRate - a.interestRate)
  const debtsBySnowball = [...debts].sort((a, b) => a.balance - b.balance)
  const priorityList = strategy === 'avalanche' ? debtsByAvalanche : strategy === 'snowball' ? debtsBySnowball : debts

  const formatMonths = (m: number) => {
    if (m >= 600) return '50+ yrs'
    const yrs = Math.floor(m / 12)
    const mos = m % 12
    if (yrs === 0) return `${mos}mo`
    if (mos === 0) return `${yrs}yr`
    return `${yrs}yr ${mos}mo`
  }

  const STRATEGY_INFO = {
    avalanche: {
      title: 'Debt Avalanche',
      tagline: 'Mathematically optimal',
      description: 'Attack the highest interest rate debt first. Every extra dollar saves the maximum possible in interest charges. When that debt is cleared, roll its payment into the next highest rate. Best if you want to pay the least amount overall.',
      color: 'var(--accent)',
      bg: 'rgba(122,158,110,0.06)',
      border: 'rgba(122,158,110,0.2)',
    },
    snowball: {
      title: 'Debt Snowball',
      tagline: 'Psychologically powerful',
      description: 'Attack the smallest balance first, regardless of rate. You eliminate individual debts faster, which builds momentum and motivation. When cleared, roll that payment into the next smallest. Best if you need wins to stay on track.',
      color: '#6a8aae',
      bg: 'rgba(106,138,174,0.06)',
      border: 'rgba(106,138,174,0.2)',
    },
    minimum: {
      title: 'Minimum Payments',
      tagline: 'Costs the most',
      description: 'Pay only the required minimum on each debt every month. No extra is directed anywhere. This stretches repayment to its longest possible timeline and maximizes the total interest you pay to lenders.',
      color: 'var(--danger)',
      bg: 'rgba(192,57,43,0.05)',
      border: 'rgba(192,57,43,0.15)',
    },
  }

  const info = STRATEGY_INFO[strategy]

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <p className="label" style={{ marginBottom: '12px' }}>Debt Payoff Optimizer</p>

      {/* Strategy toggle */}
      <div style={{ display: 'flex', background: 'var(--sand-200)', borderRadius: '10px', padding: '3px', marginBottom: '14px' }}>
        {([
          { key: 'avalanche', label: 'Avalanche' },
          { key: 'snowball', label: 'Snowball' },
          { key: 'minimum', label: 'Minimums' },
        ] as const).map(opt => (
          <button key={opt.key} onClick={() => setStrategy(opt.key)}
            style={{ flex: 1, padding: '7px 4px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: strategy === opt.key ? 'var(--sand-50)' : 'transparent', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: strategy === opt.key ? 'var(--sand-900)' : 'var(--sand-500)', margin: 0 }}>{opt.label}</p>
          </button>
        ))}
      </div>

      {/* Strategy explanation card */}
      <div style={{ padding: '14px', background: info.bg, border: `0.5px solid ${info.border}`, borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <p style={{ fontSize: '13px', fontWeight: '700', color: info.color, margin: 0 }}>{info.title}</p>
          <span style={{ fontSize: '10px', fontWeight: '600', color: info.color, background: `${info.border}`, padding: '2px 7px', borderRadius: '20px', opacity: 0.9 }}>{info.tagline}</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--sand-600)', margin: 0, lineHeight: '1.55' }}>{info.description}</p>
      </div>

      {/* 3-way comparison */}
      {debts.length > 1 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Strategy comparison</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            {([
              { key: 'avalanche', label: 'Avalanche', result: avalancheResult, color: 'var(--accent)' },
              { key: 'snowball', label: 'Snowball', result: snowballResult, color: '#6a8aae' },
              { key: 'minimum', label: 'Minimum', result: minResult, color: 'var(--sand-500)' },
            ] as const).map(opt => (
              <button key={opt.key} onClick={() => setStrategy(opt.key)} style={{
                background: strategy === opt.key ? 'var(--sand-50)' : 'transparent',
                border: strategy === opt.key ? `1.5px solid ${opt.color}` : '0.5px solid var(--sand-300)',
                borderRadius: '10px', padding: '10px 8px', cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'center', transition: 'all 0.15s'
              }}>
                <p style={{ fontSize: '10px', fontWeight: '700', color: strategy === opt.key ? opt.color : 'var(--sand-500)', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{opt.label}</p>
                <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 2px' }}>{formatMonths(opt.result.months)}</p>
                <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: 0 }}>{fmt(opt.result.totalInterest)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Extra payment slider */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--sand-600)', fontWeight: '500' }}>Extra payment per month</label>
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent)' }}>{fmt(extraPayment)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.min(2000, Math.round(analysis.availableToSave || 500))}
          step={25}
          value={extraPayment}
          onChange={e => setExtraPayment(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <span style={{ fontSize: '10px', color: 'var(--sand-400)' }}>$0</span>
          <span style={{ fontSize: '10px', color: 'var(--sand-400)' }}>{fmt(Math.min(2000, analysis.availableToSave || 500))}</span>
        </div>
      </div>

      {/* Current strategy results */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div className="card-muted" style={{ padding: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '0 0 3px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payoff in</p>
          <p style={{ fontSize: '22px', fontWeight: '300', color: 'var(--sand-900)', margin: 0, letterSpacing: '-0.5px' }}>{formatMonths(currentResult.months)}</p>
          {monthsSaved > 0 && <p style={{ fontSize: '10px', color: 'var(--success)', margin: '2px 0 0' }}>↓ {formatMonths(monthsSaved)} faster than minimums</p>}
        </div>
        <div className="card-muted" style={{ padding: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '0 0 3px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total interest</p>
          <p style={{ fontSize: '22px', fontWeight: '300', color: 'var(--danger)', margin: 0, letterSpacing: '-0.5px' }}>{fmt(currentResult.totalInterest)}</p>
          {interestSaved > 0 && <p style={{ fontSize: '10px', color: 'var(--success)', margin: '2px 0 0' }}>↓ {fmt(interestSaved)} vs. minimums</p>}
        </div>
      </div>

      {/* Priority order */}
      {strategy !== 'minimum' && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-500)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
            {strategy === 'avalanche' ? 'Payoff order — highest rate first' : 'Payoff order — smallest balance first'}
          </p>
          {priorityList.map((debt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < priorityList.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)' }}>{i + 1}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: '500', margin: 0, color: 'var(--sand-900)' }}>{debt.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{fmt(debt.balance)} · {debt.interestRate}% APR</p>
              </div>
              {i === 0 && <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--accent)', background: 'var(--accent-light)', padding: '2px 7px', borderRadius: '20px', flexShrink: 0 }}>Focus here</span>}
            </div>
          ))}
        </div>
      )}

      {strategy === 'minimum' && (
        <div style={{ padding: '12px', background: 'rgba(192,57,43,0.05)', borderRadius: 'var(--radius-sm)', border: '0.5px solid rgba(192,57,43,0.1)' }}>
          <p style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: '600', margin: '0 0 4px' }}>
            Cost of minimum payments only
          </p>
          <p style={{ fontSize: '12px', color: 'var(--sand-600)', margin: 0, lineHeight: '1.5' }}>
            You'll pay {fmt(minResult.totalInterest)} in interest over {formatMonths(minResult.months)}.
            Switching to Avalanche saves {fmt(minResult.totalInterest - avalancheResult.totalInterest)} and finishes {formatMonths(minResult.months - avalancheResult.months)} sooner.
          </p>
        </div>
      )}
    </div>
  )
}

export default function Plan() {
  const navigate = useNavigate()
  const { preferences } = useTheme()
  const { userId, profileData: profile, analysis, chatRefs, goalAdvice, loading, updateProfile } = useProfile()
  const [updatingGoal, setUpdatingGoal] = useState<Goal | null>(null)
  const [expandedDebt, setExpandedDebt] = useState<number | null>(null)
  const [expandedAction, setExpandedAction] = useState<number | null>(null)
  const [loadingAdvice, setLoadingAdvice] = useState<string | null>(null)
  const [minimizedAdvice, setMinimizedAdvice] = useState<Record<string, boolean>>({})

  const stripAdviceMeta = (text: string) =>
    text.replace(/<followups>[\s\S]*?<\/followups>/g, '').replace(/<chart>[\s\S]*?<\/chart>/g, '').trim()

  const formatAdvice = (text: string) => {
    const clean = stripAdviceMeta(text)
    return clean.split('\n').map((line, i) => {
      if (!line.trim()) return null
      if (line.startsWith('**') && line.endsWith('**'))
        return <p key={i} style={{ fontWeight: '700', color: 'var(--sand-800)', margin: '6px 0 2px', fontSize: '12px' }}>{line.slice(2, -2)}</p>
      if (line.startsWith('- '))
        return <div key={i} style={{ display: 'flex', gap: '6px', marginTop: '3px' }}><span style={{ color: 'var(--accent)', fontWeight: '700', flexShrink: 0 }}>·</span><span style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--sand-700)' }}>{line.slice(2)}</span></div>
      if (/^\d+\./.test(line))
        return <div key={i} style={{ display: 'flex', gap: '6px', marginTop: '3px' }}><span style={{ color: 'var(--accent)', fontWeight: '700', fontSize: '11px', flexShrink: 0 }}>{line.match(/^\d+/)![0]}.</span><span style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--sand-700)' }}>{line.replace(/^\d+\.\s*/, '')}</span></div>
      return <p key={i} style={{ fontSize: '12px', color: 'var(--sand-700)', margin: '3px 0', lineHeight: '1.55' }}>{line}</p>
    }).filter(Boolean)
  }

  const fetchGoalAdvice = async (goal: Goal, force = false) => {
    if (!force && goalAdvice[goal.name]) return
    if (loadingAdvice === goal.name) return
    setLoadingAdvice(goal.name)

    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    const pct = Math.round(goal.percentage)
    const remaining = goal.targetAmount - goal.currentAmount
    const monthsLeft = goal.monthlyNeeded > 0 ? Math.ceil(remaining / goal.monthlyNeeded) : null
    const availableToSave = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)

    // Craft prompt that adapts to where they are in the goal
    let progressContext: string
    if (pct >= 100) {
      progressContext = `I've fully achieved this goal — I have ${fmt(goal.currentAmount)} against a ${fmt(goal.targetAmount)} target, a surplus of ${fmt(goal.currentAmount - goal.targetAmount)}. What should I do with this money now?`
    } else if (pct >= 75) {
      progressContext = `I'm ${pct}% of the way there — ${fmt(remaining)} left to reach ${fmt(goal.targetAmount)}. At ${fmt(goal.monthlyNeeded)}/mo I'm ${monthsLeft ? `~${monthsLeft} months away` : 'close'}. How do I make the final push and what should I do once I hit it?`
    } else if (pct >= 40) {
      progressContext = `I'm ${pct}% funded (${fmt(goal.currentAmount)} of ${fmt(goal.targetAmount)}). I need ${fmt(goal.monthlyNeeded)}/mo and have ${fmt(availableToSave)}/mo available. Am I on track? What's the best way to accelerate?`
    } else if (pct >= 10) {
      progressContext = `I've started but I'm only ${pct}% funded — ${fmt(goal.currentAmount)} of ${fmt(goal.targetAmount)}. I need ${fmt(goal.monthlyNeeded)}/mo. What's the best account or vehicle to hold this money, and how do I build momentum?`
    } else {
      progressContext = `I'm just getting started on this goal (${pct}% funded, ${fmt(goal.currentAmount)} saved). My target is ${fmt(goal.targetAmount)}. I have ${fmt(availableToSave)}/mo surplus. What's the single best first step and where should I keep this money?`
    }

    const prompt = `Goal: "${goal.name}" — ${progressContext}

Give me a sharp, specific 3-4 sentence analysis. Use my actual numbers. No fluff. End with one concrete action I can take today.`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          profile: profile || {},
          topic: 'goals'
        })
      })
      const data = await res.json()
      const raw = data.message || 'Unable to load advice.'
      await updateProfile({ goal_advice: { ...goalAdvice, [goal.name]: raw } })
    } catch {
      await updateProfile({ goal_advice: { ...goalAdvice, [goal.name]: 'Unable to load advice. Please try again.' } })
    }
    setLoadingAdvice(null)
  }

  const saveGoalProgress = async (goal: Goal, newAmount: number) => {
    if (!profile || !userId) return
    const updatedGoals = profile.goals?.map((g: any) =>
      g.name === goal.name ? { ...g, current_amount: newAmount } : g
    ) || []
    const updatedProfile = { ...profile, goals: updatedGoals }
    const newAdvice = { ...goalAdvice }
    delete newAdvice[goal.name]
    await updateProfile({ profile_data: updatedProfile, goal_advice: newAdvice })

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProfile)
    })
    const result = await res.json()
    await updateProfile({ analysis: result })
    setUpdatingGoal(null)
    // Refresh advice with new progress context
    const updatedGoal = result.goals?.find((g: any) => g.name === goal.name) || goal
    setTimeout(() => fetchGoalAdvice(updatedGoal, true), 200)
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

  const isVisible = (id: string) => !preferences.hiddenSections.includes(id)
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!analysis) return (
    <div className="page" style={{ paddingTop: '52px', textAlign: 'center' }}>
      <p style={{ color: 'var(--sand-600)' }}>No analysis yet. Go to Home and refresh.</p>
    </div>
  )

  const retirementPlan = profile?.retirement_plan
  const income = profile?.monthly_income || analysis.monthlyIncome || 0
  const expenses = profile?.monthly_expenses || 0
  const savingsRate = income > 0 ? (analysis.availableToSave / income) * 100 : 0

  return (
    <div className="page" style={{ paddingTop: '0' }}>

      {/* Header */}
      <div style={{ padding: '52px 0 20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 4px', letterSpacing: '-0.5px' }}>Your Plan</h1>
        <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: 0 }}>Goals, cash flow, retirement & debt</p>
      </div>

      {/* Cash Flow */}
      {isVisible('cashflow') && income > 0 && (
        <CashFlowCard income={income} expenses={expenses} availableToSave={analysis.availableToSave} savingsRate={savingsRate} />
      )}

      {/* Goals */}
      {isVisible('goals') && analysis.goals.length > 0 && (
        <div className="animate-fade" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p className="label">Goals</p>
            <button className="btn-ghost" onClick={() => navigate('/onboarding')} style={{ fontSize: '11px', padding: '3px 8px' }}>+ Add goal</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analysis.goals.map((goal, i) => {
              const isAchieved = goal.currentAmount >= goal.targetAmount
              const surplus = goal.currentAmount - goal.targetAmount
              const goalColor = goal.feasibility === 'achievable' ? 'var(--success)' : goal.feasibility === 'stretch' ? 'var(--warning)' : 'var(--danger)'
              const advice = goalAdvice[goal.name]

              return (
                <div key={i} className="card animate-fade" style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <p style={{ fontSize: '15px', fontWeight: '500', margin: 0, color: 'var(--sand-900)' }}>{goal.name}</p>
                        {isAchieved && (
                          <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--success)', background: 'rgba(122,158,110,0.1)', padding: '2px 8px', borderRadius: '20px' }}>Achieved ✓</span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: '2px 0 0' }}>
                        {fmt(goal.currentAmount)} of {fmt(goal.targetAmount)}
                        {isAchieved && surplus > 0 && <span style={{ color: 'var(--success)' }}> · +{fmt(surplus)} surplus</span>}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '20px', fontWeight: '300', color: isAchieved ? 'var(--success)' : 'var(--sand-900)', margin: 0, letterSpacing: '-0.5px' }}>
                        {isAchieved ? '✓' : `${Math.round(goal.percentage)}%`}
                      </p>
                      {!isAchieved && goal.monthlyNeeded > 0 && (
                        <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{fmt(goal.monthlyNeeded)}/mo</p>
                      )}
                    </div>
                  </div>

                  {!isAchieved && <ProgressBar value={goal.percentage} color={goalColor} />}

                  {/* Goal Advice Recap */}
                  <div style={{ marginTop: '12px', background: 'var(--sand-200)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    {advice ? (
                      <>
                        {/* Header row — always visible */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer' }}
                          onClick={() => setMinimizedAdvice(m => ({ ...m, [goal.name]: !m[goal.name] }))}>
                          <div style={{ width: '18px', height: '18px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ color: 'var(--sand-50)', fontSize: '7px', fontWeight: '700' }}>AI</span>
                          </div>
                          <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-600)', margin: 0, flex: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI Analysis</p>
                          <span style={{ fontSize: '11px', color: 'var(--sand-400)', transition: 'transform 0.2s', display: 'inline-block', transform: minimizedAdvice[goal.name] ? 'none' : 'rotate(180deg)' }}>▾</span>
                        </div>
                        {/* Collapsible body */}
                        {!minimizedAdvice[goal.name] && (
                          <div style={{ padding: '0 12px 10px' }}>
                            <div>{formatAdvice(advice)}</div>
                            <button
                              onClick={async () => {
                                const newAdvice = { ...goalAdvice }
                                delete newAdvice[goal.name]
                                await updateProfile({ goal_advice: newAdvice })
                                setTimeout(() => fetchGoalAdvice(goal, true), 100)
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--sand-500)', fontSize: '10px', cursor: 'pointer', padding: '6px 0 0', fontFamily: 'inherit' }}>
                              ↻ Refresh
                            </button>
                          </div>
                        )}
                      </>
                    ) : loadingAdvice === goal.name ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 12px' }}>
                        <div style={{ width: '18px', height: '18px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: 'var(--sand-50)', fontSize: '7px', fontWeight: '700' }}>AI</span>
                        </div>
                        {[0, 150, 300].map(d => (
                          <div key={d} style={{ width: '5px', height: '5px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => fetchGoalAdvice(goal)}
                        style={{ background: 'none', border: 'none', color: 'var(--sand-500)', fontSize: '12px', cursor: 'pointer', padding: '10px 12px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                        <div style={{ width: '18px', height: '18px', background: 'var(--sand-300)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: 'var(--sand-600)', fontSize: '7px', fontWeight: '700' }}>AI</span>
                        </div>
                        Get AI analysis
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid var(--sand-200)' }}>
                    <button
                      onClick={() => openChat(
                        isAchieved ? `goal_surplus_${i}` : `goal_${i}`,
                        isAchieved
                          ? `I've exceeded my "${goal.name}" goal with a ${fmt(surplus)} surplus. What are the smartest ways to put this money to work?`
                          : `Give me a detailed plan for my "${goal.name}" goal. I have ${fmt(goal.currentAmount)} saved toward ${fmt(goal.targetAmount)}.`,
                        isAchieved ? `${goal.name} — Surplus` : `${goal.name} Plan`
                      )}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                      {isAchieved ? 'Put this money to work →' : chatRefs[`goal_${i}`] ? 'Continue plan →' : 'Get full advice →'}
                    </button>
                    <button
                      onClick={() => setUpdatingGoal(goal)}
                      style={{ background: 'var(--sand-200)', border: 'none', color: 'var(--sand-700)', fontSize: '11px', fontWeight: '500', cursor: 'pointer', padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit' }}>
                      Update
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Retirement */}
      {isVisible('retirement') && (
        <div className="animate-fade stagger-2" style={{ marginBottom: '24px' }}>
          <p className="label" style={{ marginBottom: '10px' }}>Retirement</p>
          <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/retirement')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 4px' }}>
                  {retirementPlan ? 'Projected retirement age' : 'Plan not set up yet'}
                </p>
                <p style={{ fontSize: '36px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 4px', letterSpacing: '-1px' }}>
                  {retirementPlan?.targetAge || '—'}
                </p>
                <p style={{ fontSize: '12px', color: retirementPlan?.onTrack ? 'var(--success)' : 'var(--sand-500)', margin: 0 }}>
                  {retirementPlan ? (retirementPlan.onTrack ? 'On track ✓' : 'Needs attention') : 'Tap to build your plan →'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                {retirementPlan ? (
                  <>
                    <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: '0 0 4px' }}>Save/mo</p>
                    <p style={{ fontSize: '18px', fontWeight: '500', color: 'var(--sand-900)', margin: 0 }}>{fmt(retirementPlan.monthlyContribution ?? 0)}</p>
                  </>
                ) : null}
                <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '4px 0 0' }}>View full plan →</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Plan */}
      {isVisible('actions') && analysis.nextActions.length > 0 && (
        <div className="animate-fade stagger-3" style={{ marginBottom: '24px' }}>
          <p className="label" style={{ marginBottom: '10px' }}>Action Plan</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analysis.nextActions.slice(0, 5).map((action, i) => (
              <div key={i} className="card" style={{ padding: '14px' }}>
                <button
                  onClick={() => setExpandedAction(expandedAction === i ? null : i)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)' }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 2px', color: 'var(--sand-900)' }}>{action.title}</p>
                      <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0 }}>{action.timeframe}</p>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--sand-400)' }}>{expandedAction === i ? '▲' : '▼'}</span>
                  </div>
                </button>
                {expandedAction === i && (
                  <div className="animate-fade" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid var(--sand-200)' }}>
                    <p style={{ fontSize: '13px', color: 'var(--sand-600)', margin: '0 0 12px', lineHeight: '1.5' }}>{action.description}</p>
                    <button
                      onClick={() => openChat(`action_${i}`, `Give me a step by step plan for: ${action.title}`, action.title)}
                      className="btn-primary"
                      style={{ fontSize: '12px', padding: '8px 14px' }}>
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
        <div className="animate-fade stagger-4" style={{ marginBottom: '24px' }}>
          <p className="label" style={{ marginBottom: '10px' }}>Debt Payoff</p>

          {/* Optimizer */}
          <DebtOptimizerCard debts={analysis.debts} analysis={analysis} />

          {/* Individual debt cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analysis.debts.map((debt, i) => (
              <div key={i} className="card">
                <button
                  onClick={() => setExpandedDebt(expandedDebt === i ? null : i)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: '500', margin: '0 0 3px', color: 'var(--sand-900)' }}>{debt.name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0 }}>{fmt(debt.balance)} · {debt.interestRate}% APR</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)', margin: 0 }}>{fmt(debt.recommendedPayment)}/mo</p>
                      <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '2px 0 0' }}>{debt.monthsToPayoff}mo left</p>
                    </div>
                  </div>
                </button>
                {expandedDebt === i && (
                  <div className="animate-fade" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid var(--sand-200)' }}>
                    <p style={{ fontSize: '13px', color: 'var(--sand-600)', margin: 0, lineHeight: '1.5' }}>{debt.strategy}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {updatingGoal && (
        <UpdateModal
          goal={updatingGoal}
          onClose={() => setUpdatingGoal(null)}
          onSave={(newAmount) => saveGoalProgress(updatingGoal, newAmount)}
        />
      )}
    </div>
  )
}
