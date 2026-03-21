import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'
import { useProfile } from '../contexts/ProfileContext'
import { formatAIText } from '../lib/formatAIText'

interface Goal {
  name: string
  targetAmount: number
  currentAmount: number
  percentage: number
  monthlyNeeded: number
  feasibility: string
}

interface SuggestedGoal {
  id: string
  name: string
  category: string
  icon: string
  why: string
  how: string
  targetAmount: number
  monthlyNeeded: number
  timeline: string
  priority: 'high' | 'medium' | 'low'
}

function generateGoalSuggestions(profile: any, analysis: any): SuggestedGoal[] {
  const suggestions: SuggestedGoal[] = []
  const existingCategories = (profile?.goals || []).map((g: any) => g.category)
  const dismissed = profile?.dismissed_suggestions || []
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`

  const income = profile?.monthly_income || 0
  const expenses = profile?.monthly_expenses || 0
  const surplus = Math.max(0, income - expenses)
  const netWorth = analysis?.netWorth || 0
  const liquidSavings = (profile?.assets || [])
    .filter((a: any) => a.category === 'savings')
    .reduce((s: number, a: any) => s + (a.value || 0), 0)
  const emergencyMonths = expenses > 0 ? liquidSavings / expenses : 0
  const highDebt = (profile?.debts || []).filter((d: any) => (d.interest_rate || 0) > 10)
  const hasRetirement = (profile?.assets || []).some((a: any) => a.category === 'retirement')
  const hasRealEstate = (profile?.assets || []).some((a: any) => a.category === 'real_estate')

  // 1. Emergency fund
  if (emergencyMonths < 3 && !existingCategories.includes('emergency_fund') && !dismissed.includes('emergency_fund')) {
    const target = Math.round(expenses * 6)
    const needed = Math.max(0, target - liquidSavings)
    const monthly = Math.max(100, Math.round(surplus * 0.35))
    const mos = monthly > 0 ? Math.ceil(needed / monthly) : 24
    suggestions.push({
      id: 'emergency_fund', name: 'Build emergency fund', category: 'emergency_fund', icon: '🛡️',
      priority: 'high',
      why: `You have ${emergencyMonths.toFixed(1)} months of expenses covered${emergencyMonths < 1 ? ' — essentially nothing' : ''}. One unexpected job loss, car repair, or medical bill would force you into high-interest debt immediately.`,
      how: `Open a high-yield savings account (currently ~4.5% APY at Fidelity/Marcus). Auto-transfer ${fmt(monthly)}/mo. You'll hit 6 months of coverage in ${mos} months.`,
      targetAmount: target, monthlyNeeded: monthly, timeline: `${mos} months`,
    })
  }

  // 2. High-rate debt payoff
  if (highDebt.length > 0 && !existingCategories.includes('debt_payoff') && !dismissed.includes('debt_payoff')) {
    const top = [...highDebt].sort((a: any, b: any) => b.interest_rate - a.interest_rate)[0]
    const monthlyInterest = Math.round(top.balance * (top.interest_rate / 100 / 12))
    const extraPmt = Math.round(Math.min(surplus * 0.3, 400))
    const totalPmt = (top.minimum_payment || 0) + extraPmt
    const mos = totalPmt > 0 ? Math.ceil(top.balance / totalPmt) : 36
    if (!dismissed.includes('debt_payoff')) {
      suggestions.push({
        id: 'debt_payoff', name: `Pay off ${top.name}`, category: 'debt_payoff', icon: '💳',
        priority: 'high',
        why: `Your ${top.name} at ${top.interest_rate}% costs you ${fmt(monthlyInterest)}/mo — ${fmt(monthlyInterest * 12)}/yr — just in interest. Paying it off is a guaranteed ${top.interest_rate}% return on your money.`,
        how: `Pay ${fmt(totalPmt)}/mo (min ${fmt(top.minimum_payment || 0)} + ${fmt(extraPmt)} extra). Debt-free in ~${mos} months, saving ${fmt(monthlyInterest * mos * 0.6)} in interest.`,
        targetAmount: Math.round(top.balance), monthlyNeeded: totalPmt, timeline: `${mos} months`,
      })
    }
  }

  // 3. Roth IRA — if no retirement account
  if (!hasRetirement && !existingCategories.includes('retirement') && !dismissed.includes('roth_ira')) {
    const future = Math.round(500 * 12 * ((Math.pow(1.07, 30) - 1) / 0.07))
    suggestions.push({
      id: 'roth_ira', name: 'Open and fund a Roth IRA', category: 'investment', icon: '📈',
      priority: 'high',
      why: `You have no retirement account. Money in a Roth IRA grows completely tax-free. ${fmt(500)}/mo invested at 7% for 30 years becomes ${fmt(future)} — all tax-free at withdrawal.`,
      how: `Open at Fidelity (no minimums, no fees). Invest in VTI or a target-date fund. Contribute $583/mo to hit the $7,000/yr IRS limit.`,
      targetAmount: 7000, monthlyNeeded: 583, timeline: '12 months (annual)',
    })
  }

  // 4. Home down payment — if no real estate
  if (!hasRealEstate && !existingCategories.includes('home_purchase') && !dismissed.includes('home_purchase') && income > 3000) {
    const downTarget = Math.round(income * 12 * 2.5 * 0.2)
    const monthly = Math.round(Math.min(surplus * 0.25, 700))
    const mos = monthly > 0 ? Math.ceil(downTarget / monthly) : 48
    suggestions.push({
      id: 'home_purchase', name: 'Save for a home down payment', category: 'home_purchase', icon: '🏡',
      priority: 'medium',
      why: `A 20% down payment eliminates PMI (often $100–200/mo), qualifies you for lower rates, and builds equity from day one instead of paying it to a lender.`,
      how: `Keep this in a high-yield savings account or short-term T-bills (SGOV, ~5% yield). At ${fmt(monthly)}/mo you'd reach ${fmt(downTarget)} in ~${Math.ceil(mos / 12)} years.`,
      targetAmount: downTarget, monthlyNeeded: monthly, timeline: `~${Math.ceil(mos / 12)} years`,
    })
  }

  // 5. Net worth milestone
  const milestones = [10000, 25000, 50000, 100000, 250000, 500000, 1000000]
  const nextMilestone = milestones.find(m => m > netWorth)
  if (nextMilestone && !dismissed.includes(`milestone_${nextMilestone}`) && suggestions.length < 4) {
    const needed = nextMilestone - netWorth
    const monthly = Math.round(Math.min(surplus * 0.4, 1000))
    const mos = monthly > 0 ? Math.ceil(needed / monthly) : 36
    suggestions.push({
      id: `milestone_${nextMilestone}`, name: `Reach ${fmt(nextMilestone)} net worth`, category: 'investment', icon: '🎯',
      priority: 'medium',
      why: `You're ${fmt(needed)} away from the ${fmt(nextMilestone)} milestone. Net worth milestones are a proven benchmark for financial independence — each one opens more options.`,
      how: `Consistently investing ${fmt(monthly)}/mo in a diversified index fund (VTI) puts you there in ~${mos} months. Your existing assets also compound in the meantime.`,
      targetAmount: nextMilestone, monthlyNeeded: monthly, timeline: `~${mos} months`,
    })
  }

  return suggestions.slice(0, 4)
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
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)

  return (
    <div className="sheet-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,0.3)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
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

interface SimResult {
  months: number
  totalInterest: number
  payoffMonth: number[]         // indexed same as input debts
  firstMonthInterest: number[]  // interest accrued in month 1, per debt
}

function simulatePayoff(
  debts: { balance: number; interestRate: number; minPayment: number }[],
  extraPerMonth: number,
  strategy: 'minimum' | 'avalanche' | 'snowball'
): SimResult {
  if (!debts.length) return { months: 0, totalInterest: 0, payoffMonth: [], firstMonthInterest: [] }

  const state = debts.map(d => ({
    remaining: d.balance,
    monthlyRate: d.interestRate / 100 / 12,
    minPayment: Math.max(d.minPayment || 25, 10),
    interestRate: d.interestRate,
    payoffMonth: 0,
    done: false,
  }))

  const firstMonthInterest = state.map(d => d.remaining * d.monthlyRate)
  const totalMinimums = state.reduce((s, d) => s + d.minPayment, 0)
  const isMinimumOnly = strategy === 'minimum'
  let totalInterest = 0
  let months = 0

  while (state.some(d => d.remaining > 0.01) && months < 600) {
    months++

    for (const d of state) {
      if (d.remaining <= 0) continue
      const interest = d.remaining * d.monthlyRate
      totalInterest += interest
      d.remaining += interest
    }

    let budgetLeft = totalMinimums + (isMinimumOnly ? 0 : extraPerMonth)
    for (const d of state) {
      if (d.remaining <= 0) continue
      const pmt = Math.min(d.remaining, d.minPayment)
      d.remaining -= pmt
      budgetLeft -= pmt
      if (d.remaining < 0.01) { d.remaining = 0; if (!d.done) { d.done = true; d.payoffMonth = months } }
    }

    if (budgetLeft > 0.01 && !isMinimumOnly) {
      const active = state.map((d, i) => ({ ...d, idx: i })).filter(d => d.remaining > 0.01)
      if (strategy === 'avalanche') active.sort((a, b) => b.interestRate - a.interestRate)
      else if (strategy === 'snowball') active.sort((a, b) => a.remaining - b.remaining)

      for (const item of active) {
        if (budgetLeft <= 0.01) break
        const d = state[item.idx]
        const pay = Math.min(d.remaining, budgetLeft)
        d.remaining -= pay
        budgetLeft -= pay
        if (d.remaining < 0.01) { d.remaining = 0; if (!d.done) { d.done = true; d.payoffMonth = months } }
      }
    }
  }

  // Catch anything still running at cap
  for (const d of state) {
    if (!d.done) d.payoffMonth = months
  }

  return { months, totalInterest: Math.round(totalInterest), payoffMonth: state.map(d => d.payoffMonth), firstMonthInterest }
}

function CashFlowCard({ income, expenses, availableToSave, savingsRate }: {
  income: number
  expenses: number
  availableToSave: number
  savingsRate: number
}) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)
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
            <div style={{ height: '100%', width: `${expPct}%`, background: 'var(--danger)', borderRadius: '4px', transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }} />
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
            <div style={{ height: '100%', width: `${savePct}%`, background: availableToSave >= 0 ? 'var(--accent)' : 'var(--danger)', borderRadius: '4px', transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }} />
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

