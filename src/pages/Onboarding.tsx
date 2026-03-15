import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const steps = ['Income', 'Assets', 'Debts', 'Goals']

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState({
    monthly_income: '',
    monthly_expenses: '',
    assets: [{ name: '', category: 'savings', value: '', holdings: '' }],
    debts: [{ name: '', category: 'student_loan', balance: '', interest_rate: '', minimum_payment: '' }],
    goals: [{ name: '', target_amount: '', current_amount: '0', target_date: '' }],
    additional_context: ''
  })

  const updateField = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const addItem = (field: 'assets' | 'debts' | 'goals') => {
    const defaults: any = {
      assets: { name: '', category: 'savings', value: '', holdings: '' },
      debts: { name: '', category: 'student_loan', balance: '', interest_rate: '', minimum_payment: '' },
      goals: { name: '', target_amount: '', current_amount: '0', target_date: '' }
    }
    setData(prev => ({ ...prev, [field]: [...prev[field], defaults[field]] }))
  }

  const updateItem = (field: 'assets' | 'debts' | 'goals', index: number, key: string, value: string) => {
    setData(prev => {
      const arr = [...prev[field]] as any[]
      arr[index] = { ...arr[index], [key]: value }
      return { ...prev, [field]: arr }
    })
  }

  const removeItem = (field: 'assets' | 'debts' | 'goals', index: number) => {
    setData(prev => ({ ...prev, [field]: (prev[field] as any[]).filter((_, i) => i !== index) }))
  }

  const handleFinish = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const profile = {
      monthly_income: parseFloat(data.monthly_income) || 0,
      monthly_expenses: parseFloat(data.monthly_expenses) || 0,
      assets: data.assets.filter(a => a.name).map(a => ({
        name: a.name,
        category: a.category,
        value: parseFloat(a.value) || 0,
        holdings: a.holdings || ''
      })),
      debts: data.debts.filter(d => d.name).map(d => ({
        name: d.name,
        category: d.category,
        balance: parseFloat(d.balance) || 0,
        interest_rate: parseFloat(d.interest_rate) || 0,
        minimum_payment: parseFloat(d.minimum_payment) || 0
      })),
      goals: data.goals.filter(g => g.name).map(g => ({
        name: g.name,
        target_amount: parseFloat(g.target_amount) || 0,
        current_amount: parseFloat(g.current_amount) || 0,
        target_date: g.target_date
      })),
      additional_context: data.additional_context
    }

    await supabase.from('profiles').upsert({
      user_id: user.id,
      profile_data: profile,
      updated_at: new Date().toISOString()
    })
    navigate('/dashboard')
    setLoading(false)
  }

  const inputClass = "w-full bg-zinc-800 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm"
  const selectClass = "w-full bg-zinc-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm"
  const labelClass = "text-xs text-gray-400 mb-1 block"

  return (
    <div className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${i <= step ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-gray-400'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-emerald-400' : 'bg-zinc-800'}`} />}
            </div>
          ))}
        </div>
        <h2 className="text-2xl font-bold">{steps[step]}</h2>
        <p className="text-gray-400 text-sm mt-1">
          {step === 0 && "Tell us about your income and monthly spending"}
          {step === 1 && "What do you own? Include all accounts and assets"}
          {step === 2 && "Any debts? We'll help you make a plan"}
          {step === 3 && "What are you working toward financially?"}
        </p>
      </div>

      {/* Step 0 — Income */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Monthly take-home income (after tax)</label>
            <input type="number" placeholder="e.g. 5000" value={data.monthly_income}
              onChange={e => updateField('monthly_income', e.target.value)}
              className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Monthly expenses (rent, food, subscriptions, etc.)</label>
            <input type="number" placeholder="e.g. 2000" value={data.monthly_expenses}
              onChange={e => updateField('monthly_expenses', e.target.value)}
              className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Anything else we should know? (optional)</label>
            <textarea placeholder="e.g. I live at home, my car is paid off, I get a bonus every year..."
              value={data.additional_context}
              onChange={e => updateField('additional_context', e.target.value)}
              className={`${inputClass} h-24 resize-none`} />
          </div>
        </div>
      )}

      {/* Step 1 — Assets */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Include bank accounts, investment accounts, retirement accounts, crypto, real estate, etc.</p>
          {data.assets.map((asset, i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-4 space-y-3 border border-zinc-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-300">Asset {i + 1}</span>
                {i > 0 && (
                  <button onClick={() => removeItem('assets', i)} className="text-red-400 text-xs hover:text-red-300">
                    Remove
                  </button>
                )}
              </div>
              <div>
                <label className={labelClass}>Account or asset name</label>
                <input placeholder="e.g. Roth IRA, Chase Savings, Bitcoin" value={asset.name}
                  onChange={e => updateItem('assets', i, 'name', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Type</label>
                <select value={asset.category} onChange={e => updateItem('assets', i, 'category', e.target.value)}
                  className={selectClass}>
                  <option value="savings">Savings / Checking</option>
                  <option value="investment">Investment / Brokerage</option>
                  <option value="retirement">Retirement (401k, IRA, Roth IRA)</option>
                  <option value="crypto">Crypto</option>
                  <option value="real_estate">Real Estate</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Current value ($)</label>
                <input type="number" placeholder="e.g. 17000" value={asset.value}
                  onChange={e => updateItem('assets', i, 'value', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>What's inside it? (optional but helps AI advice)</label>
                <input placeholder="e.g. FXAIX, FTIHX — or 'index funds', 'Bitcoin', 'cash'"
                  value={asset.holdings}
                  onChange={e => updateItem('assets', i, 'holdings', e.target.value)}
                  className={inputClass} />
              </div>
            </div>
          ))}
          <button onClick={() => addItem('assets')}
            className="w-full border border-dashed border-zinc-700 rounded-xl py-3 text-gray-400 hover:border-emerald-400 hover:text-emerald-400 transition-colors text-sm">
            + Add Another Asset
          </button>
        </div>
      )}

      {/* Step 2 — Debts */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Include student loans, credit cards, car loans, mortgages, etc.</p>
          {data.debts.map((debt, i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-4 space-y-3 border border-zinc-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-300">Debt {i + 1}</span>
                {i > 0 && (
                  <button onClick={() => removeItem('debts', i)} className="text-red-400 text-xs hover:text-red-300">
                    Remove
                  </button>
                )}
              </div>
              <div>
                <label className={labelClass}>Debt name</label>
                <input placeholder="e.g. Federal Student Loan, Chase Sapphire" value={debt.name}
                  onChange={e => updateItem('debts', i, 'name', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Type</label>
                <select value={debt.category} onChange={e => updateItem('debts', i, 'category', e.target.value)}
                  className={selectClass}>
                  <option value="student_loan">Student Loan</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="auto">Auto Loan</option>
                  <option value="personal">Personal Loan</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Current balance ($)</label>
                <input type="number" placeholder="e.g. 10000" value={debt.balance}
                  onChange={e => updateItem('debts', i, 'balance', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Interest rate (%)</label>
                <input type="number" placeholder="e.g. 5.5" value={debt.interest_rate}
                  onChange={e => updateItem('debts', i, 'interest_rate', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Minimum monthly payment ($)</label>
                <input type="number" placeholder="e.g. 200" value={debt.minimum_payment}
                  onChange={e => updateItem('debts', i, 'minimum_payment', e.target.value)}
                  className={inputClass} />
              </div>
            </div>
          ))}
          <button onClick={() => addItem('debts')}
            className="w-full border border-dashed border-zinc-700 rounded-xl py-3 text-gray-400 hover:border-emerald-400 hover:text-emerald-400 transition-colors text-sm">
            + Add Another Debt
          </button>
          <button onClick={() => setStep(3)}
            className="w-full text-gray-500 text-sm py-2 hover:text-gray-300 transition-colors">
            I have no debts →
          </button>
        </div>
      )}

      {/* Step 3 — Goals */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">What are you saving toward? Emergency fund, house, early retirement?</p>
          {data.goals.map((goal, i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-4 space-y-3 border border-zinc-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-300">Goal {i + 1}</span>
                {i > 0 && (
                  <button onClick={() => removeItem('goals', i)} className="text-red-400 text-xs hover:text-red-300">
                    Remove
                  </button>
                )}
              </div>
              <div>
                <label className={labelClass}>Goal name</label>
                <input placeholder="e.g. Emergency Fund, Down Payment, Early Retirement"
                  value={goal.name}
                  onChange={e => updateItem('goals', i, 'name', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Target amount ($)</label>
                <input type="number" placeholder="e.g. 25000" value={goal.target_amount}
                  onChange={e => updateItem('goals', i, 'target_amount', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Already saved toward this ($)</label>
                <input type="number" placeholder="e.g. 5000" value={goal.current_amount}
                  onChange={e => updateItem('goals', i, 'current_amount', e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Target date (optional)</label>
                <input type="date" value={goal.target_date}
                  onChange={e => updateItem('goals', i, 'target_date', e.target.value)}
                  className={selectClass} />
              </div>
            </div>
          ))}
          <button onClick={() => addItem('goals')}
            className="w-full border border-dashed border-zinc-700 rounded-xl py-3 text-gray-400 hover:border-emerald-400 hover:text-emerald-400 transition-colors text-sm">
            + Add Another Goal
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-8 pb-8">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)}
            className="flex-1 border border-zinc-800 rounded-xl py-3 text-gray-400 hover:border-zinc-600 hover:text-white transition-colors text-sm">
            Back
          </button>
        )}
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(step + 1)}
            className="flex-1 bg-emerald-400 text-black font-semibold py-3 rounded-xl hover:bg-emerald-300 transition-colors">
            Continue
          </button>
        ) : (
          <button onClick={handleFinish} disabled={loading}
            className="flex-1 bg-emerald-400 text-black font-semibold py-3 rounded-xl hover:bg-emerald-300 transition-colors disabled:opacity-50">
            {loading ? 'Saving...' : 'Build My Plan →'}
          </button>
        )}
      </div>
    </div>
  )
}
