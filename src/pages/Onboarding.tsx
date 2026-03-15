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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${i <= step ? 'bg-emerald-400 text-black
