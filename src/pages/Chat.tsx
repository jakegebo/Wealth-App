import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
)

const CHART_COLORS = ['#34d399', '#60a5fa', '#f59e0b', '#f87171', '#a78bfa', '#fb7185', '#38bdf8', '#4ade80']

interface ChartData {
  type: 'bar' | 'line' | 'doughnut'
  title: string
  labels: string[]
  datasets: { label: string; data: number[]; color: string }[]
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  chartData?: ChartData | null
  timestamp?: string
}

const TOPIC_STARTERS: Record<string, string> = {
  debt: "I've looked at your debt situation. Let's build a real plan to eliminate it. What's your biggest concern — the total amount, the interest, or figuring out where to start?",
  retirement: "Let's talk retirement. Based on your income and savings rate, I can help you figure out when you can actually retire and what needs to change to get there faster. What's your target retirement age?",
  investment: "Let's talk about growing your wealth. I can see what you're working with — let's make sure your money is working as hard as possible. What aspect of investing do you want to tackle first?",
  general: "I've reviewed your finances. I give honest, unbiased advice based on your actual numbers — no generic tips. What do you want to know?"
}

const TOPIC_ICONS: Record<string, string> = {
  debt: '💳',
  retirement: '🏖️',
  investment: '📈',
  general: '💬'
}

const QUICK_PROMPTS: Record<string, string[]> = {
  debt: ["Show me a debt payoff timeline chart", "Should I use avalanche or snowball method?", "Can I invest while paying off debt?"],
  retirement: ["Show me a retirement projection chart", "When can I realistically retire?", "Should I max my Roth IRA first?"],
  investment: ["Show me my asset allocation", "Where should I put my extra money?", "Should I invest in index funds?"],
  general: ["Show me a breakdown of my finances", "What's my biggest financial mistake?", "What should I focus on this month?"]
}

function InlineChart({ chartData }: { chartData: ChartData }) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#9ca3af',
          font: { size: 12 },
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 8
        }
      },
      title: {
        display: true,
        text: chartData.title,
        color: '#f3f4f6',
        font: { size: 14, weight: 'bold' as const },
        padding: { bottom: 16 }
      },
      tooltip: {
        backgroundColor: '#18181b',
        borderColor: '#3f3f46',
        borderWidth: 1,
        titleColor: '#f3f4f6',
        bodyColor: '#9ca3af',
        padding: 12,
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? ctx.parsed)}`
        }
      }
    }
  }

  const axisOptions = {
    x: {
      ticks: { color: '#6b7280', font: { size: 11 } },
      grid: { color: '#27272a' }
    },
    y: {
      ticks: {
        color: '#6b7280',
        font: { size: 11 },
        callback: (val: any) => formatCurrency(val)
      },
      grid: { color: '#27272a' }
    }
  }

  const buildDatasets = () =>
    chartData.datasets.map((d, i) => ({
      label: d.label,
      data: d.data,
      backgroundColor: chartData.type === 'doughnut'
        ? CHART_COLORS.map(c => c + 'cc')
        : (d.color || CHART_COLORS[i]) + '33',
      borderColor: chartData.type === 'doughnut'
        ? CHART_COLORS
        : d.color || CHART_COLORS[i],
      borderWidth: chartData.type === 'doughnut' ? 2 : 2,
      fill: chartData.type === 'line',
      tension: 0.4,
      pointBackgroundColor: d.color || CHART_COLORS[i],
      pointRadius: chartData.type === 'line' ? 4 : undefined,
      pointHoverRadius: chartData.type === 'line' ? 6 : undefined,
    }))

  const data = {
    labels: chartData.labels,
    datasets: buildDatasets()
  }

  const doughnutOptions = {
    ...commonOptions,
    plugins: {
      ...commonOptions.plugins,
      tooltip: {
        ...commonOptions.plugins.tooltip,
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`
        }
      }
    }
  }

  return (
    <div className="mt-3 bg-zinc-950 rounded-2xl p-5 border border-zinc-800 w-full">
      {chartData.type === 'bar' && (
        <div style={{ height: '300px' }}>
          <Bar data={data} options={{ ...commonOptions, scales: axisOptions, maintainAspectRatio: false }} />
        </div>
      )}
      {chartData.type === 'line' && (
        <div style={{ height: '300px' }}>
          <Line data={data} options={{ ...commonOptions, scales: axisOptions, maintainAspectRatio: false }} />
        </div>
      )}
      {chartData.type === 'doughnut' && (
        <div style={{ height: '300px' }}>
          <Doughnut data={data} options={{ ...doughnutOptions, maintainAspectRatio: false }} />
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'

  const formatContent = (content: string) => {
    const lines = content.split('\n')
    return lines.map((line, i) => {
      if (line.match(/^\d+\./)) {
        return (
          <div key={i} className="flex gap-2 mt-1">
            <span className="text-emerald-400 font-bold shrink-0">{line.split('.')[0]}.</span>
            <span>{line.split('.').slice(1).join('.').trim()}</span>
          </div>
        )
      }
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <div key={i} className="flex gap-2 mt-1">
            <span className="text-emerald-400 shrink-0">→</span>
            <span>{line.slice(2)}</span>
          </div>
        )
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-bold text-white mt-2">{line.slice(2, -2)}</p>
      }
      if (line === '') return <div key={i} className="h-2" />
      return <p key={i}>{line}</p>
    })
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="w-7 h-7 bg-emerald-400 rounded-lg flex items-center justify-center shrink-0 mt-1">
          <span className="text-black font-bold text-xs">AI</span>
        </div>
      )}
      <div className={`${isUser ? 'max-w-[75%] items-end' : 'w-full items-start'} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-emerald-400 text-black font-medium rounded-tr-sm'
            : 'bg-zinc-900 text-gray-100 border border-zinc-800 rounded-tl-sm w-full'
        }`}>
          {isUser ? (
            <p>{msg.content}</p>
          ) : (
            <div className="space-y-0.5">{formatContent(msg.content)}</div>
          )}
        </div>
        {msg.chartData && <InlineChart chartData={msg.chartData} />}
      </div>
    </div>
  )
}

