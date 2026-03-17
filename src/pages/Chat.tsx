import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../contexts/ProfileContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Skip empty lines but add spacing
    if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: '8px' }} />)
      i++
      continue
    }

    // Bold header lines **text**
    if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
      const text = line.trim().slice(2, -2)
      elements.push(
        <p key={i} style={{
          fontSize: '13px',
          fontWeight: '700',
          color: 'var(--sand-900)',
          margin: '14px 0 6px',
          letterSpacing: '0.01em',
          textTransform: 'uppercase',
          opacity: 0.7
        }}>
          {text}
        </p>
      )
      i++
      continue
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\./)?.[1]
      const text = line.replace(/^\d+\.\s/, '')
      // Parse inline bold in text
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start' }}>
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'var(--accent)',
            color: 'var(--sand-50)',
            fontSize: '11px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '1px'
          }}>
            {num}
          </div>
          <p style={{ fontSize: '14px', lineHeight: '1.65', margin: 0, color: 'var(--sand-800)', flex: 1 }}>
            <InlineText text={text} />
          </p>
        </div>
      )
      i++
      continue
    }

    // Bullet points
    if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
      const text = line.trim().slice(2)
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
          <div style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: 'var(--accent)',
            flexShrink: 0,
            marginTop: '9px',
            opacity: 0.7
          }} />
          <p style={{ fontSize: '14px', lineHeight: '1.65', margin: 0, color: 'var(--sand-800)', flex: 1 }}>
            <InlineText text={text} />
          </p>
        </div>
      )
      i++
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={i} style={{
        fontSize: '14px',
        lineHeight: '1.7',
        margin: '0 0 8px',
        color: 'var(--sand-800)'
      }}>
        <InlineText text={line} />
      </p>
    )
    i++
  }

  return <div>{elements}</div>
}

function InlineText({ text }: { text: string }) {
  // Handle inline **bold** text
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ fontWeight: '600', color: 'var(--sand-900)' }}>{part.slice(2, -2)}</strong>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { userId, profileData: profile } = useProfile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('Chat')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialized = useRef(false)

  useEffect(() => { loadChat() }, [id])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const loadChat = async () => {
    const chatRes = await supabase.from('chats').select('*').eq('id', id).single()
    if (chatRes.data) {
      setTitle(chatRes.data.title || 'Chat')
      setMessages(chatRes.data.messages || [])

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
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message || 'Something went wrong.'
      }
      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)
      await supabase.from('chats').update({
        messages: finalMessages,
        updated_at: new Date().toISOString()
      }).eq('id', id)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.'
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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--sand-100)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '680px',
      margin: '0 auto'
    }}>

      {/* Header */}
      <div style={{
        background: 'var(--sand-50)',
        borderBottom: '0.5px solid var(--sand-300)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'var(--sand-200)',
          border: 'none',
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--sand-700)',
          fontSize: '16px',
          flexShrink: 0
        }}>←</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: '15px',
            fontWeight: '600',
            color: 'var(--sand-900)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>{title}</p>
          <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>AI Financial Advisor</p>
        </div>

        <div style={{
          width: '34px',
          height: '34px',
          background: 'var(--accent)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <span style={{ color: 'var(--sand-50)', fontSize: '11px', fontWeight: '700' }}>AI</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>

        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'var(--accent)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <span style={{ color: 'var(--sand-50)', fontSize: '18px', fontWeight: '700' }}>AI</span>
            </div>
            <p style={{ fontSize: '17px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 8px' }}>
              Your financial advisor
            </p>
            <p style={{ fontSize: '14px', color: 'var(--sand-500)', margin: '0 0 28px', lineHeight: '1.6' }}>
              Ask me anything about your finances.<br />I know your full situation.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
              {[
                'What should I do with my $4,500/month surplus?',
                'How do I optimize my investment allocation?',
                'What\'s the fastest way to grow my net worth?',
                'Should I pay off debt or invest first?'
              ].map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)}
                  style={{
                    background: 'var(--sand-50)',
                    border: '0.5px solid var(--sand-300)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--sand-700)',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s'
                  }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: '10px',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            animation: 'fadeIn 0.2s ease forwards'
          }}>

            {msg.role === 'assistant' && (
              <div style={{
                width: '30px',
                height: '30px',
                background: 'var(--accent)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px'
              }}>
                <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
              </div>
            )}

            <div style={{
              maxWidth: msg.role === 'user' ? '72%' : '85%',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--sand-50)',
              border: msg.role === 'user' ? 'none' : '0.5px solid var(--sand-300)',
              borderRadius: msg.role === 'user'
                ? '20px 20px 4px 20px'
                : '4px 20px 20px 20px',
              padding: msg.role === 'user' ? '12px 16px' : '16px 18px',
              boxShadow: msg.role === 'assistant' ? '0 1px 4px rgba(26,18,8,0.04)' : 'none'
            }}>
              {msg.role === 'user' ? (
                <p style={{
                  fontSize: '14px',
                  margin: 0,
                  color: 'var(--sand-50)',
                  lineHeight: '1.6',
                  fontWeight: '400'
                }}>
                  {msg.content}
                </p>
              ) : (
                <FormattedMessage content={msg.content} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{
            display: 'flex',
            gap: '10px',
            animation: 'fadeIn 0.2s ease forwards'
          }}>
            <div style={{
              width: '30px',
              height: '30px',
              background: 'var(--accent)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
            </div>
            <div style={{
              background: 'var(--sand-50)',
              border: '0.5px solid var(--sand-300)',
              borderRadius: '4px 20px 20px 20px',
              padding: '16px 20px',
              display: 'flex',
              gap: '6px',
              alignItems: 'center'
            }}>
              {[0, 160, 320].map(d => (
                <div key={d} style={{
                  width: '7px',
                  height: '7px',
                  background: 'var(--sand-400)',
                  borderRadius: '50%',
                  animation: 'pulse 1.4s infinite',
                  animationDelay: `${d}ms`
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
              flex: 1,
              resize: 'none',
              borderRadius: '22px',
              padding: '11px 18px',
              fontSize: '14px',
              lineHeight: '1.5',
              minHeight: '44px',
              maxHeight: '140px',
              background: 'var(--sand-200)',
              border: '0.5px solid var(--sand-300)',
              color: 'var(--sand-900)',
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: input.trim() && !loading ? 'var(--accent)' : 'var(--sand-300)',
              border: 'none',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.2s, transform 0.1s'
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
