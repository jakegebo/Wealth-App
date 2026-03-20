import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../contexts/ProfileContext'

interface YearlyContribution {
  year: number
  amount: number
}

interface Position {
  symbol: string
  name?: string
  shares: number
  costBasis?: number  // per-share cost basis
}

interface IncomeSource {
  type: string
  description: string
  amount: number
  frequency: 'monthly' | 'annual'
}

interface Asset {
  name: string
  category: string
  value: number
  account_type?: string
  holdings?: string
  positions?: Position[]
  annual_contribution?: number
  contribution_pct?: number
  is_contributing?: boolean
  employer_match_pct?: number
  employer_match_cap?: number
  yearlyContributions?: YearlyContribution[]
  monthly_contribution?: number
  cost_basis?: number
  apy?: number
  account_subtype?: string
  purchase_price?: number
  mortgage_balance?: number
  monthly_rental?: number
  coins?: string
  ownership_percent?: number
}

interface Debt {
  name: string
  type: string
  balance: number
  interest_rate: number
  rate_type: 'fixed' | 'variable'
  minimum_payment: number
  monthly_payment: number
  remaining_term?: string
}

interface Goal {
  name: string
  category: string
  target_amount: number
  current_amount: number
  timeline: string
  priority: 'high' | 'medium' | 'low'
  monthly_contribution?: number
}

