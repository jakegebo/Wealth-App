import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}>
      <div className="animate-scale" style={{ background: 'var(--sand-50)', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '680px' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width: '36px', height: '4px', background: 'var(--sand-300)', borderRadius: '2px', margin: '0 auto 20px' }} />
        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px' }}>Update progress</h3>
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

export default function Plan() {
  const navigate = useNavigate()
  const { preferences } = useTheme()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [chatRefs, setChatRefs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [updatingGoal, setUpdatingGoal] = useState<Goal | null>(null)
  const [expandedDebt, setExpandedDebt] = useState<number | null>(null)
  const [expandedAction, setExpandedAction] = useState<number | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (data) {
      setProfile(data.profile_data)
      setChatRefs(data.chat_refs || {})
      if (data.analysis) setAnalysis(data.analysis)
    }
    setLoading(false)
  }

  const saveGoalProgress = async (goal: Goal, newAmount: number) => {
    if (!profile || !userId) return
    const updatedGoals = profile.goals?.map((g: any) =>
      g.name === goal.name ? { ...g, current_amount: newAmount } : g
    ) || []
    const updatedProfile = { ...profile, goals: updatedGoals }
    setProfile(updatedProfile)
    await supabase.from('profiles').update({ profile_data: updatedProfile }).eq('user_id', userId)

    // Re-run analysis with updated data
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProfile)
    })
    const result = await res.json()
    setAnalysis(result)
    await supabase.from('profiles').update({ analysis: result }).eq('user_id', userId)
    setUpdatingGoal(null)
  }

  const openChat = async (key: string, prompt: string, title: string) => {
    if (!userId) return
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data } = await supabase.from('chats').insert({ user_id: userId, title, topic: 'general', messages: [] }).select().single()
    if (data) {
      const newRefs = { ...chatRefs, [key]: data.id }
      setChatRefs(newRefs)
      await supabase.from('profiles').update({ chat_refs: newRefs }).eq('user_id', userId)
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

  return (
    <div className="page" style={{ paddingTop: '0' }}>

      {/* Header */}
      <div style={{ padding: '52px 0 20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 4px', letterSpacing: '-0.5px' }}>Your Plan</h1>
        <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: 0 }}>Goals, retirement & debt</p>
      </div>

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

              return (
                <div key={i} className="card animate-fade" style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ fontSize: '15px', fontWeight: '500', margin: 0 }}>{goal.name}</p>
                        {isAchieved && (
                          <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--success)', background: 'rgba(122,158,110,0.1)', padding: '2px 8px', borderRadius: '20px' }}>Achieved ✓</span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: '2px 0 0' }}>
                        {fmt(goal.currentAmount)} of {fmt(goal.targetAmount)}
                        {isAchieved && surplus > 0 && <span style={{ color: 'var(--success)' }}> · +{fmt(surplus)} surplus</span>}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '20px', fontWeight: '300', color: isAchieved ? 'var(--success)' : 'var(--sand-900)', margin: 0, letterSpacing: '-0.5px' }}>
                        {isAchieved ? '✓' : `${Math.round(goal.percentage)}%`}
                      </p>
                      {!isAchieved && goal.monthlyNeeded > 0 && (
                        <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{fmt(goal.monthlyNeeded)}/mo</p>
                      )}
                    </div>
                  </div>
                  {!isAchieved && <ProgressBar value={goal.percentage} color={goalColor} />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '0.5px solid var(--sand-200)' }}>
                    <button
                      onClick={() => openChat(
                        isAchieved ? `goal_surplus_${i}` : `goal_${i}`,
                        isAchieved
                          ? `I've exceeded my "${goal.name}" goal with a ${fmt(surplus)} surplus. What are the smartest ways to put this money to work?`
                          : `Give me a detailed plan for my "${goal.name}" goal. I have ${fmt(goal.currentAmount)} saved toward ${fmt(goal.targetAmount)}.`,
                        isAchieved ? `${goal.name} — Surplus` : `${goal.name} Plan`
                      )}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                      {isAchieved ? 'Put this money to work →' : chatRefs[`goal_${i}`] ? 'Continue plan →' : 'Get advice →'}
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
                <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 4px' }}>Projected retirement age</p>
                <p style={{ fontSize: '36px', fontWeight: '300', color: 'var(--sand-900)', margin: '0 0 4px', letterSpacing: '-1px' }}>52</p>
                <p style={{ fontSize: '12px', color: 'var(--success)', margin: 0 }}>On track ✓</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: '0 0 4px' }}>Save/mo</p>
                <p style={{ fontSize: '18px', fontWeight: '500', color: 'var(--sand-900)', margin: 0 }}>{fmt(analysis.availableToSave)}</p>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analysis.debts.map((debt, i) => (
              <div key={i} className="card">
                <button
                  onClick={() => setExpandedDebt(expandedDebt === i ? null : i)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: '500', margin: '0 0 3px' }}>{debt.name}</p>
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
                    <p style={{ fontSize: '13px', color: 'var(--sand-600)', margin: '0 0 12px', lineHeight: '1.5' }}>{debt.strategy}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Update Modal */}
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
