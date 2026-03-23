import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../contexts/ProfileContext'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { Zap } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler)

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const CHART_COLORS = ['#7a9e6e', '#4a6a3e', '#c0503b', '#6a8aae', '#c8a84a', '#8e7aae', '#a0bfa0', '#e8784c']

function ChartBlock({ raw }: { raw: string }) {
  try {
    const config = JSON.parse(raw.trim())
    const { type, title, labels, data, datasets } = config
    if (!type || !labels) return null

    const isMulti = Array.isArray(datasets) && datasets.length > 0

    const chartData = {
      labels,
      datasets: isMulti
        ? datasets.map((ds: any, i: number) => ({
            label: ds.label || '',
            data: ds.data || [],
            borderColor: CHART_COLORS[i % CHART_COLORS.length],
            backgroundColor: type === 'line'
              ? `${CHART_COLORS[i % CHART_COLORS.length]}20`
              : CHART_COLORS[i % CHART_COLORS.length],
            fill: type === 'line' && i === 0,
            tension: 0.4,
            pointRadius: 3,
            borderWidth: 2,
          }))
        : [{
            label: title || '',
            data: data || [],
            backgroundColor: type === 'doughnut'
              ? CHART_COLORS.slice(0, (data || []).length)
              : CHART_COLORS.map(c => c + 'CC'),
            borderColor: type === 'doughnut' ? '#f7f2ec' : CHART_COLORS,
            borderWidth: type === 'doughnut' ? 2 : 0,
            borderRadius: type === 'bar' ? 5 : 0,
          }]
    }

    const opts: any = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: type === 'doughnut' || isMulti,
          labels: { color: '#9e8e7e', font: { size: 11 }, usePointStyle: true, padding: 14 }
        },
        title: {
          display: !!title,
          text: title,
          color: '#2a1a08',
          font: { size: 13, weight: '600' },
          padding: { bottom: 12 }
        },
        tooltip: {
          backgroundColor: '#f2ede6',
          borderColor: '#ddd4c4',
          borderWidth: 1,
          titleColor: '#1a1208',
          bodyColor: '#7a6a5a',
          padding: 10,
          callbacks: {
            label: (ctx: any) => {
              const val = ctx.parsed?.y ?? ctx.parsed
              if (typeof val === 'number' && Math.abs(val) >= 100) return ` $${val.toLocaleString()}`
              return ` ${typeof val === 'number' ? val.toLocaleString() : val}`
            }
          }
        }
      },
      ...(type !== 'doughnut' && {
        scales: {
          x: {
            ticks: { color: '#9e8e7e', font: { size: 10 }, maxTicksLimit: 8 },
            grid: { color: '#ede8e3' }
          },
          y: {
            ticks: {
              color: '#9e8e7e',
              font: { size: 10 },
              callback: (v: any) => {
                if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
                if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`
                return `${v}`
              }
            },
            grid: { color: '#ede8e3' }
          }
        }
      })
    }

    return (
      <div style={{
        background: 'var(--sand-100)',
        border: '0.5px solid var(--sand-300)',
        borderRadius: '14px',
        padding: '16px 16px 10px',
        margin: '10px 0',
      }}>
        <div style={{ height: type === 'doughnut' ? '210px' : '240px' }}>
          {type === 'bar' && <Bar data={chartData} options={opts} />}
          {type === 'line' && <Line data={chartData} options={opts} />}
          {type === 'doughnut' && <Doughnut data={chartData} options={opts} />}
        </div>
      </div>
    )
  } catch {
    return null
  }
}

function InlineText({ text }: { text: string }) {
  // Match **bold**, *italic*, `code` — bold first to avoid partial matches
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
          return <strong key={i} style={{ fontWeight: '700', color: 'var(--sand-900)' }}>{part.slice(2, -2)}</strong>
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
          return <em key={i} style={{ fontStyle: 'italic', color: 'var(--sand-700)' }}>{part.slice(1, -1)}</em>
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
          return <code key={i} style={{ fontFamily: 'monospace', background: 'var(--sand-200)', padding: '1px 5px', borderRadius: '4px', fontSize: '12px', color: 'var(--sand-800)' }}>{part.slice(1, -1)}</code>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function renderSectionHeader(key: number, text: string) {
  return (
    <p key={key} style={{
      fontSize: '11px', fontWeight: '700', color: 'var(--accent)',
      margin: '20px 0 8px', letterSpacing: '0.07em', textTransform: 'uppercase',
      borderLeft: '3px solid var(--accent)', paddingLeft: '10px', lineHeight: '1.4'
    }}>
      <InlineText text={text} />
    </p>
  )
}

function renderCTA(key: number, label: string, body?: string) {
  return (
    <div key={key} style={{ margin: '20px 0 10px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'var(--accent)', borderRadius: '12px 12px 0 0',
        padding: '10px 16px'
      }}>
        <Zap size={16} strokeWidth={1.5} color="var(--sand-50)" style={{ flexShrink: 0 }} />
        <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--sand-50)', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </p>
      </div>
      {body && (
        <div style={{ background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '12px 16px' }}>
          <p style={{ fontSize: '14px', lineHeight: '1.65', margin: 0, color: 'var(--sand-900)', fontWeight: '500' }}>
            <InlineText text={body} />
          </p>
        </div>
      )}
    </div>
  )
}

function TextBlock({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Empty line
    if (trimmed === '' || trimmed === '---') {
      elements.push(<div key={i} style={{ height: trimmed === '---' ? 0 : '6px', borderTop: trimmed === '---' ? '0.5px solid var(--sand-200)' : 'none', margin: trimmed === '---' ? '12px 0' : 0 }} />)
      i++; continue
    }

    // CTA: any line that begins with **Your move (case-insensitive)
    if (/^\*\*your move/i.test(trimmed)) {
      // collect body: if content after the closing ** on same line, use it; else peek next line
      const inlineBody = trimmed.replace(/^\*\*[^*]+\*\*:?\s*/i, '').trim()
      const label = (trimmed.match(/^\*\*([^*]+)\*\*/)?.[1] || 'Your move today').replace(/:$/, '')
      let body = inlineBody
      if (!body && lines[i + 1]?.trim()) { body = lines[i + 1].trim(); i++ }
      elements.push(renderCTA(i, label, body || undefined))
      i++; continue
    }

    // ### or ## markdown headers
    if (/^#{2,3}\s/.test(trimmed)) {
      const text = trimmed.replace(/^#{2,3}\s+/, '')
      elements.push(renderSectionHeader(i, text))
      i++; continue
    }

    // **Header** — standalone bold line (entire line is bold)
    if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4 && !trimmed.slice(2, -2).includes('**')) {
      elements.push(renderSectionHeader(i, trimmed.slice(2, -2)))
      i++; continue
    }

    // Numbered list item
    if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\./)?.[1]
      const text = trimmed.replace(/^\d+\.\s+/, '')
      elements.push(
        <div key={i} style={{
          display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start',
          background: 'var(--sand-100)', borderRadius: '12px', padding: '10px 12px',
          border: '0.5px solid var(--sand-200)'
        }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent)', color: 'var(--sand-50)', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
            {num}
          </div>
          <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0, color: 'var(--sand-800)', flex: 1 }}>
            <InlineText text={text} />
          </p>
        </div>
      )
      i++; continue
    }

    // Bullet point (- or • or *)
    if (/^[-•]\s/.test(trimmed)) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '6px', alignItems: 'flex-start' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: '10px', opacity: 0.7 }} />
          <p style={{ fontSize: '14px', lineHeight: '1.65', margin: 0, color: 'var(--sand-800)', flex: 1 }}>
            <InlineText text={trimmed.slice(2)} />
          </p>
        </div>
      )
      i++; continue
    }

    // Plain paragraph
    elements.push(
      <p key={i} style={{ fontSize: '14px', lineHeight: '1.75', margin: '0 0 8px', color: 'var(--sand-800)' }}>
        <InlineText text={trimmed} />
      </p>
    )
    i++
  }

  return <div>{elements}</div>
}

function FormattedMessage({ content }: { content: string }) {
  // Strip any raw <followups> tags that may be stored in old messages
  const cleaned = content.replace(/<followups>[\s\S]*?<\/followups>/g, '').trim()
  // Split content into text and chart blocks
  const parts = cleaned.split(/(<chart>[\s\S]*?<\/chart>)/g)
  return (
    <div>
      {parts.map((part, i) => {
        if (part.startsWith('<chart>') && part.endsWith('</chart>')) {
          return <ChartBlock key={i} raw={part.slice(7, -8)} />
        }
        if (!part.trim()) return null
        return <TextBlock key={i} content={part} />
      })}
    </div>
  )
}

export default function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { userId, profileData: profile, analysis } = useProfile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('Chat')
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialized = useRef(false)

  useEffect(() => { initialized.current = false; loadChat() }, [id])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const loadChat = async () => {
    const chatRes = await supabase.from('chats').select('*').eq('id', id).single()
    if (chatRes.data) {
      setTitle(chatRes.data.title || 'Chat')
      // Strip any <followups> tags from stored messages (from older saves)
      const cleanedMessages = (chatRes.data.messages || []).map((m: Message) =>
        m.role === 'assistant'
          ? { ...m, content: m.content.replace(/<followups>[\s\S]*?<\/followups>/g, '').trim() }
          : m
      )
      setMessages(cleanedMessages)
      if (!initialized.current && location.state?.prompt &&
        (!chatRes.data.messages || chatRes.data.messages.length === 0)) {
        initialized.current = true
        await sendMessage(location.state.prompt, chatRes.data.messages || [], profile)
      }
    }
  }

  const sendMessage = async (text: string, existingMessages?: Message[], profileData?: any) => {
    const userMessage: Message = { role: 'user', content: text }
    const currentMessages = existingMessages || messages
    const newMessages = [...currentMessages, userMessage]
    setMessages(newMessages)
    setInput('')
    setFollowUpQuestions([])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          profile: profileData || profile || {},
          topic: 'general'
        })
      })
      const data = await res.json()
      let rawContent = data.message || 'Something went wrong. Please try again.'

      // Parse and strip follow-up questions from the response
      const followupMatch = rawContent.match(/<followups>([\s\S]*?)<\/followups>/)
      if (followupMatch) {
        try {
          const parsed = JSON.parse(followupMatch[1].trim())
          if (Array.isArray(parsed)) { setFollowUpQuestions(parsed.slice(0, 3)); setExpandedFollowUps(new Set()) }
        } catch {}
        rawContent = rawContent.replace(/<followups>[\s\S]*?<\/followups>/g, '').trim()
      }

      const assistantMessage: Message = { role: 'assistant', content: rawContent }
      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)
      await supabase.from('chats').update({
        messages: finalMessages,
        updated_at: new Date().toISOString()
      }).eq('id', id)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please check your connection and try again.'
      }])
    }
    setLoading(false)
  }

  const handleSend = () => {
    if (!input.trim() || loading) return
    sendMessage(input.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Smart suggested questions built from actual profile data
  const getSuggestedQuestions = (): string[] => {
    const questions: string[] = []
    const totalDebts = profile?.debts?.reduce((s: number, d: any) => s + (d.balance || 0), 0) || 0
    const highIntDebt = profile?.debts?.sort((a: any, b: any) => (b.interest_rate || 0) - (a.interest_rate || 0))?.[0]
    const availableToSave = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)
    const totalAssets = profile?.assets?.reduce((s: number, a: any) => s + (a.value || 0), 0) || 0
    const topGoal = profile?.goals?.[0]

    if (highIntDebt && (highIntDebt.interest_rate || 0) > 10) {
      questions.push(`Build me a payoff plan for my ${highIntDebt.name} at ${highIntDebt.interest_rate}% — include a chart showing when I'll be debt-free.`)
    }
    if (availableToSave > 200) {
      const fmt = (n: number) => `$${n.toLocaleString()}`
      questions.push(`I have ${fmt(availableToSave)}/month to work with. Show me exactly how to split it between investing, emergency fund, and debt with a breakdown chart.`)
    }
    if (totalAssets > 1000) {
      questions.push(`Analyze my asset allocation and show me a chart comparing it to an optimal mix for my situation and timeline.`)
    }
    if (topGoal) {
      questions.push(`Am I on track to hit my "${topGoal.name}" goal? Show me a projection chart with different savings scenarios.`)
    }

    // Smart defaults if not enough personalized questions
    const defaults = [
      'Give me a complete financial health check with charts — where am I strong and where do I need work?',
      'Build me a 3-year net worth projection chart based on my current trajectory vs. if I optimize now.',
      'What are the 3 highest-impact financial moves I can make in the next 90 days?',
      'How should I be thinking about taxes and retirement accounts given my income and situation?',
    ]

    for (const d of defaults) {
      if (questions.length >= 4) break
      questions.push(d)
    }

    return questions.slice(0, 4)
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  const netWorth = analysis ? (analysis.netWorth ?? (analysis.totalAssets - analysis.totalLiabilities)) : null
  const availableToSave = analysis?.availableToSave ?? ((profile?.monthly_income || 0) - (profile?.monthly_expenses || 0))

  return (
    <div style={{
      height: '100vh',
      background: 'var(--sand-100)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '680px',
      margin: '0 auto',
      paddingBottom: '68px',
    }}>

      {/* Header */}
      <div style={{
        background: 'var(--sand-50)',
        borderBottom: '0.5px solid var(--sand-300)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backdropFilter: 'blur(12px)'
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'var(--sand-200)', border: 'none', width: '34px', height: '34px',
          borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--sand-700)', fontSize: '16px', flexShrink: 0
        }}>←</button>

        <div style={{
          width: '36px', height: '36px', background: 'var(--accent)', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 2px 8px rgba(74,106,62,0.25)'
        }}>
          <span style={{ color: 'var(--sand-50)', fontSize: '11px', fontWeight: '700' }}>AI</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: '15px', fontWeight: '600', color: 'var(--sand-900)', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>{title}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: loading ? 'var(--sand-400)' : '#5a9e4a',
              animation: loading ? 'pulse 1.4s infinite' : 'none',
              transition: 'background 0.3s'
            }} />
            <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>
              {loading ? 'Thinking...' : 'Financial Advisor'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '24px 16px',
        display: 'flex', flexDirection: 'column', gap: '20px'
      }}>

        {messages.length === 0 && !loading && (
          <div style={{ padding: '8px 4px' }}>

            {/* AI avatar + intro */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '64px', height: '64px', background: 'var(--accent)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
              }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '20px', fontWeight: '700' }}>AI</span>
              </div>
              <p style={{ fontSize: '19px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
                Your financial advisor
              </p>
              <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: 0, lineHeight: '1.6' }}>
                I know your full financial picture — assets, debts, goals, income.<br />
                Ask me anything and I'll give you specific, actionable advice with charts.
              </p>
            </div>

            {/* Key stats snapshot */}
            {netWorth !== null && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '24px' }}>
                {[
                  { label: 'Net Worth', value: fmt(netWorth), color: netWorth >= 0 ? 'var(--sand-900)' : 'var(--danger)' },
                  { label: 'Monthly Save', value: fmt(availableToSave), color: availableToSave > 0 ? 'var(--success)' : 'var(--danger)' },
                  { label: 'Total Assets', value: fmt(analysis?.totalAssets || 0), color: 'var(--sand-900)' },
                ].map((stat, i) => (
                  <div key={i} style={{
                    background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)',
                    borderRadius: '12px', padding: '12px', textAlign: 'center'
                  }}>
                    <p style={{ fontSize: '10px', color: 'var(--sand-500)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '500' }}>{stat.label}</p>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: stat.color, margin: 0 }}>{stat.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Smart suggested prompts */}
            <p style={{ fontSize: '11px', color: 'var(--sand-400)', margin: '0 0 10px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Suggested
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {getSuggestedQuestions().map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)} style={{
                  background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)',
                  borderRadius: '14px', padding: '13px 16px', textAlign: 'left',
                  cursor: 'pointer', fontSize: '13px', color: 'var(--sand-700)',
                  fontFamily: 'inherit', transition: 'all 0.15s', lineHeight: '1.45'
                }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1 && !loading
          return (
            <div key={i}>
              <div style={{
                display: 'flex', gap: '10px',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                animation: 'fadeIn 0.2s ease forwards'
              }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: '30px', height: '30px', background: 'var(--accent)', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px'
                  }}>
                    <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
                  </div>
                )}

                <div style={{
                  maxWidth: msg.role === 'user' ? '72%' : '90%',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--sand-50)',
                  border: msg.role === 'user' ? 'none' : '0.5px solid var(--sand-300)',
                  borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '4px 20px 20px 20px',
                  padding: msg.role === 'user' ? '12px 16px' : '16px 18px',
                  boxShadow: msg.role === 'assistant' ? '0 2px 14px rgba(26,18,8,0.09)' : 'none'
                }}>
                  {msg.role === 'user'
                    ? <p style={{ fontSize: '14px', margin: 0, color: 'var(--sand-50)', lineHeight: '1.6' }}>{msg.content}</p>
                    : <FormattedMessage content={msg.content} />
                  }
                </div>
              </div>

              {/* Follow-up question chips after last AI message */}
              {isLastAssistant && followUpQuestions.length > 0 && (
                <div style={{
                  marginTop: '12px', marginLeft: '40px',
                  display: 'flex', flexDirection: 'column', gap: '7px',
                  animation: 'fadeIn 0.3s ease forwards'
                }}>
                  <p style={{
                    fontSize: '10px', color: 'var(--sand-400)', margin: '0 0 2px',
                    fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase'
                  }}>
                    Ask next
                  </p>
                  {followUpQuestions.map((q, qi) => (
                    <button
                      key={qi}
                      onClick={() => sendMessage(q)}
                      style={{
                        background: 'var(--sand-50)',
                        border: '0.5px solid var(--sand-300)',
                        borderRadius: '20px',
                        padding: '9px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: 'var(--sand-700)',
                        fontFamily: 'inherit',
                        lineHeight: '1.4',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        transition: 'all 0.15s',
                        boxShadow: '0 1px 3px rgba(26,18,8,0.04)',
                        width: '100%',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--sand-100)'
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--sand-50)'
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--sand-300)'
                      }}
                    >
                      <span style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        background: 'var(--accent)', color: 'var(--sand-50)',
                        fontSize: '10px', fontWeight: '700', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        marginTop: '1px',
                      }}>↗</span>
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {loading && (
          <div style={{ display: 'flex', gap: '10px', animation: 'fadeIn 0.2s ease forwards' }}>
            <div style={{
              width: '30px', height: '30px', background: 'var(--accent)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
            </div>
            <div style={{
              background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)',
              borderRadius: '4px 20px 20px 20px', padding: '16px 20px',
              display: 'flex', gap: '6px', alignItems: 'center'
            }}>
              {[0, 160, 320].map(d => (
                <div key={d} style={{
                  width: '7px', height: '7px', background: 'var(--sand-400)', borderRadius: '50%',
                  animation: 'pulse 1.4s infinite', animationDelay: `${d}ms`
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        background: 'var(--sand-50)',
        borderTop: '0.5px solid var(--sand-300)',
        padding: '12px 16px 32px',
        position: 'sticky',
        bottom: 0
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances..."
            rows={1}
            style={{
              flex: 1, resize: 'none', borderRadius: '22px', padding: '11px 18px',
              fontSize: '14px', lineHeight: '1.5', minHeight: '44px', maxHeight: '140px',
              background: 'var(--sand-200)', border: '0.5px solid var(--sand-300)',
              color: 'var(--sand-900)', outline: 'none', fontFamily: 'inherit',
              transition: 'border-color 0.2s'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: input.trim() && !loading ? 'var(--accent)' : 'var(--sand-300)',
              border: 'none',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.2s, transform 0.1s'
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={input.trim() && !loading ? 'var(--sand-50)' : 'var(--sand-500)'}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
