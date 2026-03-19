import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../contexts/ProfileContext'
import { detectAccountLimit, getContributionStatus } from '../lib/retirementLimits'
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

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RetirementPlan {
  currentAge: number
  targetAge: number
  currentSavings: number
  monthlyContribution: number
  targetNestEgg: number
  projectedNestEgg: number
  onTrack: boolean
  yearsToRetirement: number
  monthlyInRetirement: number
  shortfall: number
}

function formatMessage(content: string) {
  return content.split('\n').map((line, i) => {
    if (line.match(/^\d+\./)) {
      const num = line.split('.')[0]
      const text = line.split('.').slice(1).join('.').trim()
      return (
        <div key={i} style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <span style={{ color: 'var(--accent)', fontWeight: '700', minWidth: '16px', fontSize: '13px' }}>{num}.</span>
          <span style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--sand-800)' }}>{text}</span>
        </div>
      )
    }
    if (line.startsWith('- ')) return (
      <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <span style={{ color: 'var(--accent)', fontWeight: '700' }}>·</span>
        <span style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--sand-800)' }}>{line.slice(2)}</span>
      </div>
    )
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ fontWeight: '700', color: 'var(--sand-900)', margin: '10px 0 4px', fontSize: '14px' }}>{line.slice(2, -2)}</p>
    if (line === '') return <div key={i} style={{ height: '6px' }} />
    return <p key={i} style={{ fontSize: '14px', lineHeight: '1.6', margin: '2px 0', color: 'var(--sand-800)' }}>{line}</p>
  })
}

