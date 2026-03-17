import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function formatMessage(content: string) {
  return content.split('\n').map((line, i) => {
    if (line.match(/^\d+\./)) {
      const num = line.split('.')[0]
      const text = line.split('.').slice(1).join('.').trim()
      return (
        <div key={i} style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <span style={{ color: 'var(--accent)', fontWeight: '700', minWidth: '16px', fontSize: '13px' }}>{num}.</span>
          <span style={{ fontSize: '14px', lineHeight: '1.5' }}>{text}</span>
        </div>
      )
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <span style={{ color: 'var(--accent)', fontWeight: '700', marginTop: '1px' }}>·</span>
          <span style={{ fontSize: '14px', lineHeight: '1.5' }}>{line.slice(2)}</span>
        </div>
      )
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      return <p key={i} style={{ fontWeight: '700', color: 'var(--sand-900)', margin: '10px 0 4px', fontSize: '14px' }}>{line.slice(2, -2)}</p>
    }
    if (line === '') return <div key={i} style={{ height: '6px' }} />
    return <p key={i} style={{ fontSize: '14px', lineHeight: '1.6', margin: '2px 0', color: 'var(--sand-800)' }}>{line}</p>
  })
}

export default function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('Chat')
  const [profile, setProfile] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialized = useRef(false)

  useEffect(() => { loadChat() }, [id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const loadChat = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [chatRes, profileRes] = await Promise.all([
      supabase.from('chats').select('*').eq('id', id).single(),
      supabase.from('profiles').select('profile_data').eq('user_id', user.id).single()
    ])

    if (profileRes.data) setProfile(profileRes.data.profile_data)
    if (chatRes.data) {
      setTitle(chatRes.data.title || 'Chat')
      setMessages(chatRes.data.messages || [])

      if (!initialized.current && location.state?.prompt && (!chatRes.data.messages || chatRes.data.messages.length === 0)) {
        initialized.current = true
        await sendMessage(location.state.prompt, chatRes.data.messages || [], profileRes.data?.profile_data)
      }
    }
  }

  const sendMessage = async (text: string, existingMessages?: Message[], profileData?: any) => {
    const userMessage: Message = { role: 'user', content: text }
    const currentMessages = existingMessages || messages
    const newMessages = [...currentMessages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          profile: profileData || profile,
          topic: 'general'
        })
      })
      const data = await res.json()
      const assistantMessage: Message = { role: 'assistant', content: data.message || data.content || 'Something went wrong.' }
      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)
      await supabase.from('chats').update({ messages: finalMessages, updated_at: new Date().toISOString() }).eq('id', id)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand-100)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: 'var(--sand-50)', borderBottom: '0.5px solid var(--sand-300)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'var(--sand-200)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-700)', fontSize: '16px', flexShrink: 0 }}>
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--sand-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
          <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>AI Financial Advisor</p>
        </div>
        <div style={{ width: '32px', height: '32px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: 'var(--sand-50)', fontSize: '11px', fontWeight: '700' }}>AI</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '680px', width: '100%', margin: '0 auto' }}>

        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: '52px', height: '52px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span style={{ color: 'var(--sand-50)', fontSize: '16px', fontWeight: '700' }}>AI</span>
            </div>
            <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 8px' }}>Your financial advisor</p>
            <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: 0, lineHeight: '1.5' }}>Ask me anything about your finances.<br/>I know your full situation.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', animation: 'fadeIn 0.25s ease forwards' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
              </div>
            )}
            <div style={{
              maxWidth: '78%',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--sand-50)',
              border: msg.role === 'user' ? 'none' : '0.5px solid var(--sand-300)',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              padding: '12px 16px',
              color: msg.role === 'user' ? 'var(--sand-50)' : 'var(--sand-900)',
            }}>
              {msg.role === 'user'
                ? <p style={{ fontSize: '14px', margin: 0, lineHeight: '1.5', color: 'var(--sand-50)' }}>{msg.content}</p>
                : <div>{formatMessage(msg.content)}</div>
              }
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: '10px', animation: 'fadeIn 0.25s ease forwards' }}>
            <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
            </div>
            <div style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: '18px 18px 18px 4px', padding: '14px 16px', display: 'flex', gap: '5px', alignItems: 'center' }}>
              {[0, 150, 300].map(d => (
                <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ background: 'var(--sand-50)', borderTop: '0.5px solid var(--sand-300)', padding: '12px 16px 28px', position: 'sticky', bottom: 0 }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances..."
            rows={1}
            style={{ flex: 1, resize: 'none', borderRadius: '20px', padding: '10px 16px', fontSize: '14px', lineHeight: '1.5', minHeight: '42px', maxHeight: '120px', background: 'var(--sand-200)', border: '0.5px solid var(--sand-300)', color: 'var(--sand-900)', outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={handleSend} disabled={!input.trim() || loading}
            style={{ width: '42px', height: '42px', borderRadius: '50%', background: input.trim() && !loading ? 'var(--accent)' : 'var(--sand-300)', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? 'var(--sand-50)' : 'var(--sand-500)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
