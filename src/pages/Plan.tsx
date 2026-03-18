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
    rate: d.interestRate / 100 / 12,
    minPayment: Math.max(d.recommendedPayment || 50, 10),
    interestRate: d.interestRate,
  }))

  let totalInterest = 0
  let months = 0

  while (state.some(d => d.remaining > 0.01) && months < 600) {
    months++

    // Sort for strategy priority each month
    const byPriority = [...state.map((d, i) => ({ ...d, i }))].filter(d => d.remaining > 0.01)
    if (strategy === 'avalanche') byPriority.sort((a, b) => b.interestRate - a.interestRate)
    if (strategy === 'snowball') byPriority.sort((a, b) => a.remaining - b.remaining)

    // Accrue interest and apply minimum payments
    for (const d of state) {
      if (d.remaining <= 0) continue
      const interest = d.remaining * d.rate
      totalInterest += interest
      d.remaining += interest
      const pmt = Math.min(d.remaining, d.minPayment)
      d.remaining -= pmt
      if (d.remaining < 0.01) d.remaining = 0
    }

    // Apply extra to top priority debt
    if (strategy !== 'minimum') {
      let extraLeft = extraPerMonth
      for (const priority of byPriority) {
        if (extraLeft <= 0) break
        const d = state[priority.i]
        if (d.remaining <= 0) continue
        const extra = Math.min(d.remaining, extraLeft)
        d.remaining -= extra
        extraLeft -= extra
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

  const minResult = simulatePayoff(debts, 0, 'minimum')
  const currentResult = simulatePayoff(debts, extraPayment, strategy)
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

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <p className="label" style={{ marginBottom: '12px' }}>Debt Payoff Optimizer</p>

      {/* Strategy toggle */}
      <div style={{ display: 'flex', background: 'var(--sand-200)', borderRadius: '10px', padding: '3px', marginBottom: '16px' }}>
        {([
          { key: 'avalanche', label: 'Avalanche', sub: 'highest rate first' },
          { key: 'snowball', label: 'Snowball', sub: 'lowest balance first' },
          { key: 'minimum', label: 'Minimums', sub: 'minimum only' },
        ] as const).map(opt => (
          <button key={opt.key} onClick={() => setStrategy(opt.key)}
            style={{ flex: 1, padding: '6px 4px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: strategy === opt.key ? 'var(--sand-50)' : 'transparent', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: strategy === opt.key ? 'var(--sand-900)' : 'var(--sand-500)', margin: 0 }}>{opt.label}</p>
          </button>
        ))}
      </div>

      {/* Extra payment slider */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--sand-600)', fontWeight: '500' }}>Extra payment per month</label>
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent)' }}>{fmt(extraPayment)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.min(2000, Math.round((analysis.availableToSave || 0)))}
          step={25}
          value={extraPayment}
          onChange={e => setExtraPayment(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <span style={{ fontSize: '10px', color: 'var(--sand-400)' }}>$0</span>
          <span style={{ fontSize: '10px', color: 'var(--sand-400)' }}>{fmt(Math.min(2000, analysis.availableToSave || 0))}</span>
        </div>
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div className="card-muted" style={{ padding: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '0 0 3px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payoff in</p>
          <p style={{ fontSize: '22px', fontWeight: '300', color: 'var(--sand-900)', margin: 0, letterSpacing: '-0.5px' }}>{formatMonths(currentResult.months)}</p>
          {monthsSaved > 0 && <p style={{ fontSize: '10px', color: 'var(--success)', margin: '2px 0 0' }}>↓ {formatMonths(monthsSaved)} faster</p>}
        </div>
        <div className="card-muted" style={{ padding: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '0 0 3px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total interest</p>
          <p style={{ fontSize: '22px', fontWeight: '300', color: 'var(--danger)', margin: 0, letterSpacing: '-0.5px' }}>{fmt(currentResult.totalInterest)}</p>
          {interestSaved > 0 && <p style={{ fontSize: '10px', color: 'var(--success)', margin: '2px 0 0' }}>↓ {fmt(interestSaved)} saved</p>}
        </div>
      </div>

      {/* Priority order */}
      {strategy !== 'minimum' && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-500)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
            {strategy === 'avalanche' ? 'Pay in this order (saves most interest)' : 'Pay in this order (builds momentum)'}
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
            </div>
          ))}
        </div>
      )}

      {strategy === 'minimum' && (
        <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0, lineHeight: '1.5', padding: '8px 12px', background: 'rgba(192,57,43,0.05)', borderRadius: 'var(--radius-sm)', border: '0.5px solid rgba(192,57,43,0.1)' }}>
          Minimum payments only will cost {fmt(minResult.totalInterest)} in interest over {formatMonths(minResult.months)}. Switching to avalanche or adding extra payments can save significantly.
        </p>
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

  const fetchGoalAdvice = async (goal: Goal) => {
    if (goalAdvice[goal.name] || loadingAdvice === goal.name) return
    setLoadingAdvice(goal.name)

    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Give me a 2-3 sentence advice recap for my "${goal.name}" goal. I have ${fmt(goal.currentAmount)} saved toward a ${fmt(goal.targetAmount)} target (${Math.round(goal.percentage)}% complete). I can save ${fmt(goal.monthlyNeeded)}/mo toward this. Be direct and specific — what's the single most important thing I should do right now? Keep it under 60 words.`
          }],
          profile,
          topic: 'general'
        })
      })
      const data = await res.json()
      const advice = data.message || ''
      await updateProfile({ goal_advice: { ...goalAdvice, [goal.name]: advice } })
    } catch { }
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
  }

  const openChat = async (key: string, prompt: string, title: string) => {
    if (!userId) return
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data } = await supabase.from('chats').insert({ user_id: userId, title, topic: 'general', messages: [] }).select().single()
    if (data) {
      await updateProfile({ chat_refs: { ...chatRefs, [key]: data.id } })
      navigate(`/chat/${data.id}`, { state: { prompt } })
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
                  <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--sand-200)', borderRadius: 'var(--radius-sm)' }}>
                    {advice ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <div style={{ width: '18px', height: '18px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                          <span style={{ color: 'var(--sand-50)', fontSize: '7px', fontWeight: '700' }}>AI</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '12px', color: 'var(--sand-700)', margin: 0, lineHeight: '1.5' }}>{advice}</p>
                          <button
                            onClick={async () => {
                              const newAdvice = { ...goalAdvice }
                              delete newAdvice[goal.name]
                              await updateProfile({ goal_advice: newAdvice })
                              setTimeout(() => fetchGoalAdvice(goal), 100)
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--sand-500)', fontSize: '10px', cursor: 'pointer', padding: '4px 0 0', fontFamily: 'inherit' }}>
                            ↻ Refresh advice
                          </button>
                        </div>
                      </div>
                    ) : loadingAdvice === goal.name ? (
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
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
                        style={{ background: 'none', border: 'none', color: 'var(--sand-500)', fontSize: '12px', cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '18px', height: '18px', background: 'var(--sand-300)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: 'var(--sand-600)', fontSize: '7px', fontWeight: '700' }}>AI</span>
                        </div>
                        Get AI advice recap
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
                    <p style={{ fontSize: '18px', fontWeight: '500', color: 'var(--sand-900)', margin: 0 }}>{fmt(retirementPlan.monthlyContribution)}</p>
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