function HoldingsManager({
  positions,
  onChange,
  inputStyle,
  labelStyle,
  isCrypto = false,
}: {
  positions: Position[]
  onChange: (positions: Position[]) => void
  inputStyle: React.CSSProperties
  labelStyle: React.CSSProperties
  isCrypto?: boolean
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ symbol: string; name: string }[]>([])
  const [searching, setSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = (q: string) => {
    if (!q.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    fetch(`/api/stocks?search=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => { setResults(data.results || []); setSearching(false) })
      .catch(() => { setResults([]); setSearching(false) })
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(val), 400)
  }

  const addPosition = (symbol: string, name: string) => {
    if (!positions.some(p => p.symbol === symbol)) {
      onChange([...positions, { symbol, name, shares: 0 }])
    }
    setSearch('')
    setResults([])
  }

  const removePosition = (idx: number) => onChange(positions.filter((_, i) => i !== idx))

  const updatePosition = (idx: number, field: keyof Position, value: any) => {
    const updated = [...positions]
    updated[idx] = { ...updated[idx], [field]: value }
    onChange(updated)
  }

  const placeholder = isCrypto ? 'Search crypto (e.g. Bitcoin, Ethereum, Solana)...' : 'Search stocks, ETFs (e.g. AAPL, SPY, FXAIX)...'

  return (
    <div>
      <label style={labelStyle}>Holdings</label>
      <div style={{ position: 'relative', marginBottom: '8px' }}>
        <input
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder={placeholder}
          style={inputStyle}
          autoComplete="off"
        />
        {searching && (
          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--sand-400)' }}>searching…</span>
        )}
        {results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
            background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)',
            borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            maxHeight: '200px', overflowY: 'auto'
          }}>
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => addPosition(r.symbol, r.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 12px', background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  borderBottom: i < results.length - 1 ? '0.5px solid var(--sand-200)' : 'none'
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)', minWidth: '64px', flexShrink: 0 }}>{r.symbol}</span>
                <span style={{ fontSize: '12px', color: 'var(--sand-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {positions.length === 0 && (
        <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: 0, fontStyle: 'italic' }}>
          Search above and tap a result to add a holding
        </p>
      )}

      {positions.map((pos, idx) => (
        <div key={idx} style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto',
          gap: '6px', alignItems: 'center', marginBottom: '6px',
          padding: '8px 10px', background: 'var(--sand-200)', borderRadius: 'var(--radius-sm)'
        }}>
          <div style={{ minWidth: '64px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)', margin: 0 }}>{pos.symbol}</p>
            {pos.name && <p style={{ fontSize: '9px', color: 'var(--sand-400)', margin: 0, maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.name}</p>}
          </div>
          <div>
            <p style={{ fontSize: '9px', color: 'var(--sand-500)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
              {isCrypto ? 'Units' : 'Shares'}
            </p>
            <input
              type="number" placeholder="0" min="0" step="any"
              value={pos.shares || ''}
              onChange={e => updatePosition(idx, 'shares', parseFloat(e.target.value) || 0)}
              style={{ ...inputStyle, padding: '6px 8px', fontSize: '13px' }}
            />
          </div>
          <div>
            <p style={{ fontSize: '9px', color: 'var(--sand-500)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Cost/share (opt)</p>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--sand-400)' }}>$</span>
              <input
                type="number" placeholder="—" min="0" step="any"
                value={pos.costBasis || ''}
                onChange={e => updatePosition(idx, 'costBasis', parseFloat(e.target.value) || undefined)}
                style={{ ...inputStyle, padding: '6px 8px 6px 18px', fontSize: '13px' }}
              />
            </div>
          </div>
          <button
            onClick={() => removePosition(idx)}
            style={{ background: 'none', border: 'none', color: 'var(--sand-400)', cursor: 'pointer', fontSize: '18px', padding: '0 0 0 4px', lineHeight: 1 }}
          >×</button>
        </div>
      ))}
      <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: '4px 0 0', lineHeight: '1.4' }}>
        Enter shares owned. Cost/share is optional — used for gain/loss tracking.
      </p>
    </div>
  )
}

const RETIREMENT_ACCOUNT_TYPES = ['Roth IRA', 'Traditional IRA', '401(k)', 'Roth 401(k)', 'SEP-IRA', 'SIMPLE IRA', 'HSA', '403(b)', '457(b)', 'Pension', 'Other']
const SAVINGS_SUBTYPES = ['High-Yield Savings (HYSA)', 'Traditional Savings', 'Checking', 'Money Market', 'CD', 'Treasury Bills', 'Other']
const DEBT_TYPES = ['Mortgage', 'Student Loan – Federal', 'Student Loan – Private', 'Auto Loan', 'Credit Card', 'Personal Loan', 'HELOC', 'Medical Debt', 'Business Loan', 'Other']
const CONCERNS = [
  'Pay off debt faster',
  'Build emergency fund',
  'Save for retirement',
  'Buy a home',
  'Invest more',
  'Reduce taxes',
  'Start / grow a business',
  'Save for education',
  'Retire early (FIRE)',
  'Increase income',
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromSettings = searchParams.get('from') === 'settings'
  const { updateProfile } = useProfile()

  const [view, setView] = useState<'hub' | 'section'>(() => {
    return searchParams.get('step') !== null ? 'section' : 'hub'
  })
  const [step, setStep] = useState(() => {
    const s = parseInt(searchParams.get('step') || '0')
    return isNaN(s) ? 0 : Math.max(0, Math.min(s, 5))
  })
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [hasExistingProfile, setHasExistingProfile] = useState(false)

  // About You
  const [age, setAge] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [filingStatus, setFilingStatus] = useState('')
  const [userState, setUserState] = useState('')
  const [riskTolerance, setRiskTolerance] = useState('')
  const [lifeStage, setLifeStage] = useState('')

  // Income & Cash Flow
  const [grossIncome, setGrossIncome] = useState('')
  const [income, setIncome] = useState('')
  const [expenses, setExpenses] = useState('')
  const [monthlySavings, setMonthlySavings] = useState('')
  const [emergencyFundMonths, setEmergencyFundMonths] = useState('')
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])

  // Assets
  const [assets, setAssets] = useState<Asset[]>([{ name: '', category: 'savings', value: 0 }])

  // Debts
  const [debts, setDebts] = useState<Debt[]>([])

  // Goals
  const [goals, setGoals] = useState<Goal[]>([{ name: '', category: 'other', target_amount: 0, current_amount: 0, timeline: '5 years', priority: 'medium' }])

  // Context
  const [concerns, setConcerns] = useState<string[]>([])
  const [context, setContext] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        loadExisting(user.id)
      }
    })
  }, [])

  const loadExisting = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('profile_data').eq('user_id', uid).single()
    if (data?.profile_data) {
      setHasExistingProfile(true)
      const p = data.profile_data
      setAge(p.age?.toString() || '')
      setEmploymentType(p.employment_type || '')
      setFilingStatus(p.filing_status || '')
      setUserState(p.state || '')
      setRiskTolerance(p.risk_tolerance || '')
      setLifeStage(p.life_stage || '')
      setGrossIncome(p.annual_gross_income?.toString() || '')
      setIncome(p.monthly_income?.toString() || '')
      setExpenses(p.monthly_expenses?.toString() || '')
      setMonthlySavings(p.monthly_savings?.toString() || '')
      setEmergencyFundMonths(p.emergency_fund_months?.toString() || '')
      if (p.income_sources?.length) setIncomeSources(p.income_sources)
      setContext(p.additional_context || '')
      if (p.concerns?.length) setConcerns(p.concerns)
      if (p.assets?.length) setAssets(p.assets)
      if (p.debts?.length) setDebts(p.debts)
      if (p.goals?.length) setGoals(p.goals)
    }
  }

  // Income source helpers
  const addIncomeSource = () => setIncomeSources([...incomeSources, { type: 'other', description: '', amount: 0, frequency: 'monthly' }])
  const removeIncomeSource = (i: number) => setIncomeSources(incomeSources.filter((_, idx) => idx !== i))
  const updateIncomeSource = (i: number, field: keyof IncomeSource, value: any) => {
    const updated = [...incomeSources]
    updated[i] = { ...updated[i], [field]: value }
    setIncomeSources(updated)
  }

  // Asset helpers
  const addAsset = () => setAssets([...assets, { name: '', category: 'savings', value: 0 }])
  const removeAsset = (i: number) => setAssets(assets.filter((_, idx) => idx !== i))
  const updateAsset = (i: number, field: keyof Asset, value: any) => {
    const updated = [...assets]
    updated[i] = { ...updated[i], [field]: value }
    setAssets(updated)
  }

  const addYearlyContribution = (assetIdx: number) => {
    const updated = [...assets]
    const currentYear = new Date().getFullYear()
    const existing = updated[assetIdx].yearlyContributions || []
    const nextYear = existing.length > 0 ? Math.max(...existing.map(c => c.year)) - 1 : currentYear
    updated[assetIdx] = { ...updated[assetIdx], yearlyContributions: [{ year: nextYear, amount: 0 }, ...existing] }
    setAssets(updated)
  }
  const removeYearlyContribution = (assetIdx: number, contribIdx: number) => {
    const updated = [...assets]
    const existing = updated[assetIdx].yearlyContributions || []
    updated[assetIdx] = { ...updated[assetIdx], yearlyContributions: existing.filter((_, i) => i !== contribIdx) }
    setAssets(updated)
  }
  const updateYearlyContribution = (assetIdx: number, contribIdx: number, field: keyof YearlyContribution, value: any) => {
    const updated = [...assets]
    const existing = [...(updated[assetIdx].yearlyContributions || [])]
    existing[contribIdx] = { ...existing[contribIdx], [field]: value }
    updated[assetIdx] = { ...updated[assetIdx], yearlyContributions: existing }
    setAssets(updated)
  }

  // Debt helpers
  const addDebt = () => setDebts([...debts, { name: '', type: 'Other', balance: 0, interest_rate: 0, rate_type: 'fixed', minimum_payment: 0, monthly_payment: 0 }])
  const removeDebt = (i: number) => setDebts(debts.filter((_, idx) => idx !== i))
  const updateDebt = (i: number, field: keyof Debt, value: any) => {
    const updated = [...debts]
    updated[i] = { ...updated[i], [field]: value }
    setDebts(updated)
  }

  // Goal helpers
  const addGoal = () => setGoals([...goals, { name: '', category: 'other', target_amount: 0, current_amount: 0, timeline: '5 years', priority: 'medium' }])
  const removeGoal = (i: number) => setGoals(goals.filter((_, idx) => idx !== i))
  const updateGoal = (i: number, field: keyof Goal, value: any) => {
    const updated = [...goals]
    updated[i] = { ...updated[i], [field]: value }
    setGoals(updated)
  }

  const toggleConcern = (c: string) => setConcerns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])

  const buildProfileData = () => ({
    age: parseInt(age) || null,
    employment_type: employmentType,
    filing_status: filingStatus,
    state: userState,
    risk_tolerance: riskTolerance,
    life_stage: lifeStage,
    annual_gross_income: parseFloat(grossIncome) || null,
    monthly_income: parseFloat(income) || 0,
    monthly_expenses: parseFloat(expenses) || 0,
    monthly_savings: parseFloat(monthlySavings) || null,
    emergency_fund_months: parseFloat(emergencyFundMonths) || null,
    income_sources: incomeSources.filter(s => s.amount > 0),
    additional_context: context,
    concerns,
    assets: assets.filter(a => a.name && a.value),
    debts: debts.filter(d => d.name && d.balance),
    goals: goals.filter(g => g.name && g.target_amount),
  })

  const saveSnapshot = async (profileData: any) => {
    if (!userId) return
    const totalAssets = (profileData.assets || []).reduce((s: number, a: any) => s + (a.value || 0), 0)
    const totalLiabilities = (profileData.debts || []).reduce((s: number, d: any) => s + (d.balance || 0), 0)
    const netWorth = totalAssets - totalLiabilities
    const snapshot = {
      assets: (profileData.assets || []).map((a: any) => ({ name: a.name, category: a.category, value: a.value || 0 })),
      debts: (profileData.debts || []).map((d: any) => ({ name: d.name, type: d.type, balance: d.balance || 0 })),
      goals: (profileData.goals || []).map((g: any) => ({ name: g.name, current_amount: g.current_amount || 0, target_amount: g.target_amount || 0 })),
      monthly_income: profileData.monthly_income || 0,
      monthly_expenses: profileData.monthly_expenses || 0,
    }
    try {
      await fetch('/api/networth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, netWorth, totalAssets, totalLiabilities, snapshot }),
      })
    } catch { }
  }

  const persistProfile = async (forceSnapshot = false) => {
    if (!userId) return
    setSaving(true)
    const profileData = buildProfileData()
    const { data: existing } = await supabase.from('profiles').select('id').eq('user_id', userId).single()
    if (existing) {
      await supabase.from('profiles').update({ profile_data: profileData, analysis: null, updated_at: new Date().toISOString() }).eq('user_id', userId)
    } else {
      await supabase.from('profiles').insert({ user_id: userId, profile_data: profileData })
    }
    await updateProfile({ profile_data: profileData, analysis: null })
    // Snapshot if: finishing onboarding (forceSnapshot=true), OR editing an already-complete profile
    // Never snapshot on intermediate section saves during initial setup — that creates fake "all time" deltas
    if (forceSnapshot || hasExistingProfile) await saveSnapshot(profileData)
    setSaving(false)
  }

  const handleSaveSection = async () => {
    await persistProfile(false)
    setView('hub')
  }

  const handleFinish = async () => {
    await persistProfile(true)
    navigate('/dashboard')
  }

  const sections = [
    { title: 'About you', subtitle: 'Employment, taxes & risk tolerance', complete: !!(age || employmentType || riskTolerance) },
    { title: 'Income & cash flow', subtitle: 'Earnings, expenses & savings rate', complete: !!(income || grossIncome) },
    { title: 'Assets', subtitle: 'What you own', complete: assets.some(a => a.name && a.value) },
    { title: 'Debts', subtitle: 'What you owe', complete: debts.length > 0 },
    { title: 'Goals', subtitle: "What you're working toward", complete: goals.some(g => g.name && g.target_amount) },
    { title: 'Context', subtitle: 'Concerns & anything else', complete: context.length > 0 || concerns.length > 0 },
  ]

  const inputStyle = {
    background: 'var(--sand-200)',
    border: '0.5px solid var(--sand-300)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--sand-900)',
    padding: '10px 14px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  } as React.CSSProperties

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
  } as React.CSSProperties

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--sand-500)',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }

  const dividerStyle = { height: '0.5px', background: 'var(--sand-300)' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand-100)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: 'var(--sand-50)', borderBottom: '0.5px solid var(--sand-300)', padding: '20px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--sand-50)', fontWeight: '700', fontSize: '12px' }}>W</span>
              </div>
              <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--sand-900)' }}>WealthApp</span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {view === 'section' && (
                <button onClick={() => setView('hub')} className="btn-ghost" style={{ fontSize: '13px' }}>← Back</button>
              )}
              {fromSettings && view === 'hub' && (
                <button onClick={() => navigate('/dashboard')} className="btn-ghost" style={{ fontSize: '13px' }}>Cancel</button>
              )}
            </div>
          </div>
          {view === 'section' && (
            <div style={{ marginTop: '14px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 2px' }}>{sections[step].title}</h2>
              <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: 0 }}>{sections[step].subtitle}</p>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>

          {/* Hub */}
          {view === 'hub' && (
            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!hasExistingProfile && (
                <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 8px', lineHeight: '1.5' }}>
                  The more detail you provide, the better your AI advisor can tailor recommendations to your situation.
                </p>
              )}
              {sections.map((section, i) => (
                <button
                  key={i}
                  onClick={() => { setStep(i); setView('section') }}
                  style={{
                    background: 'var(--sand-50)',
                    border: '0.5px solid var(--sand-300)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: section.complete ? 'var(--success)' : 'var(--sand-300)' }} />
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 1px' }}>{section.title}</p>
                      <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>{section.subtitle}</p>
                    </div>
                  </div>
                  <span style={{ color: 'var(--sand-400)', flexShrink: 0, fontSize: '16px' }}>→</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 0: About You */}
          {view === 'section' && step === 0 && (
            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Age</label>
                  <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="32" min="16" max="100" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input value={userState} onChange={e => setUserState(e.target.value)} placeholder="e.g. California" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Employment type</label>
                <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} style={selectStyle}>
                  <option value="">Select...</option>
                  <option value="employed_full_time">Employed – Full time</option>
                  <option value="employed_part_time">Employed – Part time</option>
                  <option value="self_employed">Self-employed / Freelancer</option>
                  <option value="business_owner">Business owner</option>
                  <option value="student">Student</option>
                  <option value="retired">Retired</option>
                  <option value="unemployed">Unemployed / Between jobs</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Tax filing status</label>
                <select value={filingStatus} onChange={e => setFilingStatus(e.target.value)} style={selectStyle}>
                  <option value="">Select...</option>
                  <option value="single">Single</option>
                  <option value="married_jointly">Married filing jointly</option>
                  <option value="married_separately">Married filing separately</option>
                  <option value="head_of_household">Head of household</option>
                </select>
                <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '5px 0 0', lineHeight: '1.4' }}>Used to calculate tax brackets and contribution limits.</p>
              </div>

              <div>
                <label style={labelStyle}>Life stage</label>
                <select value={lifeStage} onChange={e => setLifeStage(e.target.value)} style={selectStyle}>
                  <option value="">Select...</option>
                  <option value="single_no_kids">Single, no dependents</option>
                  <option value="single_with_kids">Single with kids</option>
                  <option value="partnered_no_kids">Partnered / married, no kids</option>
                  <option value="partnered_with_kids">Partnered / married with kids</option>
                  <option value="empty_nester">Empty nester</option>
                  <option value="near_retirement">Near retirement</option>
                  <option value="retired">Retired</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Risk tolerance</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {(['conservative', 'moderate', 'aggressive'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setRiskTolerance(r)}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: riskTolerance === r ? '1.5px solid var(--accent)' : '0.5px solid var(--sand-300)',
                        background: riskTolerance === r ? 'var(--sand-200)' : 'var(--sand-200)',
                        color: riskTolerance === r ? 'var(--accent)' : 'var(--sand-600)',
                        fontFamily: 'inherit',
                        fontSize: '13px',
                        fontWeight: riskTolerance === r ? '600' : '400',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >{r}</button>
                  ))}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '5px 0 0', lineHeight: '1.4' }}>
                  Conservative: preserve capital. Moderate: balanced growth. Aggressive: maximize long-term returns.
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Income & Cash Flow */}
          {view === 'section' && step === 1 && (
            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Annual gross income</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                    <input type="number" value={grossIncome} onChange={e => setGrossIncome(e.target.value)} placeholder="80,000" style={{ ...inputStyle, paddingLeft: '26px' }} />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '4px 0 0' }}>Before taxes</p>
                </div>
                <div>
                  <label style={labelStyle}>Monthly take-home</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                    <input type="number" value={income} onChange={e => setIncome(e.target.value)} placeholder="5,000" style={{ ...inputStyle, paddingLeft: '26px' }} />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '4px 0 0' }}>After tax</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Monthly expenses</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                    <input type="number" value={expenses} onChange={e => setExpenses(e.target.value)} placeholder="3,500" style={{ ...inputStyle, paddingLeft: '26px' }} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Monthly amount saved / invested</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                    <input type="number" value={monthlySavings} onChange={e => setMonthlySavings(e.target.value)} placeholder="500" style={{ ...inputStyle, paddingLeft: '26px' }} />
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Emergency fund coverage</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    value={emergencyFundMonths}
                    onChange={e => setEmergencyFundMonths(e.target.value)}
                    placeholder="3"
                    min="0" max="36"
                    style={{ ...inputStyle, width: '90px' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--sand-600)' }}>months of expenses covered</span>
                </div>
              </div>

              {income && expenses && (
                <div className="card-muted animate-fade" style={{ padding: '14px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--sand-600)', margin: '0 0 4px' }}>Net monthly cash flow</p>
                  <p style={{ fontSize: '22px', fontWeight: '400', color: parseFloat(income) - parseFloat(expenses) > 0 ? 'var(--success)' : 'var(--danger)', margin: 0, letterSpacing: '-0.5px' }}>
                    ${Math.abs(parseFloat(income) - parseFloat(expenses)).toLocaleString()}/mo
                    <span style={{ fontSize: '13px', color: 'var(--sand-500)', marginLeft: '6px', fontWeight: '400', letterSpacing: 0 }}>
                      {parseFloat(income) - parseFloat(expenses) >= 0 ? 'surplus' : 'deficit'}
                    </span>
                  </p>
                </div>
              )}

              <div style={dividerStyle} />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-800)', margin: '0 0 2px' }}>Other income sources</p>
                    <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>Rental, side hustle, dividends, spouse income, etc.</p>
                  </div>
                  <button onClick={addIncomeSource} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}>+ Add</button>
                </div>
                {incomeSources.length === 0 && (
                  <p style={{ fontSize: '12px', color: 'var(--sand-400)', fontStyle: 'italic' }}>None added</p>
                )}
                {incomeSources.map((src, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--sand-200)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select value={src.type} onChange={e => updateIncomeSource(i, 'type', e.target.value)} style={{ ...selectStyle, background: 'var(--sand-50)', flex: 1 }}>
                        <option value="rental">Rental income</option>
                        <option value="freelance">Freelance / consulting</option>
                        <option value="side_hustle">Side hustle / gig</option>
                        <option value="dividends">Dividends / interest</option>
                        <option value="spouse">Spouse / partner income</option>
                        <option value="social_security">Social Security</option>
                        <option value="pension">Pension</option>
                        <option value="alimony">Alimony / child support</option>
                        <option value="other">Other</option>
                      </select>
                      <button onClick={() => removeIncomeSource(i)} style={{ background: 'none', border: 'none', color: 'var(--sand-400)', cursor: 'pointer', fontSize: '18px', padding: 0, flexShrink: 0 }}>×</button>
                    </div>
                    <input placeholder="Description (optional)" value={src.description} onChange={e => updateIncomeSource(i, 'description', e.target.value)} style={{ ...inputStyle, background: 'var(--sand-50)' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                        <input type="number" placeholder="Amount" value={src.amount || ''} onChange={e => updateIncomeSource(i, 'amount', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px', background: 'var(--sand-50)' }} />
                      </div>
                      <select value={src.frequency} onChange={e => updateIncomeSource(i, 'frequency', e.target.value as IncomeSource['frequency'])} style={{ ...selectStyle, background: 'var(--sand-50)', width: 'auto' }}>
                        <option value="monthly">/ mo</option>
                        <option value="annual">/ yr</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Assets */}
          {view === 'section' && step === 2 && (
            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {assets.map((asset, i) => (
                <div key={i} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', margin: 0 }}>
                      {asset.name || `Asset ${i + 1}`}
                    </p>
                    {assets.length > 1 && (
                      <button onClick={() => removeAsset(i)} style={{ background: 'none', border: 'none', color: 'var(--sand-400)', cursor: 'pointer', fontSize: '18px', padding: 0 }}>×</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    <div>
                      <label style={labelStyle}>Category</label>
                      <select value={asset.category} onChange={e => updateAsset(i, 'category', e.target.value)} style={selectStyle}>
                        <option value="retirement">Retirement account</option>
                        <option value="brokerage">Brokerage / taxable investment</option>
                        <option value="savings">Savings / cash</option>
                        <option value="real_estate">Real estate</option>
                        <option value="crypto">Crypto</option>
                        <option value="business">Business equity</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* Retirement */}
                    {asset.category === 'retirement' && (<>
                      <div>
                        <label style={labelStyle}>Account type</label>
                        <select value={asset.account_type || ''} onChange={e => updateAsset(i, 'account_type', e.target.value)} style={selectStyle}>
                          <option value="">Select type...</option>
                          {RETIREMENT_ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Account name / institution</label>
                        <input placeholder="e.g. Fidelity Roth IRA" value={asset.name} onChange={e => updateAsset(i, 'name', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Current balance</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                          <input type="number" placeholder="0" value={asset.value || ''} onChange={e => updateAsset(i, 'value', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                        </div>
                      </div>
                      <HoldingsManager
                        positions={asset.positions || []}
                        onChange={pos => updateAsset(i, 'positions', pos)}
                        inputStyle={inputStyle}
                        labelStyle={labelStyle}
                      />
                      {/* Contribution section */}
                      {(() => {
                        const is401k = /401\s*k|403\s*b|457\s*b/i.test(asset.account_type || asset.name)
                        const isIRA = /roth|traditional|ira/i.test(asset.account_type || asset.name)
                        const isSEP = /sep/i.test(asset.account_type || asset.name)
                        const isSIMPLE = /simple/i.test(asset.account_type || asset.name)
                        const isHSA = /hsa/i.test(asset.account_type || asset.name)
                        const ageNum = parseInt(age) || 0
                        const over50 = ageNum >= 50
                        let limitAmt = 0, limitLabel = ''
                        if (is401k) { limitAmt = over50 ? 31000 : 23500; limitLabel = over50 ? '401(k) catch-up limit' : '401(k) limit' }
                        else if (isIRA) { limitAmt = over50 ? 8000 : 7000; limitLabel = over50 ? 'IRA catch-up limit' : 'IRA limit' }
                        else if (isSEP) { limitAmt = 70000; limitLabel = 'SEP-IRA limit' }
                        else if (isSIMPLE) { limitAmt = over50 ? 20000 : 16500; limitLabel = over50 ? 'SIMPLE catch-up limit' : 'SIMPLE IRA limit' }
                        else if (isHSA) { limitAmt = 4300; limitLabel = 'HSA limit' }
                        const annualContrib = asset.annual_contribution || 0
                        const pctOfLimit = limitAmt > 0 ? Math.min(100, Math.round((annualContrib / limitAmt) * 100)) : 0
                        const isMaxed = limitAmt > 0 && annualContrib >= limitAmt
                        const remaining = limitAmt > 0 ? Math.max(0, limitAmt - annualContrib) : 0
                        const grossNum = parseFloat(grossIncome) || 0
                        const matchValue = grossNum && asset.employer_match_pct && asset.employer_match_cap
                          ? Math.round(grossNum * (asset.employer_match_cap / 100) * (asset.employer_match_pct / 100))
                          : 0
                        const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
                        return (
                          <>
                            {/* Currently contributing toggle */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={labelStyle}>Currently contributing?</label>
                              <button
                                onClick={() => updateAsset(i, 'is_contributing', !asset.is_contributing)}
                                style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: asset.is_contributing ? 'var(--accent)' : 'var(--sand-300)', flexShrink: 0 }}>
                                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', transition: 'left 0.2s', left: asset.is_contributing ? '23px' : '3px' }} />
                              </button>
                            </div>

                            {asset.is_contributing && (<>
                              {/* Contribution amount */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                  <label style={labelStyle}>% of salary</label>
                                  <div style={{ position: 'relative' }}>
                                    <input
                                      type="number" placeholder="6" min="0" max="100"
                                      value={asset.contribution_pct ?? ''}
                                      onChange={e => {
                                        const pct = e.target.value === '' ? undefined : parseFloat(e.target.value)
                                        const updated = [...assets]
                                        updated[i] = {
                                          ...updated[i],
                                          contribution_pct: pct,
                                          ...(grossNum && pct != null ? { annual_contribution: Math.round(grossNum * pct / 100) } : {}),
                                        }
                                        setAssets(updated)
                                      }}
                                      style={{ ...inputStyle, paddingRight: '28px' }} />
                                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '13px' }}>%</span>
                                  </div>
                                </div>
                                <div>
                                  <label style={labelStyle}>Annual $ amount</label>
                                  <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '13px' }}>$</span>
                                    <input
                                      type="number" placeholder="7,000"
                                      value={asset.annual_contribution || ''}
                                      onChange={e => updateAsset(i, 'annual_contribution', parseFloat(e.target.value) || 0)}
                                      style={{ ...inputStyle, paddingLeft: '22px' }} />
                                  </div>
                                </div>
                              </div>

                              {/* Maxed-out status bar */}
                              {limitAmt > 0 && annualContrib > 0 && (
                                <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: isMaxed ? 'rgba(122,158,110,0.1)' : 'var(--sand-200)', border: `0.5px solid ${isMaxed ? 'rgba(122,158,110,0.3)' : 'var(--sand-300)'}` }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: isMaxed ? 'var(--success)' : 'var(--sand-700)' }}>
                                      {isMaxed ? '✓ Maxed out!' : `${pctOfLimit}% of ${limitLabel}`}
                                    </span>
                                    <span style={{ fontSize: '11px', color: 'var(--sand-500)' }}>
                                      {fmt(annualContrib)} / {fmt(limitAmt)}
                                    </span>
                                  </div>
                                  <div style={{ height: '4px', background: 'var(--sand-300)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pctOfLimit}%`, background: isMaxed ? 'var(--success)' : 'var(--accent)', borderRadius: '2px', transition: 'width 0.3s' }} />
                                  </div>
                                  {!isMaxed && (
                                    <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: '4px 0 0' }}>
                                      {fmt(remaining)} more to reach the {new Date().getFullYear()} limit
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Employer match (only for employer-sponsored accounts) */}
                              {(is401k || isSIMPLE || /403|457/i.test(asset.account_type || '')) && (<>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  <div>
                                    <label style={labelStyle}>Employer match rate</label>
                                    <div style={{ position: 'relative' }}>
                                      <input
                                        type="number" placeholder="100" min="0" max="200"
                                        value={asset.employer_match_pct || ''}
                                        onChange={e => updateAsset(i, 'employer_match_pct', parseFloat(e.target.value) || 0)}
                                        style={{ ...inputStyle, paddingRight: '28px' }} />
                                      <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '13px' }}>%</span>
                                    </div>
                                    <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: '3px 0 0', lineHeight: '1.3' }}>100 = dollar-for-dollar, 50 = 50¢/dollar</p>
                                  </div>
                                  <div>
                                    <label style={labelStyle}>Match cap (% of salary)</label>
                                    <div style={{ position: 'relative' }}>
                                      <input
                                        type="number" placeholder="6" min="0" max="100"
                                        value={asset.employer_match_cap || ''}
                                        onChange={e => updateAsset(i, 'employer_match_cap', parseFloat(e.target.value) || 0)}
                                        style={{ ...inputStyle, paddingRight: '28px' }} />
                                      <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '13px' }}>%</span>
                                    </div>
                                    <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: '3px 0 0', lineHeight: '1.3' }}>max % of your salary employer matches on</p>
                                  </div>
                                </div>

                                {/* Computed match value */}
                                {matchValue > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(122,158,110,0.08)', border: '0.5px solid rgba(122,158,110,0.25)', borderRadius: 'var(--radius-sm)' }}>
                                    <span style={{ fontSize: '16px' }}>🎁</span>
                                    <div>
                                      <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--success)', margin: 0 }}>
                                        Employer adds {fmt(matchValue)}/yr
                                      </p>
                                      {asset.contribution_pct && asset.employer_match_cap && (
                                        <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '1px 0 0' }}>
                                          {asset.contribution_pct >= asset.employer_match_cap
                                            ? 'You\'re contributing enough to capture the full match ✓'
                                            : `Contribute at least ${asset.employer_match_cap}% to get the full match`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Warning: leaving match on table */}
                                {asset.contribution_pct && asset.employer_match_cap && asset.employer_match_pct &&
                                  asset.contribution_pct < asset.employer_match_cap && (
                                  <div style={{ padding: '7px 10px', background: 'rgba(200,148,58,0.08)', border: '0.5px solid rgba(200,148,58,0.3)', borderRadius: 'var(--radius-sm)' }}>
                                    <p style={{ fontSize: '11px', color: 'var(--warning)', margin: 0, fontWeight: '500' }}>
                                      ⚠ You're leaving {fmt(Math.round((parseFloat(grossIncome) || 0) * ((asset.employer_match_cap - asset.contribution_pct) / 100) * (asset.employer_match_pct / 100)))}/yr of free employer match unclaimed. Consider bumping to {asset.employer_match_cap}%.
                                    </p>
                                  </div>
                                )}
                              </>)}
                            </>)}
                          </>
                        )
                      })()}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ ...labelStyle, margin: 0 }}>Contribution history (optional)</label>
                          <button onClick={() => addYearlyContribution(i)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}>+ Add year</button>
                        </div>
                        {(!asset.yearlyContributions || asset.yearlyContributions.length === 0) ? (
                          <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: 0, fontStyle: 'italic' }}>Helps track how much you've contributed over time</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {asset.yearlyContributions.map((contrib, ci) => (
                              <div key={ci} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 28px', gap: '6px', alignItems: 'center' }}>
                                <input type="number" placeholder="Year" value={contrib.year || ''} onChange={e => updateYearlyContribution(i, ci, 'year', parseInt(e.target.value) || 0)} style={{ ...inputStyle, textAlign: 'center' }} />
                                <div style={{ position: 'relative' }}>
                                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '13px' }}>$</span>
                                  <input type="number" placeholder="Amount" value={contrib.amount || ''} onChange={e => updateYearlyContribution(i, ci, 'amount', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '24px' }} />
                                </div>
                                <button onClick={() => removeYearlyContribution(i, ci)} style={{ background: 'none', border: 'none', color: 'var(--sand-400)', cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1 }}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>)}

                    {/* Brokerage */}
                    {asset.category === 'brokerage' && (<>
                      <div>
                        <label style={labelStyle}>Account name / broker</label>
                        <input placeholder="e.g. Fidelity taxable, Schwab" value={asset.name} onChange={e => updateAsset(i, 'name', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Current value</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                          <input type="number" placeholder="0" value={asset.value || ''} onChange={e => updateAsset(i, 'value', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                        </div>
                      </div>
                      <HoldingsManager
                        positions={asset.positions || []}
                        onChange={pos => updateAsset(i, 'positions', pos)}
                        inputStyle={inputStyle}
                        labelStyle={labelStyle}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={labelStyle}>Cost basis</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                            <input type="number" placeholder="Optional" value={asset.cost_basis || ''} onChange={e => updateAsset(i, 'cost_basis', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                          </div>
                          <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '4px 0 0' }}>For tax-loss harvesting</p>
                        </div>
                        <div>
                          <label style={labelStyle}>Monthly contribution</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                            <input type="number" placeholder="0" value={asset.monthly_contribution || ''} onChange={e => updateAsset(i, 'monthly_contribution', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                          </div>
                        </div>
                      </div>
                    </>)}

                    {/* Savings */}
                    {asset.category === 'savings' && (<>
                      <div>
                        <label style={labelStyle}>Account type</label>
                        <select value={asset.account_subtype || ''} onChange={e => updateAsset(i, 'account_subtype', e.target.value)} style={selectStyle}>
                          <option value="">Select...</option>
                          {SAVINGS_SUBTYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Account name / bank</label>
                        <input placeholder="e.g. Marcus HYSA, Chase checking" value={asset.name} onChange={e => updateAsset(i, 'name', e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={labelStyle}>Balance</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                            <input type="number" placeholder="0" value={asset.value || ''} onChange={e => updateAsset(i, 'value', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>APY / interest rate</label>
                          <div style={{ position: 'relative' }}>
                            <input type="number" placeholder="4.5" step="0.01" value={asset.apy || ''} onChange={e => updateAsset(i, 'apy', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingRight: '26px' }} />
                            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>%</span>
                          </div>
                        </div>
                      </div>
                    </>)}

                    {/* Real Estate */}
                    {asset.category === 'real_estate' && (<>
                      <div>
                        <label style={labelStyle}>Property label</label>
                        <input placeholder="e.g. Primary home, Rental property" value={asset.name} onChange={e => updateAsset(i, 'name', e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={labelStyle}>Current market value</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                            <input type="number" placeholder="0" value={asset.value || ''} onChange={e => updateAsset(i, 'value', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Purchase price</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                            <input type="number" placeholder="0" value={asset.purchase_price || ''} onChange={e => updateAsset(i, 'purchase_price', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={labelStyle}>Remaining mortgage</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                            <input type="number" placeholder="0" value={asset.mortgage_balance || ''} onChange={e => updateAsset(i, 'mortgage_balance', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Monthly rental income</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                            <input type="number" placeholder="0 if primary" value={asset.monthly_rental || ''} onChange={e => updateAsset(i, 'monthly_rental', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                          </div>
                        </div>
                      </div>
                      {!!(asset.value && asset.mortgage_balance !== undefined) && (
                        <div style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                          <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Estimated equity</p>
                          <p style={{ fontSize: '18px', fontWeight: '500', color: 'var(--sand-900)', margin: 0 }}>
                            ${(asset.value - (asset.mortgage_balance || 0)).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </>)}

                    {/* Crypto */}
                    {asset.category === 'crypto' && (<>
                      <div>
                        <label style={labelStyle}>Portfolio / wallet label</label>
                        <input placeholder="e.g. Coinbase, hardware wallet" value={asset.name} onChange={e => updateAsset(i, 'name', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Current total value</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                          <input type="number" placeholder="0" value={asset.value || ''} onChange={e => updateAsset(i, 'value', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                        </div>
                      </div>
                      <HoldingsManager
                        positions={asset.positions || []}
                        onChange={pos => updateAsset(i, 'positions', pos)}
                        inputStyle={inputStyle}
                        labelStyle={labelStyle}
                        isCrypto={true}
                      />
                    </>)}

                    {/* Business */}
                    {asset.category === 'business' && (<>
                      <div>
                        <label style={labelStyle}>Business name</label>
                        <input placeholder="e.g. My LLC, startup equity" value={asset.name} onChange={e => updateAsset(i, 'name', e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={labelStyle}>Estimated value</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                            <input type="number" placeholder="0" value={asset.value || ''} onChange={e => updateAsset(i, 'value', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Your ownership %</label>
                          <div style={{ position: 'relative' }}>
                            <input type="number" placeholder="100" value={asset.ownership_percent || ''} onChange={e => updateAsset(i, 'ownership_percent', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingRight: '26px' }} />
                            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>%</span>
                          </div>
                        </div>
                      </div>
                    </>)}

                    {/* Other */}
                    {asset.category === 'other' && (<>
                      <div>
                        <label style={labelStyle}>Description</label>
                        <input placeholder="e.g. Vehicle, collectibles, jewelry" value={asset.name} onChange={e => updateAsset(i, 'name', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Estimated value</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                          <input type="number" placeholder="0" value={asset.value || ''} onChange={e => updateAsset(i, 'value', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                        </div>
                      </div>
                    </>)}

                  </div>
                </div>
              ))}
              <button onClick={addAsset} className="btn-ghost" style={{ width: '100%', padding: '12px', border: '1px dashed var(--sand-400)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--sand-600)' }}>
                + Add another asset
              </button>
            </div>
          )}

          {/* Step 3: Debts */}
          {view === 'section' && step === 3 && (
            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {debts.length === 0 && (
                <div className="card-muted" style={{ padding: '20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: 'var(--sand-600)', margin: '0 0 12px' }}>No debts? That's great!</p>
                  <button onClick={addDebt} className="btn-ghost" style={{ fontSize: '13px' }}>Add a debt anyway</button>
                </div>
              )}
              {debts.map((debt, i) => (
                <div key={i} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', margin: 0 }}>{debt.name || `Debt ${i + 1}`}</p>
                    <button onClick={() => removeDebt(i)} style={{ background: 'none', border: 'none', color: 'var(--sand-400)', cursor: 'pointer', fontSize: '18px', padding: 0 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select value={debt.type} onChange={e => updateDebt(i, 'type', e.target.value)} style={selectStyle}>
                        {DEBT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Name / lender</label>
                      <input placeholder="e.g. Navient, Chase Sapphire, Toyota Financial" value={debt.name} onChange={e => updateDebt(i, 'name', e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={labelStyle}>Current balance</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                          <input type="number" placeholder="0" value={debt.balance || ''} onChange={e => updateDebt(i, 'balance', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Interest rate</label>
                        <div style={{ position: 'relative' }}>
                          <input type="number" placeholder="6.5" step="0.01" value={debt.interest_rate || ''} onChange={e => updateDebt(i, 'interest_rate', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingRight: '26px' }} />
                          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>%</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={labelStyle}>Rate type</label>
                        <select value={debt.rate_type} onChange={e => updateDebt(i, 'rate_type', e.target.value as Debt['rate_type'])} style={selectStyle}>
                          <option value="fixed">Fixed</option>
                          <option value="variable">Variable</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Remaining term</label>
                        <input placeholder="e.g. 10 years, 36 mo" value={debt.remaining_term || ''} onChange={e => updateDebt(i, 'remaining_term', e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={labelStyle}>Minimum payment</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                          <input type="number" placeholder="0" value={debt.minimum_payment || ''} onChange={e => updateDebt(i, 'minimum_payment', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>What you actually pay / mo</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                          <input type="number" placeholder="0" value={debt.monthly_payment || ''} onChange={e => updateDebt(i, 'monthly_payment', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {debts.length > 0 && (
                <button onClick={addDebt} className="btn-ghost" style={{ width: '100%', padding: '12px', border: '1px dashed var(--sand-400)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--sand-600)' }}>
                  + Add another debt
                </button>
              )}
            </div>
          )}

          {/* Step 4: Goals */}
          {view === 'section' && step === 4 && (
            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {goals.map((goal, i) => (
                <div key={i} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', margin: 0 }}>{goal.name || `Goal ${i + 1}`}</p>
                    {goals.length > 1 && (
                      <button onClick={() => removeGoal(i)} style={{ background: 'none', border: 'none', color: 'var(--sand-400)', cursor: 'pointer', fontSize: '18px', padding: 0 }}>×</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={labelStyle}>Category</label>
                        <select value={goal.category} onChange={e => updateGoal(i, 'category', e.target.value)} style={selectStyle}>
                          <option value="retirement">Retirement</option>
                          <option value="home_purchase">Buy a home</option>
                          <option value="emergency_fund">Emergency fund</option>
                          <option value="education">Education</option>
                          <option value="vehicle">Vehicle</option>
                          <option value="vacation">Vacation / travel</option>
                          <option value="wedding">Wedding</option>
                          <option value="business">Start a business</option>
                          <option value="investment">Invest / wealth build</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Priority</label>
                        <select value={goal.priority} onChange={e => updateGoal(i, 'priority', e.target.value as Goal['priority'])} style={selectStyle}>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Goal name</label>
                      <input placeholder="e.g. Buy a house in Austin" value={goal.name} onChange={e => updateGoal(i, 'name', e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={labelStyle}>Target amount</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                          <input type="number" placeholder="0" value={goal.target_amount || ''} onChange={e => updateGoal(i, 'target_amount', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Saved so far</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                          <input type="number" placeholder="0" value={goal.current_amount || ''} onChange={e => updateGoal(i, 'current_amount', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={labelStyle}>Timeline</label>
                        <input placeholder="e.g. 3 years, by 2028" value={goal.timeline} onChange={e => updateGoal(i, 'timeline', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Monthly contribution</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                          <input type="number" placeholder="0" value={goal.monthly_contribution || ''} onChange={e => updateGoal(i, 'monthly_contribution', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '26px' }} />
                        </div>
                      </div>
                    </div>
                    {goal.target_amount > 0 && goal.current_amount >= 0 && (
                      <div style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Progress</p>
                          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-800)', margin: 0 }}>{Math.round((goal.current_amount / goal.target_amount) * 100)}%</p>
                        </div>
                        <div style={{ height: '4px', background: 'var(--sand-300)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, (goal.current_amount / goal.target_amount) * 100)}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={addGoal} className="btn-ghost" style={{ width: '100%', padding: '12px', border: '1px dashed var(--sand-400)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--sand-600)' }}>
                + Add another goal
              </button>
            </div>
          )}

          {/* Step 5: Context */}
          {view === 'section' && step === 5 && (
            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-800)', margin: '0 0 10px' }}>What are your biggest financial concerns?</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {CONCERNS.map(c => (
                    <button
                      key={c}
                      onClick={() => toggleConcern(c)}
                      style={{
                        padding: '7px 13px',
                        borderRadius: '20px',
                        border: concerns.includes(c) ? '1.5px solid var(--accent)' : '0.5px solid var(--sand-300)',
                        background: concerns.includes(c) ? 'var(--sand-200)' : 'var(--sand-50)',
                        color: concerns.includes(c) ? 'var(--accent)' : 'var(--sand-600)',
                        fontFamily: 'inherit',
                        fontSize: '12px',
                        fontWeight: concerns.includes(c) ? '600' : '400',
                        cursor: 'pointer',
                      }}
                    >{c}</button>
                  ))}
                </div>
              </div>

              <div style={dividerStyle} />

              <div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-800)', margin: '0 0 4px' }}>Anything else your advisor should know?</p>
                <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: '0 0 10px', lineHeight: '1.5' }}>
                  Your profession, life circumstances, upcoming events, financial questions on your mind, or anything that gives context to your situation.
                </p>
                <textarea
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder="E.g. I'm a software engineer at a startup with equity vesting in 2 years. My spouse also works ($70k). We rent but want to buy soon. I've been maxing my 401k but unsure whether to do backdoor Roth or invest in taxable..."
                  rows={7}
                  style={{ ...inputStyle, resize: 'none', lineHeight: '1.6' }}
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <div style={{ background: 'var(--sand-50)', borderTop: '0.5px solid var(--sand-300)', padding: '16px 20px 32px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          {view === 'section' ? (
            <button onClick={handleSaveSection} disabled={saving} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '15px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {saving ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Saving...
                </>
              ) : 'Save →'}
            </button>
          ) : (
            <button onClick={handleFinish} disabled={saving} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '15px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {saving ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Saving...
                </>
              ) : (fromSettings ? 'Done →' : 'Build my plan →')}
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
