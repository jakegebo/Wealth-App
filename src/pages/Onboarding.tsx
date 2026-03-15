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
    assets: [{ name: '', category: 'savings', value: '' }],
    debts: [{ name: '', category: 'student_loan', balance: '', interest_rate: '', minimum_payment: '' }],
    goals: [{ name: '', target_amount: '', current_amount: '0', target_date: '' }],
    additional_context: ''
  })

  const updateField = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const addItem = (field: 'assets' | 'debts' | 'goals') => {
    const defaults: any = {
      assets: { name: '', category: 'savings', value: '' },
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
      assets: data.assets.filter(a => a.name).map(a => ({ ...a, value: parseFloat(a.value) || 0 })),
      debts: data.debts.filter(d => d.name).map(d => ({
        ...d,
        balance: parseFloat(d.balance) || 0,
        interest_rate: parseFloat(d.interest_rate) || 0,
        minimum_payment: parseFloat(d.minimum_payment) || 0
      })),
      goals: data.goals.filter(g => g.name).map(g => ({
        ...g,
        target_amount: parseFloat(g.target_amount) || 0,
        current_amount: parseFloat(g.current_amount) || 0
      })),
      additional_context: data.additional_context
    }

    await supabase.from('profiles').upsert({ user_id: user.id, profile_data: profile, updated_at: new Date().toISOString() })
    navigate('/dashboard')
    setLoading(false)
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${i <= step ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-gray-400'}`}>
                {i + 1}
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-emerald-400' : 'bg-zinc-800'}`} />}
            </div>
          ))}
        </div>
        <h2 className="text-2xl font-bold">{steps[step]}</h2>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Monthly Income (after tax)</label>
            <input type="number" placeholder="5000" value={data.monthly_income} onChange={e => updateField('monthly_income', e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Monthly Expenses</label>
            <input type="number" placeholder="2000" value={data.monthly_expenses} onChange={e => updateField('monthly_expenses', e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Anything else we should know? (optional)</label>
            <textarea placeholder="e.g. I live at home, my car is paid off..." value={data.additional_context} onChange={e => updateField('additional_context', e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400 h-24 resize-none" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {data.assets.map((asset, i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-4 space-y-3 border border-zinc-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Asset {i + 1}</span>
                {i > 0 && <button onClick={() => removeItem('assets', i)} className="text-red-400 text-sm">Remove</button>}
              </div>
              <input placeholder="Name (e.g. Roth IRA)" value={asset.name} onChange={e => updateItem('assets', i, 'name', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm" />
              <select value={asset.category} onChange={e => updateItem('assets', i, 'category', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm">
                <option value="savings">Savings</option>
                <option value="investment">Investment</option>
                <option value="retirement">Retirement</option>
                <option value="crypto">Crypto</option>
                <option value="real_estate">Real Estate</option>
                <option value="other">Other</option>
              </select>
              <input type="number" placeholder="Value ($)" value={asset.value} onChange={e => updateItem('assets', i, 'value', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm" />
            </div>
          ))}
          <button onClick={() => addItem('assets')} className="w-full border border-dashed border-zinc-700 rounded-xl py-3 text-gray-400 hover:border-emerald-400 hover:text-emerald-400 transition-colors text-sm">
            + Add Asset
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {data.debts.map((debt, i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-4 space-y-3 border border-zinc-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Debt {i + 1}</span>
                {i > 0 && <button onClick={() => removeItem('debts', i)} className="text-red-400 text-sm">Remove</button>}
              </div>
              <input placeholder="Name (e.g. Student Loan)" value={debt.name} onChange={e => updateItem('debts', i, 'name', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm" />
              <select value={debt.category} onChange={e => updateItem('debts', i, 'category', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm">
                <option value="student_loan">Student Loan</option>
                <option value="credit_card">Credit Card</option>
                <option value="mortgage">Mortgage</option>
                <option value="auto">Auto Loan</option>
                <option value="personal">Personal Loan</option>
                <option value="other">Other</option>
              </select>
              <input type="number" placeholder="Balance ($)" value={debt.balance} onChange={e => updateItem('debts', i, 'balance', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm" />
              <input type="number" placeholder="Interest Rate (%)" value={debt.interest_rate} onChange={e => updateItem('debts', i, 'interest_rate', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm" />
              <input type="number" placeholder="Minimum Payment ($/mo)" value={debt.minimum_payment} onChange={e => updateItem('debts', i, 'minimum_payment', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm" />
            </div>
          ))}
          <button onClick={() => addItem('debts')} className="w-full border border-dashed border-zinc-700 rounded-xl py-3 text-gray-400 hover:border-emerald-400 hover:text-emerald-400 transition-colors text-sm">
            + Add Debt
          </button>
          <button onClick={() => setStep(3)} className="w-full text-gray-400 text-sm py-2">
            I have no debts, skip this step
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {data.goals.map((goal, i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-4 space-y-3 border border-zinc-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Goal {i + 1}</span>
                {i > 0 && <button onClick={() => removeItem('goals', i)} className="text-red-400 text-sm">Remove</button>}
              </div>
              <input placeholder="Goal name (e.g. Emergency Fund)" value={goal.name} onChange={e => updateItem('goals', i, 'name', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm" />
              <input type="number" placeholder="Target Amount ($)" value={goal.target_amount} onChange={e => updateItem('goals', i, 'target_amount', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm" />
              <input type="number" placeholder="Already saved ($)" value={goal.current_amount} onChange={e => updateItem('goals', i, 'current_amount', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm" />
              <input type="date" value={goal.target_date} onChange={e => updateItem('goals', i, 'target_date', e.target.value)}
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm" />
            </div>
          ))}
          <button onClick={() => addItem('goals')} className="w-full border border-dashed border-zinc-700 rounded-xl py-3 text-gray-400 hover:border-emerald-400 hover:text-emerald-400 transition-colors text-sm">
            + Add Goal
          </button>
        </div>
      )}

      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="flex-1 border border-zinc-800 rounded-xl py-3 text-gray-400 hover:border-zinc-600 transition-colors">
            Back
          </button>
        )}
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(step + 1)} className="flex-1 bg-emerald-400 text-black font-semibold py-3 rounded-xl hover:bg-emerald-300 transition-colors">
            Continue
          </button>
        ) : (
          <button onClick={handleFinish} disabled={loading} className="flex-1 bg-emerald-400 text-black font-semibold py-3 rounded-xl hover:bg-emerald-300 transition-colors disabled:opacity-50">
            {loading ? 'Saving...' : 'Build My Plan'}
          </button>
        )}
      </div>
    </div>
  )
}