export default function Retirement() {
  const navigate = useNavigate()
  const { userId, profileData: profile, updateProfile, loading: profileLoading } = useProfile()
  const [plan, setPlan] = useState<RetirementPlan | null>(profile?.retirement_plan || null)
  const [built, setBuilt] = useState(!!profile?.retirement_plan)
  const [building, setBuilding] = useState(false)
  const [currentAge, setCurrentAge] = useState(profile?.retirement_plan?.currentAge || profile?.age || 23)
  const [targetAge, setTargetAge] = useState(profile?.retirement_plan?.targetAge || 52)
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'projections' | 'strategy' | 'chat'>('overview')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (profile?.retirement_plan) {
      setPlan(profile.retirement_plan)
      setBuilt(true)
      setCurrentAge(profile.retirement_plan.currentAge || profile.age || 23)
      setTargetAge(profile.retirement_plan.targetAge || 52)
    } else if (profile?.age) {
      setCurrentAge(profile.age)
    }
  }, [profile?.retirement_plan, profile?.age])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const buildPlan = async () => {
    if (!userId) return
    setBuilding(true)

    const retirementAssets = profile?.assets?.filter((a: any) => ['retirement', 'investment'].includes(a.category))
      .reduce((s: number, a: any) => s + (a.value || 0), 0) || 0
    const availableToSave = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)
    const yearsToRetirement = targetAge - currentAge
    const targetNestEgg = availableToSave * 12 * 25
    const monthlyContribution = Math.min(availableToSave, availableToSave * 0.7)

    // Project at 7% average return
    const projectedNestEgg = retirementAssets * Math.pow(1.07, yearsToRetirement) +
      monthlyContribution * 12 * ((Math.pow(1.07, yearsToRetirement) - 1) / 0.07)

    const newPlan: RetirementPlan = {
      currentAge,
      targetAge,
      currentSavings: retirementAssets,
      monthlyContribution,
      targetNestEgg,
      projectedNestEgg,
      onTrack: projectedNestEgg >= targetNestEgg,
      yearsToRetirement,
      monthlyInRetirement: targetNestEgg / (30 * 12),
      shortfall: Math.max(0, targetNestEgg - projectedNestEgg)
    }

    setPlan(newPlan)
    setBuilt(true)

    // Save to profile
    const updatedProfile = { ...(profile || {}), retirement_plan: newPlan }
    await updateProfile({ profile_data: updatedProfile })

    // Get AI strategy
    const initialMsg: Message = {
      role: 'user',
      content: `Build me a comprehensive retirement plan. I'm ${currentAge} years old, want to retire at ${targetAge}.
I have $${retirementAssets.toLocaleString()} saved for retirement already.
Monthly income: $${profile?.monthly_income || 0}, expenses: $${profile?.monthly_expenses || 0}, available to save: $${availableToSave}/month.
Assets: ${profile?.assets?.map((a: any) => `${a.name}: $${a.value}`).join(', ') || 'none listed'}.
Projected nest egg at retirement: $${Math.round(projectedNestEgg).toLocaleString()}.
Give me a clear, specific retirement strategy with exact numbers and steps.`
    }

    setChatMessages([initialMsg])
    setChatLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [initialMsg], profile: profile || {}, topic: 'retirement' })
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message || '' }])
    } catch { }

    setChatLoading(false)
    setBuilding(false)
    setActiveTab('overview')
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: Message = { role: 'user', content: chatInput.trim() }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, profile, topic: 'retirement' })
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message || '' }])
    } catch { }

    setChatLoading(false)
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  // Chart data
  const buildChartData = () => {
    if (!plan) return null
    const years = Array.from({ length: plan.yearsToRetirement + 1 }, (_, i) => i)
    const labels = years.map(y => `Age ${plan.currentAge + y}`)

    const conservative = years.map(y => Math.round(
      plan.currentSavings * Math.pow(1.04, y) +
      plan.monthlyContribution * 12 * ((Math.pow(1.04, y) - 1) / 0.04)
    ))
    const moderate = years.map(y => Math.round(
      plan.currentSavings * Math.pow(1.07, y) +
      plan.monthlyContribution * 12 * ((Math.pow(1.07, y) - 1) / 0.07)
    ))
    const aggressive = years.map(y => Math.round(
      plan.currentSavings * Math.pow(1.10, y) +
      plan.monthlyContribution * 12 * ((Math.pow(1.10, y) - 1) / 0.10)
    ))

    return { labels, conservative, moderate, aggressive }
  }

  const chartData = plan ? buildChartData() : null

  const lineChartData = chartData && plan ? {
    labels: chartData.labels,
    datasets: [
      {
        // Upper bound (aggressive) - fills down to conservative to create the band
        label: 'High (10%)',
        data: chartData.aggressive,
        borderColor: 'rgba(122,158,110,0.25)',
        backgroundColor: 'rgba(122,158,110,0.08)',
        fill: '+1', // fill to the next dataset (conservative) to create the band
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1,
      },
      {
        // Lower bound (conservative)
        label: 'Low (4%)',
        data: chartData.conservative,
        borderColor: 'rgba(192,57,43,0.25)',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1,
      },
      {
        // Main projection (moderate)
        label: 'Expected (7%)',
        data: chartData.moderate,
        borderColor: 'var(--accent)',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2.5,
      },
      {
        // Target nest egg horizontal line
        label: `Target: ${fmt(plan.targetNestEgg)}`,
        data: Array(chartData.labels.length).fill(plan.targetNestEgg),
        borderColor: 'rgba(192,57,43,0.5)',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0,
        pointRadius: 0,
        borderWidth: 1.5,
        borderDash: [5, 4],
      }
    ]
  } : null

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { labels: { color: '#9e8e7e', font: { size: 11 }, usePointStyle: true, padding: 16 } },
      tooltip: {
        backgroundColor: '#f2ede6',
        borderColor: '#ddd4c4',
        borderWidth: 1,
        titleColor: '#1a1208',
        bodyColor: '#7a6a5a',
        padding: 10,
        callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` }
      }
    },
    scales: {
      x: { ticks: { color: '#9e8e7e', maxTicksLimit: 6, font: { size: 10 } }, grid: { color: '#ede8e3' } },
      y: { ticks: { color: '#9e8e7e', font: { size: 10 }, callback: (v: any) => `$${(v/1000000).toFixed(1)}M` }, grid: { color: '#ede8e3' } }
    }
  }

  if (profileLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sand-100)' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand-100)' }}>

      {/* Header */}
      <div style={{ background: 'var(--sand-50)', borderBottom: '0.5px solid var(--sand-300)', padding: '52px 20px 0' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <button onClick={() => navigate(-1)}
              style={{ background: 'var(--sand-200)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-700)', fontSize: '16px', flexShrink: 0 }}>
              ←
            </button>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>Retirement Plan</h1>
              {plan && <p style={{ fontSize: '12px', color: plan.onTrack ? 'var(--success)' : 'var(--warning)', margin: 0 }}>{plan.onTrack ? 'On track ✓' : 'Needs attention'}</p>}
            </div>
          </div>

          {/* Tabs */}
          {built && (
            <div style={{ display: 'flex', gap: '0', borderBottom: 'none' }}>
              {(['overview', 'projections', 'strategy', 'chat'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === tab ? `2px solid var(--accent)` : '2px solid transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--sand-500)', fontSize: '13px', fontWeight: activeTab === tab ? '600' : '400', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', textTransform: 'capitalize' }}>
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '20px' }}>

        {/* Build Plan Form */}
        {!built && (
          <div className="animate-fade">
            <div style={{ textAlign: 'center', padding: '20px 0 32px' }}>
              <div style={{ width: '60px', height: '60px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <span style={{ fontSize: '24px' }}>🏖️</span>
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: '400', color: 'var(--sand-900)', margin: '0 0 8px', letterSpacing: '-0.3px' }}>Build your retirement plan</h2>
              <p style={{ fontSize: '14px', color: 'var(--sand-500)', margin: 0, lineHeight: '1.5' }}>We'll use your financial profile to create a personalized retirement roadmap with projections and AI strategy.</p>
            </div>

            <div className="card" style={{ marginBottom: '16px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', marginBottom: '8px' }}>Current age</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="range" min="18" max="70" value={currentAge} onChange={e => setCurrentAge(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: '20px', fontWeight: '300', color: 'var(--sand-900)', minWidth: '40px', textAlign: 'right' }}>{currentAge}</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', marginBottom: '8px' }}>Target retirement age</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="range" min={currentAge + 5} max="80" value={targetAge} onChange={e => setTargetAge(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: '20px', fontWeight: '300', color: 'var(--sand-900)', minWidth: '40px', textAlign: 'right' }}>{targetAge}</span>
                </div>
              </div>
            </div>

            <div className="card-muted" style={{ marginBottom: '20px', padding: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--sand-700)', margin: '0 0 4px', fontWeight: '500' }}>Your plan will include:</p>
              {['Personalized nest egg target', 'Projection chart (3 scenarios)', 'Monthly contribution strategy', 'AI retirement advisor'].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                  <div style={{ width: '16px', height: '16px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>✓</span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--sand-700)' }}>{item}</span>
                </div>
              ))}
            </div>

            <button className="btn-primary" onClick={buildPlan} disabled={building}
              style={{ width: '100%', padding: '16px', fontSize: '15px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {building ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Building your plan...
                </>
              ) : 'Build my retirement plan →'}
            </button>
          </div>
        )}

        {/* Overview Tab */}
        {built && plan && activeTab === 'overview' && (
          <div className="animate-fade">

            {/* Hero numbers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div className="card" style={{ gridColumn: '1 / -1', padding: '20px' }}>
                <p className="label" style={{ marginBottom: '4px' }}>Projected at retirement ({plan.targetAge})</p>
                <p style={{ fontSize: '40px', fontWeight: '300', color: plan.onTrack ? 'var(--success)' : 'var(--warning)', margin: '0 0 4px', letterSpacing: '-1.5px' }}>{fmt(plan.projectedNestEgg ?? 0)}</p>
                <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: 0 }}>at 7% avg annual return · {plan.yearsToRetirement} years away</p>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <p className="label" style={{ marginBottom: '4px' }}>Target</p>
                <p style={{ fontSize: '22px', fontWeight: '400', color: 'var(--sand-900)', margin: '0 0 2px', letterSpacing: '-0.5px' }}>{fmt(plan.targetNestEgg ?? 0)}</p>
                <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>25× annual spend</p>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <p className="label" style={{ marginBottom: '4px' }}>{plan.onTrack ? 'Surplus' : 'Shortfall'}</p>
                <p style={{ fontSize: '22px', fontWeight: '400', color: plan.onTrack ? 'var(--success)' : 'var(--danger)', margin: '0 0 2px', letterSpacing: '-0.5px' }}>
                  {plan.onTrack ? '+' : '-'}{fmt(Math.abs((plan.projectedNestEgg ?? 0) - (plan.targetNestEgg ?? 0)))}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{plan.onTrack ? 'ahead of target' : 'behind target'}</p>
              </div>
            </div>

            {/* Key stats */}
            <div className="card" style={{ marginBottom: '16px' }}>
              <p className="label" style={{ marginBottom: '12px' }}>Key numbers</p>
              {[
                { label: 'Current retirement savings', value: fmt(plan.currentSavings ?? 0) },
                { label: 'Monthly contribution', value: fmt(plan.monthlyContribution ?? 0) },
                { label: 'Years to retirement', value: `${plan.yearsToRetirement ?? 0} years` },
                { label: 'Monthly income in retirement', value: `${fmt(plan.monthlyInRetirement ?? 0)}/mo` },
              ].map((item, i, arr) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
                  <span style={{ fontSize: '13px', color: 'var(--sand-600)' }}>{item.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sand-900)' }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Yearly Contributions per retirement account */}
            {profile?.assets?.some((a: any) => a.category === 'retirement' && a.yearlyContributions?.length > 0) && (() => {
              const currentYear = new Date().getFullYear()
              const fmt$ = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
              const retirementAssets = profile.assets.filter((a: any) => a.category === 'retirement' && a.yearlyContributions?.length > 0)
              const allStatuses = getContributionStatus(profile.assets, profile.age)
              const allMaxed = allStatuses.length > 0 && allStatuses.every(s => s.maxed)
              return (
                <div className="card" style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p className="label" style={{ margin: 0 }}>Yearly contributions</p>
                    {allMaxed && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)', background: 'rgba(122,158,110,0.12)', border: '0.5px solid var(--success)', borderRadius: '20px', padding: '3px 10px', letterSpacing: '0.02em' }}>
                        All accounts maxed ✓
                      </span>
                    )}
                  </div>
                  {retirementAssets.map((a: any, ai: number) => {
                    const sorted = [...a.yearlyContributions].sort((x: any, y: any) => y.year - x.year)
                    const total = sorted.reduce((s: number, c: any) => s + (c.amount || 0), 0)
                    const thisYear = sorted.find((c: any) => c.year === currentYear)
                    const det = detectAccountLimit(a.name, profile.age)
                    const limit = det?.limit ?? null
                    const accountType = det?.accountType ?? null
                    const contributed = thisYear?.amount || 0
                    const pct = limit && thisYear ? Math.min(100, Math.round((contributed / limit) * 100)) : 0
                    const maxed = !!limit && contributed >= limit
                    const remaining = limit ? Math.max(0, limit - contributed) : null
                    return (
                      <div key={ai} style={{ marginBottom: ai < retirementAssets.length - 1 ? '20px' : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-800)', margin: '0 0 1px' }}>{a.name}</p>
                            {accountType && <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: 0 }}>{accountType}</p>}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            {maxed ? (
                              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)' }}>Maxed ✓</span>
                            ) : limit && thisYear ? (
                              <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>{fmt$(remaining!)} left</span>
                            ) : null}
                          </div>
                        </div>
                        {thisYear && limit && (
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>
                                {currentYear} — {fmt$(contributed)} of {fmt$(limit)} limit
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: maxed ? 'var(--success)' : 'var(--accent)' }}>{pct}%</span>
                            </div>
                            <div style={{ height: '5px', background: 'var(--sand-200)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: maxed ? 'var(--success)' : 'var(--accent)', borderRadius: '3px', transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {sorted.map((c: any, ci: number) => (
                            <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: ci < sorted.length - 1 ? '0.5px solid var(--sand-200)' : 'none' }}>
                              <span style={{ fontSize: '12px', color: 'var(--sand-600)' }}>{c.year}</span>
                              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-900)' }}>{fmt$(c.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {!limit && thisYear && (
                          <p style={{ fontSize: '11px', color: 'var(--sand-400)', marginTop: '6px' }}>
                            Add account type to name (e.g. "401k", "Roth IRA") to see limit progress
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Account limits */}
            {(() => {
              const statuses = getContributionStatus(profile?.assets || [], profile?.age)
              const maxedAccounts = statuses.filter(s => s.maxed).map(s => s.account)
              const catchUp = profile?.age >= 50
              const limits = [
                { label: 'Roth / Traditional IRA', limit: catchUp ? '$8,000/yr' : '$7,000/yr', monthly: catchUp ? '$667/mo' : '$583/mo', keywords: ['roth', 'ira', 'traditional'] },
                { label: '401(k) / 403(b) / 457(b)', limit: catchUp ? '$31,000/yr' : '$23,500/yr', monthly: catchUp ? '$2,583/mo' : '$1,958/mo', keywords: ['401', '403', '457'] },
                { label: 'HSA (individual)', limit: '$4,300/yr', monthly: '$358/mo', keywords: ['hsa'] },
                { label: 'SIMPLE IRA', limit: catchUp ? '$20,000/yr' : '$16,500/yr', monthly: catchUp ? '$1,667/mo' : '$1,375/mo', keywords: ['simple'] },
                { label: 'SEP-IRA', limit: '$70,000/yr', monthly: 'varies', keywords: ['sep'] },
              ]
              const accountNames = (profile?.assets || []).filter((a: any) => a.category === 'retirement').map((a: any) => a.name.toLowerCase())
              const hasAccount = (keywords: string[]) => accountNames.some((n: string) => keywords.some(k => n.includes(k)))
              return (
                <div className="card-muted" style={{ marginBottom: '16px' }}>
                  <p className="label" style={{ marginBottom: '10px' }}>2025 contribution limits{catchUp ? ' (catch-up eligible)' : ''}</p>
                  {limits.map((item, i) => {
                    const owned = hasAccount(item.keywords)
                    const maxed = owned && statuses.filter(s => item.keywords.some(k => s.account.toLowerCase().includes(k))).every(s => s.maxed) && statuses.some(s => item.keywords.some(k => s.account.toLowerCase().includes(k)))
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < limits.length - 1 ? '0.5px solid var(--sand-300)' : 'none', opacity: owned ? 1 : 0.55 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-800)' }}>{item.label}</span>
                          {maxed && <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--success)' }}>✓</span>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: maxed ? 'var(--success)' : 'var(--sand-900)' }}>{item.limit}</span>
                          <span style={{ fontSize: '11px', color: 'var(--sand-500)', marginLeft: '6px' }}>{item.monthly}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            <button onClick={() => setActiveTab('projections')} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '14px', borderRadius: 'var(--radius-md)' }}>
              View projections →
            </button>
          </div>
        )}

        {/* Projections Tab */}
        {built && plan && activeTab === 'projections' && (
          <div className="animate-fade">
            <div className="card" style={{ marginBottom: '16px' }}>
              <p className="label" style={{ marginBottom: '4px' }}>Growth projection</p>
              <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: '0 0 16px' }}>Three scenarios based on avg annual return</p>
              <div style={{ height: '280px' }}>
                {lineChartData && <Line data={lineChartData} options={chartOptions} />}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              {chartData && [
                { label: 'Conservative', value: chartData.conservative[chartData.conservative.length - 1], rate: '4%', color: 'rgba(192,57,43,0.7)', note: 'floor' },
                { label: 'Expected', value: chartData.moderate[chartData.moderate.length - 1], rate: '7%', color: 'var(--accent)', note: 'most likely' },
                { label: 'Optimistic', value: chartData.aggressive[chartData.aggressive.length - 1], rate: '10%', color: 'var(--success)', note: 'ceiling' },
              ].map((item, i) => (
                <div key={i} className="card" style={{ padding: '14px', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: item.color, fontWeight: '700', margin: '0 0 4px', letterSpacing: '0.05em' }}>{item.rate}</p>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 2px' }}>{fmt(item.value)}</p>
                  <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: 0 }}>{item.note}</p>
                </div>
              ))}
            </div>

            {plan && (
              <div style={{ marginBottom: '16px', padding: '12px 14px', background: plan.onTrack ? 'rgba(122,158,110,0.08)' : 'rgba(192,57,43,0.05)', borderRadius: 'var(--radius-sm)', border: `0.5px solid ${plan.onTrack ? 'rgba(122,158,110,0.2)' : 'rgba(192,57,43,0.15)'}` }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: plan.onTrack ? 'var(--success)' : 'var(--danger)', margin: '0 0 2px' }}>
                  {plan.onTrack ? `On track — projected to exceed your target by ${fmt((plan.projectedNestEgg ?? 0) - (plan.targetNestEgg ?? 0))}` : `Shortfall of ${fmt(plan.shortfall ?? 0)} at expected 7% return`}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0 }}>Target: {fmt(plan.targetNestEgg ?? 0)} (25× annual spend). The shaded band shows your range of outcomes.</p>
              </div>
            )}

            <div className="card-muted" style={{ padding: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--sand-700)', margin: '0 0 6px', fontWeight: '500' }}>Contributing {fmt(plan.monthlyContribution ?? 0)}/mo starting now</p>
              <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0, lineHeight: '1.5' }}>The shaded range shows your 4%–10% return scenarios. The dashed red line is your target nest egg. The solid line is the expected 7% projection, matching historical S&P 500 averages.</p>
            </div>
          </div>
        )}

        {/* Strategy Tab */}
        {built && activeTab === 'strategy' && (
          <div className="animate-fade">
            {chatMessages.length > 1 ? (
              <div className="card">
                <p className="label" style={{ marginBottom: '12px' }}>Your retirement strategy</p>
                <div>{formatMessage(chatMessages[1].content)}</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ width: '32px', height: '32px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                <p style={{ color: 'var(--sand-500)', marginTop: '16px', fontSize: '14px' }}>Building your strategy...</p>
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {built && activeTab === 'chat' && (
          <div className="animate-fade">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px', maxHeight: '60vh', overflowY: 'auto', paddingBottom: '8px' }}>
              {chatMessages.slice(1).map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
                    </div>
                  )}
                  <div style={{ maxWidth: '80%', background: msg.role === 'user' ? 'var(--accent)' : 'var(--sand-50)', border: msg.role === 'user' ? 'none' : '0.5px solid var(--sand-300)', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '12px 16px' }}>
                    {msg.role === 'user'
                      ? <p style={{ fontSize: '14px', margin: 0, color: 'var(--sand-50)', lineHeight: '1.5' }}>{msg.content}</p>
                      : <div>{formatMessage(msg.content)}</div>
                    }
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
                  </div>
                  <div style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: '18px 18px 18px 4px', padding: '14px 16px', display: 'flex', gap: '5px' }}>
                    {[0,150,300].map(d => <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask about your retirement..."
                style={{ flex: 1, borderRadius: '20px' }}
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                style={{ width: '42px', height: '42px', borderRadius: '50%', background: chatInput.trim() ? 'var(--accent)' : 'var(--sand-300)', border: 'none', cursor: chatInput.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={chatInput.trim() ? 'var(--sand-50)' : 'var(--sand-500)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </div>

            {chatMessages.length <= 1 && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['How can I retire earlier?', 'What should I invest in?', 'How much do I need to save each month?', 'What are the tax advantages I should use?'].map((q, i) => (
                  <button key={i} onClick={() => { setChatInput(q); }}
                    style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: 'var(--sand-700)', fontFamily: 'inherit' }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
