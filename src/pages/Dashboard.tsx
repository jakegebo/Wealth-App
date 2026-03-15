import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

interface Analysis {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  monthlyIncome: number
  monthlyExpenses: number
  availableToSave: number
  savingsRate: number
  budgetHealth: string
  overallSummary: string
  nextActions: { priority: number; title: string; description: string; impact: string; timeframe: string }[]
  goals: { name: string; targetAmount: number; currentAmount: number; percentage: number; monthlyNeeded: number; feasibility: string }[]
  debts: { name: string; balance: number; interestRate: number; recommendedPayment: number; monthsToPayoff: number; strategy: string }[]
  incomeIdeas: string[]
}

function RingProgress({ value, size = 80, color = '#34d399' }: { value: number; size?: number; color?: string }) {
  const strokeWidth = 7
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#27272a" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{Math.round(value)}%</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (!data) {
      navigate('/onboarding')
      return
    }
    setProfile(data.profile_data)
    if (data.analysis) {
      setAnalysis(data.analysis)
      setLoading(false)
    } else {
      await runAnalysis(data.profile_data)
    }
  }

  const runAnalysis = async (profileData: any) => {
    setAnalyzing(true)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })
      const result = await response.json()
      setAnalysis(result)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({ analysis: result, updated_at: new Date().toISOString() }).eq('user_id', user.id)
      }
    } catch (err) {
      console.error(err)
    }
    setAnalyzing(false)
    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading || analyzing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{analyzing ? 'Analyzing your finances...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-zinc-900 px-4 py-4 flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-400 rounded-xl flex items-center justify-center">
            <span className="text-black font-bold text-sm">W</span>
          </div>
          <span className="font-semibold">WealthApp</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => runAnalysis(profile)} className="text-sm text-gray-400 hover:text-white transition-colors">
            Refresh
          </button>
          <button onClick={() => navigate('/onboarding')} className="text-sm text-gray-400 hover:text-white transition-colors">
            Edit
          </button>
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Net Worth Card */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <p className="text-gray-400 text-sm mb-1">Net Worth</p>
          <h2 className="text-4xl font-bold text-emerald-400">{formatCurrency(analysis.netWorth)}</h2>
          <div className="flex gap-6 mt-4">
            <div>
              <p className="text-xs text-gray-500">Assets</p>
              <p className="font-semibold text-white">{formatCurrency(analysis.totalAssets)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Debts</p>
              <p className="font-semibold text-rose-400">{formatCurrency(analysis.totalLiabilities)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Left to save/mo</p>
              <p className="font-semibold text-white">{formatCurrency(analysis.availableToSave)}</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
          <p className="text-gray-300 text-sm leading-relaxed">{analysis.overallSummary}</p>
        </div>

        {/* Goals */}
        {analysis.goals.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Goals</h3>
            <div className="space-y-3">
              {analysis.goals.map((goal, i) => (
                <div key={i} className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 flex items-center gap-5">
                  <RingProgress
                    value={goal.percentage}
                    color={goal.feasibility === 'achievable' ? '#34d399' : goal.feasibility === 'stretch' ? '#fbbf24' : '#f87171'}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{goal.name}</p>
                    <p className="text-sm text-gray-400">{formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}</p>
                    {goal.monthlyNeeded > 0 && (
                      <p className="text-xs text-emerald-400 mt-1">+{formatCurrency(goal.monthlyNeeded)}/mo needed</p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    goal.feasibility === 'achievable' ? 'bg-emerald-400/10 text-emerald-400' :
                    goal.feasibility === 'stretch' ? 'bg-amber-400/10 text-amber-400' :
                    'bg-red-400/10 text-red-400'
                  }`}>
                    {goal.feasibility}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Plan */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Action Plan</h3>
          <div className="space-y-3">
            {analysis.nextActions.map((action, i) => (
              <div key={i} className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-400/10 text-emerald-400 text-xs font-bold flex items-center justify-center">
                    {action.priority}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    action.impact === 'high' ? 'bg-violet-400/10 text-violet-400' :
                    action.impact === 'medium' ? 'bg-amber-400/10 text-amber-400' :
                    'bg-zinc-700 text-gray-400'
                  }`}>
                    {action.impact} impact
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">{action.timeframe}</span>
                </div>
                <p className="font-semibold text-sm">{action.title}</p>
                <p className="text-gray-400 text-sm mt-1">{action.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Debt Payoff */}
        {analysis.debts.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Debt Payoff Plan</h3>
            <div className="space-y-3">
              {analysis.debts.map((debt, i) => (
                <div key={i} className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold">{debt.name}</p>
                    <span className="text-xs bg-rose-400/10 text-rose-400 px-2 py-0.5 rounded-full">{debt.interestRate}% APR</span>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">{debt.strategy}</p>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Balance</p>
                      <p className="font-semibold">{formatCurrency(debt.balance)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Pay monthly</p>
                      <p className="font-semibold text-emerald-400">{formatCurrency(debt.recommendedPayment)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Paid off in</p>
                      <p className="font-semibold">{debt.monthsToPayoff}mo</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Income Ideas */}
        {analysis.incomeIdeas.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Income Ideas</h3>
            <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 space-y-2">
              {analysis.incomeIdeas.map((idea, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-emerald-400 mt-0.5">→</span>
                  <p className="text-gray-300">{idea}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