export default function Chat() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [chatTitle, setChatTitle] = useState('New Chat')
  const [editingTitle, setEditingTitle] = useState(false)
  const [topic, setTopic] = useState('general')
  const [showPrompts, setShowPrompts] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData() }, [id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (editingTitle) titleInputRef.current?.focus() }, [editingTitle])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (profileData) setProfile(profileData.profile_data)

    if (id) {
      const { data: chatData } = await supabase.from('chats').select('*').eq('id', id).single()
      if (chatData) {
        setChatTitle(chatData.title)
        setTopic(chatData.topic)
        if (chatData.messages.length > 0) {
          setMessages(chatData.messages)
          setShowPrompts(false)
        } else if (!initialized.current) {
          initialized.current = true
          const welcome = TOPIC_STARTERS[chatData.topic] || TOPIC_STARTERS.general
          const welcomeMsg: Message = { role: 'assistant', content: welcome, timestamp: new Date().toISOString() }
          setMessages([welcomeMsg])
          await saveMessages([welcomeMsg])
          const prompt = location.state?.prompt
          if (prompt) setTimeout(() => sendMessageWithText(prompt, [welcomeMsg], profileData?.profile_data), 300)
        }
      }
    }
  }

  const saveMessages = async (msgs: Message[]) => {
    if (!id) return
    await supabase.from('chats').update({ messages: msgs, updated_at: new Date().toISOString() }).eq('id', id)
  }

  const saveTitle = async (title: string) => {
    if (!id || !title.trim()) return
    setChatTitle(title.trim())
    setEditingTitle(false)
    await supabase.from('chats').update({ title: title.trim() }).eq('id', id)
  }

  const sendMessageWithText = async (text: string, currentMessages: Message[], profileData: any) => {
    const newMsg: Message = { role: 'user', content: text, timestamp: new Date().toISOString() }
    const newMessages = [...currentMessages, newMsg]
    setMessages(newMessages)
    setShowPrompts(false)
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          profile: profileData,
          topic
        })
      })
      const data = await response.json()
      const aiMsg: Message = {
        role: 'assistant',
        content: data.message,
        chartData: data.chartData || null,
        timestamp: new Date().toISOString()
      }
      const finalMessages = [...newMessages, aiMsg]
      setMessages(finalMessages)
      await saveMessages(finalMessages)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setLoading(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    await sendMessageWithText(text, messages, profile)
  }

  return (
    <div className="h-screen bg-black flex flex-col max-w-3xl mx-auto">
      <div className="border-b border-zinc-900 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/chats')}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors">
          ←
        </button>
        <span className="text-lg">{TOPIC_ICONS[topic] || '💬'}</span>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input ref={titleInputRef} defaultValue={chatTitle}
              onBlur={e => saveTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveTitle((e.target as HTMLInputElement).value)}
              className="bg-zinc-800 text-white rounded-lg px-2 py-1 text-sm font-semibold w-full focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          ) : (
            <button onClick={() => setEditingTitle(true)} className="text-left w-full">
              <p className="font-semibold text-sm truncate hover:text-emerald-400 transition-colors">{chatTitle}</p>
              <p className="text-xs text-zinc-600">Tap to rename</p>
            </button>
          )}
        </div>
        <button onClick={() => navigate('/dashboard')}
          className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-zinc-900 transition-colors">
          Dashboard
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 bg-emerald-400 rounded-lg flex items-center justify-center shrink-0 mt-1">
              <span className="text-black font-bold text-xs">AI</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-4">
                {[0, 150, 300].map(delay => (
                  <div key={delay} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showPrompts && messages.length <= 1 && (
        <div className="px-4 pb-3 shrink-0">
          <p className="text-xs text-zinc-600 mb-2">Suggested questions</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(QUICK_PROMPTS[topic] || QUICK_PROMPTS.general).map((prompt, i) => (
              <button key={i} onClick={() => sendMessageWithText(prompt, messages, profile)}
                className="shrink-0 text-xs bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-gray-300 hover:border-emerald-400/50 hover:text-emerald-400 transition-colors whitespace-nowrap">
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-zinc-900 px-4 py-4 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Ask anything about your finances..."
            rows={1}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-400/50 text-sm resize-none leading-relaxed"
            style={{ minHeight: '46px', maxHeight: '120px' }}
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            className="w-11 h-11 bg-emerald-400 text-black rounded-xl font-bold hover:bg-emerald-300 transition-colors disabled:opacity-40 flex items-center justify-center shrink-0">
            ↑
          </button>
        </div>
        <p className="text-xs text-zinc-700 mt-2 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