function DebtOptimizerCard({ profileDebts, availableToSave }: {
  profileDebts: { name: string; balance: number; interest_rate: number; minimum_payment?: number }[]
  availableToSave: number
}) {
  const [strategy, setStrategy] = useState<'minimum' | 'avalanche' | 'snowball'>('avalanche')
  const [extraPayment, setExtraPayment] = useState(100)
  const [activePlan, setActivePlan] = useState<'avalanche' | 'snowball' | 'minimum' | null>(() => {
    return (localStorage.getItem('debt_active_plan') as any) || null
  })
  const [changingPlan, setChangingPlan] = useState(false)

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)

  if (!profileDebts.length) return null

  const debts = profileDebts.map(d => ({
    name: d.name,
    balance: d.balance || 0,
    interestRate: d.interest_rate || 0,
    minPayment: Math.max(d.minimum_payment || Math.ceil((d.balance || 0) * 0.02), 10),
  }))

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
  const totalMinimums = debts.reduce((s, d) => s + d.minPayment, 0)
  const totalMonthlyInterest = debts.reduce((s, d) => s + d.balance * (d.interestRate / 100 / 12), 0)
  const maxExtra = Math.max(200, Math.round(availableToSave))

  const avaResult  = simulatePayoff(debts, extraPayment, 'avalanche')
  const snowResult = simulatePayoff(debts, extraPayment, 'snowball')
  const minResult  = simulatePayoff(debts, 0, 'minimum')

  // Recommendation logic
  const highestRateDebt = [...debts].sort((a, b) => b.interestRate - a.interestRate)[0]
  const smallDebtCount = debts.filter(d => d.balance < 3500).length
  const interestGap = snowResult.totalInterest - avaResult.totalInterest // positive = avalanche cheaper
  const recommended: 'avalanche' | 'snowball' = (() => {
    if (debts.length === 1) return 'avalanche'
    if (interestGap < 300 && smallDebtCount >= 2) return 'snowball'
    return 'avalanche'
  })()

  const recommendReason = recommended === 'avalanche'
    ? `Your ${highestRateDebt.name} at ${highestRateDebt.interestRate}% APR costs ${fmt(highestRateDebt.balance * highestRateDebt.interestRate / 100 / 12)}/mo in interest alone. Hit it hardest first — Avalanche saves you ${fmt(interestGap)} more than Snowball.`
    : `You have ${smallDebtCount} debts under $3,500. Snowball knocks them out fast, giving you real wins early — and costs only ${fmt(-interestGap)} more in interest than Avalanche. Worth it.`

  const displayStrategy = activePlan && !changingPlan ? activePlan : strategy

  const sortedDebts = displayStrategy === 'avalanche'
    ? [...debts].sort((a, b) => b.interestRate - a.interestRate)
    : displayStrategy === 'snowball'
    ? [...debts].sort((a, b) => a.balance - b.balance)
    : [...debts]

  const curResult = displayStrategy === 'avalanche' ? avaResult : displayStrategy === 'snowball' ? snowResult : minResult
  const interestSaved = minResult.totalInterest - curResult.totalInterest
  const monthsSaved = minResult.months - curResult.months

  const payoffByName = Object.fromEntries(debts.map((d, i) => [d.name, curResult.payoffMonth[i] || 0]))
  const interestByName = Object.fromEntries(debts.map((d, i) => [d.name, curResult.firstMonthInterest[i] || 0]))

  const thisMonth = sortedDebts.map((d, i) => {
    const monthlyInterest = interestByName[d.name] || 0
    const payment = i === 0 && displayStrategy !== 'minimum'
      ? Math.min(d.balance + monthlyInterest, d.minPayment + extraPayment)
      : d.minPayment
    const principal = Math.max(0, payment - monthlyInterest)
    return { payment, monthlyInterest, principal }
  })

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
      label: 'Avalanche', tagline: 'Saves the most money', emoji: '🧊',
      detail: 'Target highest interest rate first. Every extra dollar eliminates the most expensive debt. Roll each freed payment into the next.',
      color: 'var(--accent)', accent: 'rgba(122,158,110,0.1)', border: 'rgba(122,158,110,0.25)',
      focusLabel: 'ATTACK FIRST', focusColor: 'var(--accent)',
    },
    snowball: {
      label: 'Snowball', tagline: 'Builds fastest momentum', emoji: '⛄',
      detail: 'Target smallest balance first. Clear debts quickly for psychological wins. Roll each freed payment into the next smallest.',
      color: '#6a8aae', accent: 'rgba(106,138,174,0.1)', border: 'rgba(106,138,174,0.25)',
      focusLabel: 'FIRST WIN', focusColor: '#6a8aae',
    },
    minimum: {
      label: 'Minimum only', tagline: 'Costs the most', emoji: '⚠️',
      detail: 'Pay only required minimums. Longest payoff timeline, maximum interest paid to lenders.',
      color: 'var(--danger)', accent: 'rgba(192,57,43,0.06)', border: 'rgba(192,57,43,0.18)',
      focusLabel: '', focusColor: 'var(--danger)',
    },
  }

  const selectPlan = (plan: 'avalanche' | 'snowball' | 'minimum') => {
    setActivePlan(plan)
    setStrategy(plan)
    setChangingPlan(false)
    localStorage.setItem('debt_active_plan', plan)
  }

  const isSelectionMode = !activePlan || changingPlan
  const planInfo = STRATEGY_INFO[displayStrategy]
  const isRecommendedActive = activePlan === recommended

  return (
    <div className="card animate-fade" style={{ marginBottom: '24px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <p className="label" style={{ marginBottom: '4px' }}>Debt Payoff Optimizer</p>
          {activePlan && !changingPlan ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--sand-900)' }}>
                {planInfo.emoji} {planInfo.label} Plan
              </span>
              {isRecommendedActive && (
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--success)', background: 'rgba(122,158,110,0.12)', padding: '2px 7px', borderRadius: '20px' }}>
                  ✓ Recommended
                </span>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--sand-600)', margin: 0 }}>
              {isSelectionMode && activePlan ? 'Choose a new plan' : 'Choose a payoff plan'}
            </p>
          )}
        </div>
        {activePlan && !changingPlan && (
          <button
            onClick={() => setChangingPlan(true)}
            style={{ background: 'none', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontSize: '11px', color: 'var(--sand-600)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '500' }}
          >
            Change plan
          </button>
        )}
      </div>

      {/* ── Debt summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '16px' }}>
        {[
          { label: 'Total debt', value: fmt(totalDebt), sub: `${debts.length} debt${debts.length !== 1 ? 's' : ''}`, danger: false },
          { label: 'Monthly interest', value: fmt(totalMonthlyInterest), sub: `${fmt(totalMonthlyInterest * 12)}/yr lost`, danger: true },
          { label: 'Min payments', value: fmt(totalMinimums), sub: 'required/mo', danger: false },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--sand-100)', borderRadius: '10px', padding: '10px', border: '0.5px solid var(--sand-200)' }}>
            <p style={{ fontSize: '9px', fontWeight: '600', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>{s.label}</p>
            <p style={{ fontSize: '14px', fontWeight: '600', color: s.danger ? 'var(--danger)' : 'var(--sand-900)', margin: '0 0 1px' }}>{s.value}</p>
            <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Recommendation banner — always visible ── */}
      <div style={{
        padding: '12px 14px', marginBottom: '16px',
        background: recommended === 'avalanche' ? 'rgba(122,158,110,0.08)' : 'rgba(106,138,174,0.08)',
        border: `0.5px solid ${recommended === 'avalanche' ? 'rgba(122,158,110,0.25)' : 'rgba(106,138,174,0.25)'}`,
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
          <span style={{ fontSize: '13px' }}>{STRATEGY_INFO[recommended].emoji}</span>
          <span style={{ fontSize: '11px', fontWeight: '700', color: STRATEGY_INFO[recommended].color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recommended: {STRATEGY_INFO[recommended].label}
          </span>
          {activePlan && activePlan !== recommended && (
            <span style={{ fontSize: '10px', color: 'var(--sand-400)', marginLeft: 'auto' }}>
              (your plan differs)
            </span>
          )}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--sand-700)', margin: 0, lineHeight: '1.5' }}>
          {recommendReason}
        </p>
        {activePlan && activePlan !== recommended && (
          <button
            onClick={() => selectPlan(recommended)}
            style={{ marginTop: '9px', background: 'none', border: `0.5px solid ${STRATEGY_INFO[recommended].border}`, borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontSize: '11px', fontWeight: '600', color: STRATEGY_INFO[recommended].color, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Switch to {STRATEGY_INFO[recommended].label} →
          </button>
        )}
      </div>

      {/* ── SELECTION MODE: strategy picker ── */}
      {isSelectionMode && (
        <div className="animate-fade">
          {/* Strategy tabs */}
          <div style={{ display: 'flex', background: 'var(--sand-200)', borderRadius: '10px', padding: '3px', marginBottom: '12px' }}>
            {(['avalanche', 'snowball', 'minimum'] as const).map(s => {
              const isRec = s === recommended
              return (
                <button key={s} onClick={() => setStrategy(s)} style={{
                  flex: 1, padding: '8px 4px', borderRadius: '7px', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all var(--spring-fast)',
                  background: strategy === s ? 'var(--sand-50)' : 'transparent', position: 'relative',
                }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: strategy === s ? 'var(--sand-900)' : 'var(--sand-500)', margin: 0 }}>
                    {STRATEGY_INFO[s].label}
                  </p>
                  {isRec && (
                    <div style={{ position: 'absolute', top: '3px', right: '3px', width: '5px', height: '5px', borderRadius: '50%', background: STRATEGY_INFO[s].color, opacity: 0.7 }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Strategy detail */}
          <div style={{ padding: '10px 12px', background: planInfo.accent, border: `0.5px solid ${planInfo.border}`, borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: planInfo.color }}>{planInfo.label}</span>
              <span style={{ fontSize: '10px', color: planInfo.color, background: planInfo.border, padding: '1px 6px', borderRadius: '20px', fontWeight: '600' }}>{planInfo.tagline}</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--sand-600)', margin: 0, lineHeight: '1.5' }}>{planInfo.detail}</p>
          </div>

          {/* Extra payment slider */}
          {strategy !== 'minimum' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--sand-600)', fontWeight: '500' }}>Extra payment / month</label>
                <span style={{ fontSize: '14px', fontWeight: '700', color: extraPayment > 0 ? 'var(--accent)' : 'var(--sand-500)' }}>
                  {extraPayment > 0 ? `+${fmt(extraPayment)}` : '$0'}
                </span>
              </div>
              <input type="range" min={0} max={maxExtra} step={25} value={extraPayment}
                onChange={e => setExtraPayment(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span style={{ fontSize: '10px', color: 'var(--sand-400)' }}>$0</span>
                <span style={{ fontSize: '10px', color: 'var(--sand-400)' }}>Max {fmt(maxExtra)}/mo surplus</span>
              </div>
            </div>
          )}

          {/* Preview results */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '16px' }}>
            {[
              { label: 'Debt-free in', value: formatMonths(curResult.months), sub: monthsSaved > 0 ? `↓ ${formatMonths(monthsSaved)} sooner than minimums` : 'slowest path', danger: false },
              { label: 'Total interest', value: fmt(curResult.totalInterest), sub: interestSaved > 0 ? `↓ ${fmt(interestSaved)} saved vs minimums` : 'maximum interest cost', danger: displayStrategy === 'minimum' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--sand-100)', borderRadius: '10px', padding: '12px', border: '0.5px solid var(--sand-200)', textAlign: 'center' }}>
                <p style={{ fontSize: '9px', fontWeight: '600', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 3px' }}>{s.label}</p>
                <p style={{ fontSize: '18px', fontWeight: '700', color: s.danger ? 'var(--danger)' : 'var(--sand-900)', margin: '0 0 3px', letterSpacing: '-0.5px' }}>{s.value}</p>
                <p style={{ fontSize: '10px', color: interestSaved > 0 ? 'var(--success)' : 'var(--sand-400)', margin: 0, fontWeight: '600' }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* SELECT PLAN CTA */}
          <button
            onClick={() => selectPlan(strategy)}
            style={{
              width: '100%', padding: '14px', borderRadius: 'var(--radius-md)',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: strategy === 'minimum' ? 'var(--sand-300)' : 'var(--accent)',
              color: strategy === 'minimum' ? 'var(--sand-700)' : 'var(--sand-50)',
              fontSize: '14px', fontWeight: '700', letterSpacing: '0.01em',
              boxShadow: strategy !== 'minimum' ? '0 2px 12px rgba(0,0,0,0.15)' : 'none',
              transition: 'all var(--spring-fast)',
            }}
          >
            {strategy === 'minimum'
              ? 'Select minimum payments (not recommended)'
              : `Select ${planInfo.label} plan →`}
          </button>
          {activePlan && (
            <button
              onClick={() => setChangingPlan(false)}
              style={{ width: '100%', marginTop: '8px', padding: '10px', background: 'none', border: 'none', color: 'var(--sand-500)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Keep current plan
            </button>
          )}
        </div>
      )}

      {/* ── PLAN ACTIVE MODE ── */}
      {activePlan && !changingPlan && (
        <div className="animate-fade">

          {/* Active plan hero */}
          {activePlan === 'avalanche' && (
            <div style={{ padding: '14px 16px', background: 'rgba(122,158,110,0.08)', border: '0.5px solid rgba(122,158,110,0.22)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Interest you're eliminating</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--success)', margin: '0 0 1px', letterSpacing: '-0.5px' }}>{fmt(interestSaved)}</p>
                  <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>saved vs minimum-only</p>
                </div>
                <div>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent)', margin: '0 0 1px', letterSpacing: '-0.5px' }}>{formatMonths(curResult.months)}</p>
                  <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>until debt-free</p>
                </div>
              </div>
            </div>
          )}

          {activePlan === 'snowball' && (
            <div style={{ padding: '14px 16px', background: 'rgba(106,138,174,0.08)', border: '0.5px solid rgba(106,138,174,0.22)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#6a8aae', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Your momentum path</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: '#6a8aae', margin: '0 0 1px', letterSpacing: '-0.5px' }}>{debts.length}</p>
                  <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>debts to eliminate</p>
                </div>
                <div>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent)', margin: '0 0 1px', letterSpacing: '-0.5px' }}>{formatMonths(curResult.months)}</p>
                  <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>until debt-free</p>
                </div>
              </div>
              {/* Win counter — debts paid off within 12 months */}
              {(() => {
                const quickWins = sortedDebts.filter(d => (payoffByName[d.name] || 999) <= 12)
                return quickWins.length > 0 ? (
                  <p style={{ fontSize: '12px', color: '#6a8aae', margin: '10px 0 0', fontWeight: '600' }}>
                    ⛄ {quickWins.length} debt{quickWins.length > 1 ? 's' : ''} gone within a year: {quickWins.map(d => d.name).join(', ')}
                  </p>
                ) : null
              })()}
            </div>
          )}

          {activePlan === 'minimum' && (
            <div style={{ padding: '14px 16px', background: 'rgba(192,57,43,0.06)', border: '0.5px solid rgba(192,57,43,0.18)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>⚠️ Cost of minimums-only</p>
              <p style={{ fontSize: '13px', color: 'var(--sand-700)', margin: '0 0 8px', lineHeight: '1.5' }}>
                You'll pay {fmt(minResult.totalInterest)} in interest over {formatMonths(minResult.months)}. Switching to Avalanche saves {fmt(minResult.totalInterest - avaResult.totalInterest)} and finishes {formatMonths(minResult.months - avaResult.months)} sooner.
              </p>
            </div>
          )}

          {/* Extra payment slider — active mode */}
          {activePlan !== 'minimum' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--sand-600)', fontWeight: '500' }}>Extra payment / month</label>
                <span style={{ fontSize: '14px', fontWeight: '700', color: extraPayment > 0 ? 'var(--accent)' : 'var(--sand-500)' }}>
                  {extraPayment > 0 ? `+${fmt(extraPayment)}` : '$0'}
                </span>
              </div>
              <input type="range" min={0} max={maxExtra} step={25} value={extraPayment}
                onChange={e => setExtraPayment(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span style={{ fontSize: '10px', color: 'var(--sand-400)' }}>$0/mo extra</span>
                <span style={{ fontSize: '10px', color: 'var(--sand-400)' }}>{fmt(maxExtra)}/mo max surplus</span>
              </div>
            </div>
          )}

          {/* Debt list — plan-optimized */}
          <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-400)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
            {activePlan === 'avalanche' ? 'Attack order — highest rate first' : activePlan === 'snowball' ? 'Win order — smallest balance first' : 'Minimum payments only'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedDebts.map((debt, i) => {
              const pmt = thisMonth[i]
              const payoffMo = payoffByName[debt.name] || 0
              const isFocus = i === 0 && activePlan !== 'minimum'
              const rateColor = debt.interestRate >= 15 ? 'var(--danger)' : debt.interestRate >= 7 ? 'var(--warning)' : 'var(--success)'
              const focusColor = activePlan === 'snowball' ? '#6a8aae' : 'var(--accent)'
              const focusBg = activePlan === 'snowball' ? 'rgba(106,138,174,0.08)' : 'var(--accent-light)'
              const focusBorder = activePlan === 'snowball' ? 'rgba(106,138,174,0.3)' : 'var(--accent-border)'

              return (
                <div key={debt.name} style={{
                  border: isFocus ? `1.5px solid ${focusBorder}` : '0.5px solid var(--sand-200)',
                  borderRadius: '12px',
                  background: isFocus ? focusBg : 'var(--sand-50)',
                  overflow: 'hidden',
                  transition: 'all var(--transition)',
                }}>
                  <div style={{ padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '2px' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: isFocus ? focusColor : 'var(--sand-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '9px', fontWeight: '700', color: isFocus ? 'var(--sand-50)' : 'var(--sand-600)' }}>{i + 1}</span>
                        </div>
                        <p style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>{debt.name}</p>
                        {isFocus && (
                          <span style={{ fontSize: '9px', fontWeight: '700', color: focusColor, background: activePlan === 'snowball' ? 'rgba(106,138,174,0.15)' : 'rgba(122,158,110,0.15)', padding: '2px 7px', borderRadius: '20px' }}>
                            {planInfo.focusLabel}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0, paddingLeft: '25px' }}>
                        {fmt(debt.balance)} ·{' '}
                        <span style={{ color: rateColor, fontWeight: '600' }}>{debt.interestRate}% APR</span>
                        {activePlan === 'avalanche' && isFocus && (
                          <span style={{ color: 'var(--danger)', fontWeight: '600' }}> · {fmt(pmt.monthlyInterest)}/mo in interest</span>
                        )}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '16px', fontWeight: '700', color: isFocus ? focusColor : 'var(--sand-900)', margin: '0 0 1px' }}>{fmt(pmt.payment)}/mo</p>
                      <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: 0 }}>
                        {isFocus && extraPayment > 0 ? `${fmt(debt.minPayment)} min + ${fmt(extraPayment)} extra` : payoffMo > 0 ? `Done in ${formatMonths(payoffMo)}` : '—'}
                      </p>
                    </div>
                  </div>

                  <div style={{ padding: '0 14px 12px' }}>
                    <div style={{ height: '5px', background: 'var(--sand-200)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                      <div style={{ height: '100%', width: `${pmt.payment > 0 ? Math.min(100, (pmt.monthlyInterest / pmt.payment) * 100) : 0}%`, background: 'var(--danger)', borderRadius: '3px', transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: '600' }}>{fmt(pmt.monthlyInterest)} interest</span>
                      <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '600' }}>{fmt(pmt.principal)} principal</span>
                    </div>
                    {isFocus && extraPayment > 0 && (
                      <p style={{ fontSize: '10px', color: focusColor, fontWeight: '600', margin: '5px 0 0' }}>
                        ↑ +{fmt(extraPayment)} extra cuts {formatMonths(Math.max(0, minResult.payoffMonth[debts.findIndex(d => d.name === debt.name)] - payoffMo))} off payoff
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
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
  const [expandedAction, setExpandedAction] = useState<number | null>(null)
  const [loadingAdvice, setLoadingAdvice] = useState<string | null>(null)
  const [minimizedAdvice, setMinimizedAdvice] = useState<Record<string, boolean>>({})

  // Goal suggestions
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [addingGoalId, setAddingGoalId] = useState<string | null>(null)
  // Goal removal
  const [confirmRemoveGoal, setConfirmRemoveGoal] = useState<number | null>(null)
  // Action completion
  const [showCompletedActions, setShowCompletedActions] = useState(false)

  const stripAdviceMeta = (text: string) =>
    text.replace(/<followups>[\s\S]*?<\/followups>/g, '').replace(/<chart>[\s\S]*?<\/chart>/g, '').trim()

  const formatAdvice = (text: string) =>
    formatAIText(stripAdviceMeta(text), { baseFontSize: '12px', textColor: 'var(--sand-700)' })

  const fetchGoalAdvice = async (goal: Goal, force = false) => {
    if (!force && goalAdvice[goal.name]) return
    if (loadingAdvice === goal.name) return
    setLoadingAdvice(goal.name)

    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)
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

  const rerunAnalysis = async (updatedProfile: any) => {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProfile)
    })
    const result = await res.json()
    await updateProfile({ analysis: result })
    return result
  }

  const removeGoal = async (goalIndex: number) => {
    if (!profile) return
    const goalToRemove = (profile.goals || [])[goalIndex]
    const updatedGoals = (profile.goals || []).filter((_: any, i: number) => i !== goalIndex)
    const updatedProfile = { ...profile, goals: updatedGoals }
    const newAdvice = { ...goalAdvice }
    if (goalToRemove?.name) delete newAdvice[goalToRemove.name]
    await updateProfile({ profile_data: updatedProfile, goal_advice: newAdvice })
    setConfirmRemoveGoal(null)
    rerunAnalysis(updatedProfile)
  }

  const addSuggestedGoal = async (suggestion: SuggestedGoal) => {
    if (!profile) return
    setAddingGoalId(suggestion.id)
    const newGoal = {
      name: suggestion.name,
      category: suggestion.category,
      target_amount: suggestion.targetAmount,
      current_amount: 0,
      timeline: suggestion.timeline,
      priority: suggestion.priority,
      monthly_contribution: suggestion.monthlyNeeded,
    }
    const updatedProfile = { ...profile, goals: [...(profile.goals || []), newGoal] }
    await updateProfile({ profile_data: updatedProfile })
    await rerunAnalysis(updatedProfile)
    setAddingGoalId(null)
    setShowSuggestions(false)
  }

  const dismissSuggestion = async (id: string) => {
    if (!profile) return
    const dismissed = [...(profile.dismissed_suggestions || []), id]
    await updateProfile({ profile_data: { ...profile, dismissed_suggestions: dismissed } })
  }

  const completeAction = async (actionTitle: string) => {
    if (!profile) return
    const completed = [...(profile.completed_actions || []), actionTitle]
    await updateProfile({ profile_data: { ...profile, completed_actions: completed } })
  }

  const uncompleteAction = async (actionTitle: string) => {
    if (!profile) return
    const completed = (profile.completed_actions || []).filter((t: string) => t !== actionTitle)
    await updateProfile({ profile_data: { ...profile, completed_actions: completed } })
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
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0)

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
  const completedActions: string[] = profile?.completed_actions || []
  const pendingActions = analysis.nextActions.filter((a: any) => !completedActions.includes(a.title))
  const doneActions = analysis.nextActions.filter((a: any) => completedActions.includes(a.title))

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
      {isVisible('goals') && analysis.goals.length > 0 && (() => {
        const suggestions = generateGoalSuggestions(profile, analysis)
        return (
        <div className="animate-fade" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p className="label">Goals</p>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {suggestions.length > 0 && (
                <button
                  onClick={() => setShowSuggestions(s => !s)}
                  style={{ fontSize: '11px', padding: '3px 8px', background: showSuggestions ? 'var(--accent)' : 'var(--sand-200)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: showSuggestions ? 'white' : 'var(--sand-700)', fontFamily: 'inherit', fontWeight: '500' }}>
                  💡 {suggestions.length} Suggestion{suggestions.length > 1 ? 's' : ''}
                </button>
              )}
              <button className="btn-ghost" onClick={() => navigate('/onboarding?step=4')} style={{ fontSize: '11px', padding: '3px 8px' }}>+ Add goal</button>
            </div>
          </div>

          {/* Suggestions panel */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {suggestions.map(s => (
                <div key={s.id} style={{ background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>{s.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 2px', color: 'var(--sand-900)' }}>{s.name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--sand-600)', margin: '0 0 4px', lineHeight: '1.4' }}><strong>Why:</strong> {s.why}</p>
                      <p style={{ fontSize: '12px', color: 'var(--sand-600)', margin: '0 0 8px', lineHeight: '1.4' }}><strong>How:</strong> {s.how}</p>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {s.targetAmount > 0 && <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>Target: {fmt(s.targetAmount)}</span>}
                        {s.monthlyNeeded > 0 && <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>· {fmt(s.monthlyNeeded)}/mo</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid var(--accent-border)' }}>
                    <button
                      disabled={addingGoalId === s.id}
                      onClick={() => addSuggestedGoal(s)}
                      style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', color: 'white', fontSize: '12px', fontWeight: '600', padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit', opacity: addingGoalId === s.id ? 0.6 : 1 }}>
                      {addingGoalId === s.id ? 'Adding…' : '+ Add to my goals'}
                    </button>
                    <button
                      onClick={() => dismissSuggestion(s.id)}
                      style={{ background: 'none', border: '0.5px solid var(--accent-border)', borderRadius: 'var(--radius-sm)', color: 'var(--sand-500)', fontSize: '12px', padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

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
                          <span style={{ fontSize: '11px', color: 'var(--sand-400)', transition: 'transform 0.2s', display: 'inline-block', transform: minimizedAdvice[goal.name] ? 'rotate(180deg)' : 'none' }}>▾</span>
                        </div>
                        {/* Collapsible body */}
                        {minimizedAdvice[goal.name] && (
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
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {confirmRemoveGoal === i ? (
                        <>
                          <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>Remove goal?</span>
                          <button
                            onClick={() => removeGoal(i)}
                            style={{ background: 'var(--danger)', border: 'none', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer', padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit' }}>
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmRemoveGoal(null)}
                            style={{ background: 'var(--sand-200)', border: 'none', color: 'var(--sand-700)', fontSize: '11px', cursor: 'pointer', padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit' }}>
                            No
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setUpdatingGoal(goal)}
                            style={{ background: 'var(--sand-200)', border: 'none', color: 'var(--sand-700)', fontSize: '11px', fontWeight: '500', cursor: 'pointer', padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit' }}>
                            Update
                          </button>
                          <button
                            onClick={() => setConfirmRemoveGoal(i)}
                            style={{ background: 'none', border: '0.5px solid var(--sand-300)', color: 'var(--sand-500)', fontSize: '11px', cursor: 'pointer', padding: '5px 8px', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit' }}>
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
      })()}

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p className="label">Action Plan</p>
            {doneActions.length > 0 && (
              <button
                onClick={() => setShowCompletedActions(s => !s)}
                style={{ fontSize: '11px', padding: '3px 8px', background: 'var(--sand-200)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--sand-600)', fontFamily: 'inherit' }}>
                ✓ Completed ({doneActions.length})
              </button>
            )}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {pendingActions.slice(0, 5).map((action: any, i: number) => (
              <div key={i} style={{ borderBottom: i < Math.min(pendingActions.length, 5) - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
                <button
                  onClick={() => setExpandedAction(expandedAction === i ? null : i)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--sand-400)', minWidth: '16px' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 1px', color: 'var(--sand-900)' }}>{action.title}</p>
                      <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: 0 }}>{action.timeframe}</p>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--sand-400)' }}>{expandedAction === i ? '▲' : '▼'}</span>
                  </div>
                </button>
                {expandedAction === i && (
                  <div className="animate-fade" style={{ padding: '0 16px 14px', paddingLeft: '40px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--sand-600)', margin: '0 0 12px', lineHeight: '1.5' }}>{action.description}</p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => openChat(`action_${i}`, `Give me a step by step plan for: ${action.title}`, action.title)}
                        className="btn-primary"
                        style={{ fontSize: '12px', padding: '8px 14px' }}>
                        {chatRefs[`action_${i}`] ? 'Continue plan →' : 'Get detailed steps →'}
                      </button>
                      <button
                        onClick={() => completeAction(action.title)}
                        style={{ background: 'none', border: '0.5px solid var(--success)', color: 'var(--success)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', padding: '7px 12px', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit' }}>
                        ✓ Mark done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Completed actions */}
          {showCompletedActions && doneActions.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {doneActions.map((action: any, i: number) => (
                <div key={i} style={{ background: 'var(--sand-100)', border: '0.5px solid var(--sand-200)', borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'white', fontSize: '11px', fontWeight: '700' }}>✓</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: '500', margin: 0, color: 'var(--sand-600)', textDecoration: 'line-through' }}>{action.title}</p>
                  </div>
                  <button
                    onClick={() => uncompleteAction(action.title)}
                    style={{ background: 'none', border: 'none', color: 'var(--sand-400)', fontSize: '11px', cursor: 'pointer', padding: '2px 4px', fontFamily: 'inherit' }}>
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Debt */}
      {isVisible('debt') && (profile?.debts?.length > 0) && (
        <div className="animate-fade stagger-4" style={{ marginBottom: '24px' }}>
          <DebtOptimizerCard
            profileDebts={profile.debts}
            availableToSave={analysis.availableToSave}
          />
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
