import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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

const ROTH_IRA_LIMIT = 7000
const K401_LIMIT = 23000

function calcProjection(currentSavings: number, monthlySavings: number, years: number) {
  const labels: string[] = []
  const optimistic: number[] = []
  const moderate: number[] = []
  const conservative: number[] = []

  let opt = currentSavings
  let mod = currentSavings
  let con = currentSavings

  for (let y = 1; y <= years; y++) {
    opt = opt * 1.10 + monthlySavings * 12
    mod = mod * 1.07 + monthlySavings * 12
    con = con * 1.04 + monthlySavings * 12

    if (y % 5 === 0 || y === 1 || y === years) {
      labels.push(`Year ${y}`)
      optimistic.push(Math.round(opt))
      moderate.push(Math.round(mod))
      conservative.push(Math.round(con))
    }
  }
  return { labels, optimistic, moderate, conservative }
}

function calcRetirementAge(currentAge: number, currentSavings: number, monthlySavings: number, targetAmount: number) {
  let savings = currentSavings
  let years = 0
  while (savings < targetAmount && years < 60) {
    savings = savings * 1.07 + monthlySavings * 12
    years++
  }
  return currentAge + years
}

export default function Retirement() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentAge, setCurrentAge] = useState(25)
  const [targetAge, setTargetAge] = useState(55)
  const [monthlyInRetirement, setMonthlyInRetirement] = useState(5000)
  const [chatRef, setChatRef] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (data) {
      setProfile(data.profile_data)
      setChatRef(data.chat_refs?.retirement || null)
    }
    setLoading(false)
  }

  const openRetirementChat = async () => {
    if (!userId) return

    if (chatRef) {
      navigate(`/chat/${chatRef}`)
      return
    }

    const { data } = await supabase
      .from('chats')
      .insert({
        user_id: userId,
        title: 'Retirement Plan',
        topic: 'retirement',
        messages: []
      })
      .select()
      .single()

    if (data) {
      const { data: profileData } = await supabase.from('profiles').select('chat_refs').eq('user_id', userId).single()
      const newRefs = { ...(profileData?.chat_refs || {}), retirement: data.id }
      await supabase.from('profiles').update({ chat_refs: newRefs }).eq('user_id', userId)
      setChatRef(data.id)
      navigate(`/chat/${data.id}`, {
        state: {
          prompt: `I want to build a detailed retirement plan. I'm ${currentAge} years old, want to retire at ${targetAge}, and need $${monthlyInRetirement.toLocaleString()}/month in retirement. Based on my current savings and income, what do I need to do to hit this goal?`
        }
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const retirementAssets = profile?.assets
    ?.filter((a: any) => a.category === 'retirement')
    ?.reduce((s: number, a: any) => s + (a.value || 0), 0) || 0

  const rothIRA = profile?.assets?.find((a: any) =>
    a.name.toLowerCase().includes('roth') || a.name.toLowerCase().includes('ira')
  )

  const k401 = profile?.assets?.find((a: any) =>
    a.name.toLowerCase().includes('401')
  )

  const totalDebtPayments = profile?.debts?.reduce((s: number, d: any) => s + (d.minimum_payment || 0), 0) || 0
  const availableToSave = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0) - totalDebtPayments
  const recommendedRetirementSavings = availableToSave * 0.15

  // Target: 25x annual expenses (4% rule)
  const annualInRetirement = monthlyInRetirement * 12
  const targetNestEgg = annualInRetirement * 25

  const yearsToRetirement = targetAge - currentAge
  const projectedAge = calcRetirementAge(currentAge, retirementAssets, recommendedRetirementSavings, targetNestEgg)
  const { labels, optimistic, moderate, conservative } = calcProjection(retirementAssets, recommendedRetirementSavings, Math.max(yearsToRetirement, 30))

  const rothContribRoom = Math.max(0, ROTH_IRA_LIMIT - (rothIRA?.value || 0) * 0.1)
  const k401ContribRoom = Math.max(0, K401_LIMIT)

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Optimistic (10%)',
        data: optimistic,
        borderColor: '#34d399',
        backgroundColor: '#34d39920',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Moderate (7%)',
        data: moderate,
        borderColor: '#60a5fa',
        backgroundColor: '#60a5fa20',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Conservative (4%)',
        data: conservative,
        borderColor: '#fbbf24',
        backgroundColor: '#fbbf2420',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        labels: { color: '#9ca3af', font: { size: 12 }, usePointStyle: true }
      },
      tooltip: {
        backgroundColor: '#18181b',
        borderColor: '#3f3f46',
        borderWidth: 1,
        titleColor: '#f3f4f6',
        bodyColor: '#9ca3af',
        padding: 12,
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      x: { ticks: { color: '#6b7280' }, grid: { color: '#27272a' } },
      y: {
        ticks: {
          color: '#6b7280',
          callback: (val: any) => formatCurrency(val)
        },
        grid: { color: '#27272a' }
      }
    }
  }

  const onTrack = projectedAge <= targetAge

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-zinc-900 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-white transition-colors">
              ←
            </button>
            <div>
              <h1 className="font-semibold">Retirement Planner</h1>
              <p className="text-xs text-gray-500">Based on your current finances</p>
            </div>
          </div>
          <button onClick={openRetirementChat}
            className="bg-emerald-400 text-black font-semibold px-4 py-2 rounded-xl text-sm hover:bg-emerald-300 transition-colors">
            {chatRef ? 'Continue Plan →' : 'Build My Plan →'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">

        {/* Settings */}
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Your Retirement Goals</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Current Age</label>
              <input
                type="number"
                value={currentAge}
                onChange={e => setCurrentAge(parseInt(e.target.value) || 25)}
                className="w-full bg-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Target Retirement Age</label>
              <input
                type="number"
                value={targetAge}
                onChange={e => setTargetAge(parseInt(e.target.value) || 55)}
                className="w-full bg-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Monthly Income Needed in Retirement</label>
              <input
                type="number"
                value={monthlyInRetirement}
                onChange={e => setMonthlyInRetirement(parseInt(e.target.value) || 5000)}
                className="w-full bg-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-gray-500 mb-1">Retirement Savings</p>
            <p className="text-xl font-bold text-emerald-400">{formatCurrency(retirementAssets)}</p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-gray-500 mb-1">Target Nest Egg</p>
            <p className="text-xl font-bold text-white">{formatCurrency(targetNestEgg)}</p>
            <p className="text-xs text-gray-600 mt-1">25x rule</p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-gray-500 mb-1">Years to Retire</p>
            <p className="text-xl font-bold text-white">{yearsToRetirement}</p>
          </div>
          <div className={`rounded-2xl p-4 border ${onTrack ? 'bg-emerald-400/10 border-emerald-400/30' : 'bg-rose-400/10 border-rose-400/30'}`}>
            <p className="text-xs text-gray-500 mb-1">Projected Age</p>
            <p className={`text-xl font-bold ${onTrack ? 'text-emerald-400' : 'text-rose-400'}`}>{projectedAge}</p>
            <p className={`text-xs mt-1 ${onTrack ? 'text-emerald-400' : 'text-rose-400'}`}>
              {onTrack ? '✓ On track' : `${projectedAge - targetAge}yr late`}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold">Progress to Target</p>
            <p className="text-sm text-gray-400">{formatCurrency(retirementAssets)} of {formatCurrency(targetNestEgg)}</p>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-3">
            <div
              className="bg-emerald-400 h-3 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (retirementAssets / targetNestEgg) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {((retirementAssets / targetNestEgg) * 100).toFixed(1)}% of goal — saving {formatCurrency(recommendedRetirementSavings)}/mo recommended
          </p>
        </div>

        {/* Projection Chart */}
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
          <p className="text-sm font-semibold mb-4">Retirement Savings Projection</p>
          <div style={{ height: '300px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Based on saving {formatCurrency(recommendedRetirementSavings)}/mo (15% of available income)
          </p>
        </div>

        {/* Account Limits */}
        <div>
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Annual Contribution Limits</p>
          <div className="space-y-3">
            {rothIRA && (
              <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="font-semibold text-sm">{rothIRA.name}</p>
                    <p className="text-xs text-gray-400">2024 limit: {formatCurrency(ROTH_IRA_LIMIT)}/year</p>
                  </div>
                  <span className="text-xs bg-emerald-400/10 text-emerald-400 px-2.5 py-1 rounded-full font-semibold">Roth IRA</span>
                </div>
                <p className="text-xs text-gray-400">
                  Max out your Roth IRA first — contributions grow tax-free and you can withdraw in retirement without paying taxes. That's {formatCurrency(ROTH_IRA_LIMIT / 12)}/month.
                </p>
              </div>
            )}
            {k401 && (
              <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="font-semibold text-sm">{k401.name}</p>
                    <p className="text-xs text-gray-400">2024 limit: {formatCurrency(K401_LIMIT)}/year</p>
                  </div>
                  <span className="text-xs bg-blue-400/10 text-blue-400 px-2.5 py-1 rounded-full font-semibold">401k</span>
                </div>
                <p className="text-xs text-gray-400">
                  Contribute at least enough to get your employer match — that's free money. The full limit is {formatCurrency(K401_LIMIT / 12)}/month.
                </p>
              </div>
            )}
            {!rothIRA && !k401 && (
              <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                <p className="text-sm text-gray-400">No retirement accounts detected. Update your profile to add your Roth IRA or 401k.</p>
                <button onClick={() => navigate('/onboarding')} className="text-xs text-emerald-400 hover:underline mt-2 block">
                  Update profile →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Key insights */}
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 space-y-3">
          <p className="text-sm font-semibold">Key Insights</p>
          <div className="flex items-start gap-3 text-sm">
            <span className="text-emerald-400 shrink-0 mt-0.5">→</span>
            <p className="text-gray-300">
              The <strong className="text-white">4% rule</strong> means you need 25x your annual expenses saved. At {formatCurrency(monthlyInRetirement)}/month you need <strong className="text-white">{formatCurrency(targetNestEgg)}</strong>.
            </p>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <span className="text-emerald-400 shrink-0 mt-0.5">→</span>
            <p className="text-gray-300">
              With {formatCurrency(retirementAssets)} saved and saving {formatCurrency(recommendedRetirementSavings)}/mo, you're projected to retire at <strong className="text-white">age {projectedAge}</strong>.
            </p>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <span className="text-emerald-400 shrink-0 mt-0.5">→</span>
            <p className="text-gray-300">
              Every extra <strong className="text-white">$500/month</strong> you save in your 20s could be worth over <strong className="text-white">{formatCurrency(500 * 12 * Math.pow(1.07, yearsToRetirement))}</strong> by retirement thanks to compound growth.
            </p>
          </div>
        </div>

        <button onClick={openRetirementChat}
          className="w-full bg-emerald-400 text-black font-semibold py-4 rounded-2xl hover:bg-emerald-300 transition-colors">
          {chatRef ? 'Continue Retirement Planning →' : 'Build My Retirement Plan with AI →'}
        </button>

      </div>
    </div>
  )
}
