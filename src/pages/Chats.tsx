import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../contexts/ProfileContext'

interface Chat {
  id: string
  title: string
  topic: string
  messages: any[]
  updated_at: string
}

const TOPIC_ICONS: Record<string, string> = {
  debt: '💳',
  retirement: '🏖️',
  investment: '📈',
  general: '💬',
  money: '💰'
}

const QUICK_TOPICS = [
  { id: 'general', label: 'General advice', icon: '💬', prompt: 'Give me a summary of my overall financial health and the most important things I should focus on right now.' },
  { id: 'debt', label: 'Debt strategy', icon: '💳', prompt: 'Help me create a detailed debt payoff strategy based on my current debts and income.' },
  { id: 'investment', label: 'Investing', icon: '📈', prompt: 'Based on my financial situation, what should I be investing in and how should I allocate my available savings?' },
  { id: 'retirement', label: 'Retirement', icon: '🏖️', prompt: 'Analyze my retirement trajectory. Am I on track? What should I do to retire earlier or more comfortably?' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function Chats() {
  const navigate = useNavigate()
  const { userId } = useProfile()
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('chats').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
      .then(({ data }) => { setChats(data || []); setLoading(false) })
  }, [userId])

  const createChat = async (topic: string, title: string, prompt: string) => {
    if (!userId) return
    const { data } = await supabase.from('chats').insert({ user_id: userId, title, topic, messages: [] }).select().single()
    if (data) navigate(`/chat/${data.id}`, { state: { prompt } })
  }

  const deleteChat = async (chatId: string) => {
    setDeleting(chatId)
    await supabase.from('chats').delete().eq('id', chatId)
    setChats(prev => prev.filter(c => c.id !== chatId))
    setDeleting(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand-100)' }}>

      {/* Header */}
      <div style={{ background: 'var(--sand-50)', borderBottom: '0.5px solid var(--sand-300)', padding: '52px 20px 16px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => navigate(-1)}
              style={{ background: 'var(--sand-200)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-700)', fontSize: '16px' }}>
              ←
            </button>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>AI Advisor</h1>
              <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0 }}>Your financial conversations</p>
            </div>
          </div>
          <div style={{ width: '36px', height: '36px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--sand-50)', fontSize: '11px', fontWeight: '700' }}>AI</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '20px' }}>

        {/* Quick Start */}
        <div style={{ marginBottom: '24px' }}>
          <p className="label" style={{ marginBottom: '10px' }}>Start a conversation</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {QUICK_TOPICS.map(topic => (
              <button key={topic.id} onClick={() => createChat(topic.id, topic.label, topic.prompt)}
                style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{topic.icon}</div>
                <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-900)', margin: 0 }}>{topic.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Chat History */}
        {!loading && chats.length > 0 && (
          <div>
            <p className="label" style={{ marginBottom: '10px' }}>Recent conversations</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {chats.map(chat => (
                <div key={chat.id} style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                  <button onClick={() => navigate(`/chat/${chat.id}`)}
                    style={{ flex: 1, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', background: 'var(--accent-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px' }}>
                      {TOPIC_ICONS[chat.topic] || '💬'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.title}</p>
                      <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>
                        {chat.messages?.length || 0} messages · {timeAgo(chat.updated_at)}
                      </p>
                    </div>
                  </button>
                  <button onClick={() => deleteChat(chat.id)}
                    style={{ padding: '14px 16px', background: 'none', border: 'none', borderLeft: '0.5px solid var(--sand-200)', cursor: 'pointer', color: deleting === chat.id ? 'var(--danger)' : 'var(--sand-400)', fontSize: '16px', transition: 'color 0.15s' }}>
                    {deleting === chat.id ? '...' : '×'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', height: '64px', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        )}

        {!loading && chats.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--sand-500)', fontSize: '14px' }}>No conversations yet. Start one above!</p>
          </div>
        )}

      </div>
    </div>
  )
}
