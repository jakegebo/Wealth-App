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
  const [expandedAction, setExpandedAction] = useState<number | null>(null)
  const [chatRefs, setChatRefs] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (!data) {
      navigate('/onboarding')
      return
    }
    setProfile(data.profile_data)
    setChatRefs(data.chat_refs || {})
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

  const openPersistentChat = async (key: string, prompt: string, topic: string, title: string) => {
    if (!userId) return

    if (chatRefs[key]) {
      navigate(`/chat/${chatRefs[key]}`)
      return
    }

    const { data } = await supabase
      .from('chats')
      .insert({ user_id: userId, title, topic, messages: [] })
      .select()
      .single()

    if (data) {
      const newRefs = { ...chatRefs, [key]: data.id }
      setChatRefs(newRefs)
      await supabase.from('profiles').update({ chat_refs: newRefs }).eq('user_id', userId)
      navigate(`/chat/${data.id}`, { state: { prompt } })
    }
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
      <div className="border-b border-zinc-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-400 rounded-xl flex items-center justify-center">
              <span className="text-black font-bold text-sm">W</span>
            </div>
            <span className="font-semibold">WealthApp</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/retirement')}
              className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors">
              🏖️ Retirement
            </button>
            <button onClick={() => navigate('/chats')}
              className="bg-emerald-400 text-black font-semibold px-4 py-2 rounded-xl text-sm hover:bg-emerald-300 transition-colors">
              Ask AI
            </button>
            <button onClick={() => runAnalysis(profile)}
              className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors">
              Refresh
            </button>
            <button onClick={() => navigate('/onboarding')}
              className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors">
              Edit
            </button>
            <button onClick={handleSignOut}
              className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left column */}
          <div className="lg:col-span-2 space-y-4">

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

            {/* Retirement Preview Card */}
            <button onClick={() => navigate('/retirement')}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-left hover:border-emerald-400/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏖️</span>
                  <div>
                    <p className="font-semibold text-sm">Retirement Planner</p>
                    <p className="text-xs text-gray-400">Track your path to financial freedom</p>
                  </div>
                </div>
                <span className="text-gray-400 text-sm">→</span>
              </div>
            </button>

            {/* Summary */}
            <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
              <p className="text-gray-300 text-sm leading-relaxed">{analysis.overallSummary}</p>
            </div>

            {/* Action Plan */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Action Plan</h3>
              <div className="space-y-3">
                {analysis.nextActions.map((action, i) => (
                  <div key={i} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                    <button
                      onClick={() => setExpandedAction(expandedAction === i ? null : i)}
                      className="w-full p-5 text-left hover:bg-zinc-800/50 transition-colors"
                    >
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
                        <span className="text-gray-500 text-xs ml-2">{expandedAction === i ? '▲' : '▼'}</span>
                      </div>
                      <p className="font-semibold text-sm">{action.title}</p>
                      <p className="text-gray-400 text-sm mt-1">{action.description}</p>
                    </button>

                    {expandedAction === i && (
                      <div className="px-5 pb-5 border-t border-zinc-800 pt-4 space-y-3">
                        {chatRefs[`action_${i}`] && (
                          <div className="bg-zinc-800/50 rounded-xl p-3">
                            <p className="text-xs text-emerald-400 font-semibold mb-1">Previously discussed</p>
                            <p className="text-xs text-gray-400">You have an existing plan for this. Click below to continue the conversation.</p>
                          </div>
                        )}
                        <button
                          onClick={() => openPersistentChat(
                            `action_${i}`,
                            `Give me a detailed step by step plan for: ${action.title}. Be specific to my financial situation and explain each step clearly.`,
                            'general',
                            action.title
                          )}
                          className="w-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 text-sm font-semibold py-2.5 rounded-xl hover:bg-emerald-400/20 transition-colors"
                        >
                          {chatRefs[`action_${i}`] ? 'Continue plan →' : 'Get detailed steps →'}
                        </button>
                      </div>
                    )}
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
          </div>

          {/* Right column */}
          <div className="space-y-4">

            {/* Ask AI */}
            <button onClick={() => navigate('/chats')}
              className="w-full bg-zinc-900 border border-emerald-400/30 rounded-2xl p-4 flex items-center gap-3 hover:border-emerald-400 transition-colors text-left">
              <div className="w-10 h-10 bg-emerald-400/10 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-emerald-400 font-bold text-sm">AI</span>
              </div>
              <div>
                <p className="font-semibold text-sm">Ask your advisor</p>
                <p className="text-xs text-gray-400">Honest advice on your finances</p>
              </div>
              <span className="ml-auto text-gray-400">→</span>
            </button>

            {/* Goals */}
            {analysis.goals.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Goals</h3>
                <div className="space-y-3">
                  {analysis.goals.map((goal, i) => (
                    <div key={i} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                      <div className="p-4 flex items-center gap-4">
                        <RingProgress
                          value={goal.percentage}
                          size={70}
                          color={goal.feasibility === 'achievable' ? '#34d399' : goal.feasibility === 'stretch' ? '#fbbf24' : '#f87171'}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{goal.name}</p>
                          <p className="text-xs text-gray-400">{formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}</p>
                          {goal.monthlyNeeded > 0 && (
                            <p className="text-xs text-emerald-400 mt-1">+{formatCurrency(goal.monthlyNeeded)}/mo</p>
                          )}
                        </div>
                      </div>
                      <div className="px-4 pb-3 border-t border-zinc-800 pt-2">
                        <button
                          onClick={() => openPersistentChat(
                            `goal_${i}`,
                            `Give me a detailed plan for my "${goal.name}" goal. I have ${formatCurrency(goal.currentAmount)} saved toward a ${formatCurrency(goal.targetAmount)} target. Be specific about what I should do each month.`,
                            'general',
                            `${goal.name} Plan`
                          )}
                          className="text-xs text-emerald-400 hover:underline"
                        >
                          {chatRefs[`goal_${i}`] ? 'Continue plan →' : 'Get advice →'}
                        </button>
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
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                  {analysis.incomeIdeas.map((idea, i) => (
                    <button
                      key={i}
                      onClick={() => openPersistentChat(
                        `income_${i}`,
                        `Tell me more about this income idea: "${idea}". Include average income potential, realistic timeline to start earning, what skills or resources I need, and whether this is more of a side hustle or passive income. Be specific to my situation.`,
                        'general',
                        idea.slice(0, 40)
                      )}
                      className="w-full flex items-start gap-3 p-4 text-left hover:bg-zinc-800/50 transition-colors border-b border-zinc-800 last:border-0"
                    >
                      <span className="text-emerald-400 mt-0.5 shrink-0">→</span>
                      <p className="text-gray-300 text-sm">{idea}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
