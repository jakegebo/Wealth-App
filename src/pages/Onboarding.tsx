import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../contexts/ProfileContext'

interface YearlyContribution {
  year: number
  amount: number
}

interface Asset {
  name: string
  category: string
  value: number
  holdings: string
  yearlyContributions?: YearlyContribution[]
}

interface Debt {
  name: string
  balance: number
  interest_rate: number
  minimum_payment: number
}

interface Goal {
  name: string
  target_amount: number
  current_amount: number
  timeline: string
}

const ASSET_CATEGORIES = ['retirement', 'investment', 'savings', 'real_estate', 'crypto', 'other']

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
    return isNaN(s) ? 0 : Math.max(0, Math.min(s, 4))
  })
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [hasExistingProfile, setHasExistingProfile] = useState(false)

  const [age, setAge] = useState('')
  const [income, setIncome] = useState('')
  const [expenses, setExpenses] = useState('')
  const [context, setContext] = useState('')
  const [assets, setAssets] = useState<Asset[]>([{ name: '', category: 'savings', value: 0, holdings: '' }])
  const [debts, setDebts] = useState<Debt[]>([])
  const [goals, setGoals] = useState<Goal[]>([{ name: '', target_amount: 0, current_amount: 0, timeline: '5 years' }])

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
      setIncome(p.monthly_income?.toString() || '')
      setExpenses(p.monthly_expenses?.toString() || '')
      setContext(p.additional_context || '')
      if (p.assets?.length) setAssets(p.assets)
      if (p.debts?.length) setDebts(p.debts)
      if (p.goals?.length) setGoals(p.goals)
    }
  }

  const addAsset = () => setAssets([...assets, { name: '', category: 'savings', value: 0, holdings: '' }])
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

  const addDebt = () => setDebts([...debts, { name: '', balance: 0, interest_rate: 0, minimum_payment: 0 }])
  const removeDebt = (i: number) => setDebts(debts.filter((_, idx) => idx !== i))
  const updateDebt = (i: number, field: keyof Debt, value: any) => {
    const updated = [...debts]
    updated[i] = { ...updated[i], [field]: value }
    setDebts(updated)
  }

  const addGoal = () => setGoals([...goals, { name: '', target_amount: 0, current_amount: 0, timeline: '5 years' }])
  const removeGoal = (i: number) => setGoals(goals.filter((_, idx) => idx !== i))
  const updateGoal = (i: number, field: keyof Goal, value: any) => {
    const updated = [...goals]
    updated[i] = { ...updated[i], [field]: value }
    setGoals(updated)
  }

  const buildProfileData = () => ({
    age: parseInt(age) || null,
    monthly_income: parseFloat(income) || 0,
    monthly_expenses: parseFloat(expenses) || 0,
    additional_context: context,
    assets: assets.filter(a => a.name && a.value),
    debts: debts.filter(d => d.name && d.balance),
    goals: goals.filter(g => g.name && g.target_amount)
  })

  const persistProfile = async () => {
    if (!userId) return
    setSaving(true)
    const profileData = buildProfileData()
    const { data: existing } = await supabase.from('profiles').select('id').eq('user_id', userId).single()
    if (existing) {
      await supabase.from('profiles').update({ profile_data: profileData, analysis: null, updated_at: new Date().toISOString() }).eq('user_id', userId)
    } else {
      await supabase.from('profiles').insert({ user_id: userId, profile_data: profileData })
    }
    await updateProfile({ profile_data: profileData })
    setSaving(false)
  }

  const handleSaveSection = async () => {
    await persistProfile()
    setView('hub')
  }

  const handleFinish = async () => {
    await persistProfile()
    navigate(fromSettings ? '/settings' : '/dashboard')
  }

  const sections = [
    { title: 'Income & expenses', subtitle: 'Monthly cash flow', complete: !!(age || income || expenses) },
    { title: 'Assets', subtitle: 'What you own', complete: assets.some(a => a.name && a.value) },
    { title: 'Debts', subtitle: 'What you owe', complete: debts.length > 0 },
    { title: 'Goals', subtitle: 'What you\'re working toward', complete: goals.some(g => g.name && g.target_amount) },
    { title: 'Context', subtitle: 'Anything else we should know', complete: context.length > 0 },
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
  } as React.CSSProperties

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
  } as React.CSSProperties

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
                <button onClick={() => navigate('/settings')} className="btn-ghost" style={{ fontSize: '13px' }}>Cancel</button>
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
                  Fill in whichever sections apply to you. You can come back and update anything at any time.
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
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                      background: section.complete ? 'var(--success)' : 'var(--sand-300)',
                    }} />
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

          {/* Step 0: Income */}
          {view === 'section' && step === 0 && (
            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', marginBottom: '8px' }}>Your age</label>
                <input
                  type="number"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder="25"
                  min="16"
                  max="100"
                  style={{ ...inputStyle, width: '120px' }}
                />
                <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '6px 0 0', lineHeight: '1.4' }}>
                  Used to tailor investment strategy, retirement timeline, and risk advice to your life stage.
                </p>
              </div>
              <div style={{ height: '0.5px', background: 'var(--sand-300)' }} />
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', marginBottom: '8px' }}>Monthly income (after tax)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                  <input type="number" value={income} onChange={e => setIncome(e.target.value)} placeholder="5,000" style={{ ...inputStyle, paddingLeft: '28px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', marginBottom: '8px' }}>Monthly expenses</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                  <input type="number" value={expenses} onChange={e => setExpenses(e.target.value)} placeholder="2,500" style={{ ...inputStyle, paddingLeft: '28px' }} />
                </div>
              </div>
              {income && expenses && (
                <div className="card-muted animate-fade" style={{ padding: '14px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--sand-600)', margin: '0 0 4px' }}>Available to save</p>
                  <p style={{ fontSize: '22px', fontWeight: '400', color: parseFloat(income) - parseFloat(expenses) > 0 ? 'var(--success)' : 'var(--danger)', margin: 0, letterSpacing: '-0.5px' }}>
                    ${Math.abs(parseFloat(income) - parseFloat(expenses)).toLocaleString()}/mo
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Assets */}
          {view === 'section' && step === 1 && (
            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {assets.map((asset, i) => (
                <div key={i} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', margin: 0 }}>Asset {i + 1}</p>
                    {assets.length > 1 && (
                      <button onClick={() => removeAsset(i)} style={{ background: 'none', border: 'none', color: 'var(--sand-400)', cursor: 'pointer', fontSize: '18px', padding: 0 }}>×</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input placeholder="Account name (e.g. Roth IRA)" value={asset.name} onChange={e => updateAsset(i, 'name', e.target.value)} style={inputStyle} />
                    {asset.category === 'retirement' && (
                      <p style={{ fontSize: '10px', color: 'var(--sand-400)', margin: '-4px 0 2px', lineHeight: '1.5' }}>
                        Include account type in the name for limit tracking — e.g. "Roth IRA", "401k", "HSA", "SEP-IRA"
                      </p>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <select value={asset.category} onChange={e => updateAsset(i, 'category', e.target.value)} style={selectStyle}>
                        {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                      </select>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                        <input type="number" placeholder="Value" value={asset.value || ''} onChange={e => updateAsset(i, 'value', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '28px' }} />
                      </div>
                    </div>
                    <input placeholder="Holdings (e.g. FXAIX, FTIHX)" value={asset.holdings} onChange={e => updateAsset(i, 'holdings', e.target.value)} style={inputStyle} />

                    {/* Yearly Contributions — retirement accounts only */}
                    {asset.category === 'retirement' && (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-600)', margin: 0 }}>Yearly contributions</p>
                          <button
                            onClick={() => addYearlyContribution(i)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}
                          >
                            + Add year
                          </button>
                        </div>
                        {(!asset.yearlyContributions || asset.yearlyContributions.length === 0) ? (
                          <p style={{ fontSize: '12px', color: 'var(--sand-400)', margin: 0, fontStyle: 'italic' }}>No contributions logged yet</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {asset.yearlyContributions.map((contrib, ci) => (
                              <div key={ci} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 28px', gap: '6px', alignItems: 'center' }}>
                                <input
                                  type="number"
                                  placeholder="Year"
                                  value={contrib.year || ''}
                                  onChange={e => updateYearlyContribution(i, ci, 'year', parseInt(e.target.value) || 0)}
                                  style={{ ...inputStyle, textAlign: 'center' }}
                                />
                                <div style={{ position: 'relative' }}>
                                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '13px' }}>$</span>
                                  <input
                                    type="number"
                                    placeholder="Amount"
                                    value={contrib.amount || ''}
                                    onChange={e => updateYearlyContribution(i, ci, 'amount', parseFloat(e.target.value) || 0)}
                                    style={{ ...inputStyle, paddingLeft: '24px' }}
                                  />
                                </div>
                                <button
                                  onClick={() => removeYearlyContribution(i, ci)}
                                  style={{ background: 'none', border: 'none', color: 'var(--sand-400)', cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1 }}
                                >×</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={addAsset} className="btn-ghost" style={{ width: '100%', padding: '12px', border: '1px dashed var(--sand-400)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--sand-600)' }}>
                + Add another asset
              </button>
            </div>
          )}

          {/* Step 2: Debts */}
          {view === 'section' && step === 2 && (
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
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', margin: 0 }}>Debt {i + 1}</p>
                    <button onClick={() => removeDebt(i)} style={{ background: 'none', border: 'none', color: 'var(--sand-400)', cursor: 'pointer', fontSize: '18px', padding: 0 }}>×</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input placeholder="Debt name (e.g. Student Loan)" value={debt.name} onChange={e => updateDebt(i, 'name', e.target.value)} style={inputStyle} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                        <input type="number" placeholder="Balance" value={debt.balance || ''} onChange={e => updateDebt(i, 'balance', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '28px' }} />
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input type="number" placeholder="Interest rate" value={debt.interest_rate || ''} onChange={e => updateDebt(i, 'interest_rate', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingRight: '28px' }} />
                        <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>%</span>
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                      <input type="number" placeholder="Minimum payment" value={debt.minimum_payment || ''} onChange={e => updateDebt(i, 'minimum_payment', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '28px' }} />
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

          {/* Step 3: Goals */}
          {view === 'section' && step === 3 && (
            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {goals.map((goal, i) => (
                <div key={i} className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sand-700)', margin: 0 }}>Goal {i + 1}</p>
                    {goals.length > 1 && (
                      <button onClick={() => removeGoal(i)} style={{ background: 'none', border: 'none', color: 'var(--sand-400)', cursor: 'pointer', fontSize: '18px', padding: 0 }}>×</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input placeholder="Goal name (e.g. Buy a house)" value={goal.name} onChange={e => updateGoal(i, 'name', e.target.value)} style={inputStyle} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                        <input type="number" placeholder="Target amount" value={goal.target_amount || ''} onChange={e => updateGoal(i, 'target_amount', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '28px' }} />
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sand-500)', fontSize: '14px' }}>$</span>
                        <input type="number" placeholder="Saved so far" value={goal.current_amount || ''} onChange={e => updateGoal(i, 'current_amount', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: '28px' }} />
                      </div>
                    </div>
                    <input placeholder="Timeline (e.g. 5 years)" value={goal.timeline} onChange={e => updateGoal(i, 'timeline', e.target.value)} style={inputStyle} />
                  </div>
                </div>
              ))}
              <button onClick={addGoal} className="btn-ghost" style={{ width: '100%', padding: '12px', border: '1px dashed var(--sand-400)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--sand-600)' }}>
                + Add another goal
              </button>
            </div>
          )}

          {/* Step 4: Context */}
          {view === 'section' && step === 4 && (
            <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card-muted" style={{ padding: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--sand-700)', margin: '0 0 8px', fontWeight: '500' }}>This helps us personalize everything</p>
                <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0, lineHeight: '1.5' }}>Your profession, life situation, specific goals, concerns, or anything you want your AI advisor to know about you.</p>
              </div>
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="E.g. I work in healthcare as a recruiter, earning $65k. I'm 23 and want to retire early. I'm interested in real estate investing long-term..."
                rows={6}
                style={{ ...inputStyle, resize: 'none', lineHeight: '1.6' }}
              />
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
