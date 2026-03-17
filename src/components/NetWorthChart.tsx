import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Filler)

interface HistoryPoint {
  net_worth: number
  total_assets: number
  total_liabilities: number
  recorded_at: string
}

const PERIODS = ['1W', '1M', '3M', 'ALL']

function formatDate(dateStr: string, period: string) {
  const d = new Date(dateStr)
  if (period === '1W') return d.toLocaleDateString('en-US', { weekday: 'short' })
  if (period === '1M') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NetWorthChart({ userId }: { userId: string }) {
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [period, setPeriod] = useState('1M')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [userId])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/networth?userId=${userId}`)
      const data = await res.json()
      setHistory(data.history || [])
    } catch { }
    setLoading(false)
  }

  const filterByPeriod = (data: HistoryPoint[]) => {
    if (data.length === 0) return data
    const now = Date.now()
    const cutoffs: Record<string, number> = {
      '1W': 7 * 86400000,
      '1M': 30 * 86400000,
      '3M': 90 * 86400000,
      'ALL': Infinity
    }
    const cutoff = now - cutoffs[period]
    return data.filter(p => new Date(p.recorded_at).getTime() >= cutoff)
  }

  const filtered = filterByPeriod(history)
  const hasData = filtered.length > 1

  const change = hasData ? filtered[filtered.length - 1].net_worth - filtered[0].net_worth : 0
  const changePercent = hasData && filtered[0].net_worth !== 0
    ? ((change / Math.abs(filtered[0].net_worth)) * 100).toFixed(1)
    : '0.0'
  const isPositive = change >= 0

  const fmt = (n: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(n)

  const chartData = {
    labels: filtered.map(p => formatDate(p.recorded_at, period)),
    datasets: [{
      data: filtered.map(p => p.net_worth),
      borderColor: isPositive ? 'var(--success)' : 'var(--danger)',
      backgroundColor: isPositive ? 'rgba(122,158,110,0.08)' : 'rgba(192,57,43,0.06)',
      fill: true,
      tension: 0.4,
      pointRadius: filtered.length > 20 ? 0 : 3,
      pointHoverRadius: 5,
      borderWidth: 2,
      pointBackgroundColor: isPositive ? 'var(--success)' : 'var(--danger)'
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'var(--sand-50)',
        borderColor: 'var(--sand-300)',
        borderWidth: 1,
        titleColor: 'var(--sand-900)',
        bodyColor: 'var(--sand-600)',
        padding: 10,
        callbacks: {
          label: (ctx: any) => ` ${fmt(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: 'var(--sand-500)', font: { size: 10 }, maxTicksLimit: 6 },
        grid: { color: 'var(--sand-200)' }
      },
      y: {
        ticks: {
          color: 'var(--sand-500)',
          font: { size: 10 },
          callback: (v: any) => `$${(v / 1000).toFixed(0)}k`
        },
        grid: { color: 'var(--sand-200)' },
        position: 'right' as const
      }
    }
  }

  if (loading) {
    return (
      <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '24px', height: '24px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: 0 }}>No history yet</p>
        <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: 0 }}>Your net worth will be tracked automatically</p>
      </div>
    )
  }

  return (
    <div>
      {/* Change indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: '0 0 2px' }}>Change this period</p>
          <p style={{ fontSize: '16px', fontWeight: '600', color: isPositive ? 'var(--success)' : 'var(--danger)', margin: 0 }}>
            {isPositive ? '+' : ''}{fmt(change)} ({isPositive ? '+' : ''}{changePercent}%)
          </p>
        </div>
        {/* Period selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--sand-200)', borderRadius: '10px', padding: '3px' }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '4px 10px', borderRadius: '7px', border: 'none', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', background: period === p ? 'var(--sand-50)' : 'transparent', color: period === p ? 'var(--sand-900)' : 'var(--sand-500)' }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: '160px' }}>
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  )
}
