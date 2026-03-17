import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const TOPICS = [
  { id: 'ideas', label: 'Income Ideas', description: 'Personalized money-making ideas' },
  { id: 'surplus', label: 'Deploy Surplus', description: 'Put your extra money to work' },
  { id: 'sidehustle', label: 'Side Hustles', description: 'Fast ways to earn more' },
  { id: 'passive', label: 'Passive Income', description: 'Build income while you sleep' },
]

function formatContent(content: string) {
  return content.split('\n').map((line, i) => {
    if (line.match(/^\d+\./)) {
      const num = line.split('.')[0]
      const text = line.split('.').slice(1).join('.').trim()
      return (
        <div key={i} style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <span style={{ color: 'var(--accent)', fontWeight: '700', minWidth: '16px', fontSize: '13px' }}>{num}.</span>
          <span style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--sand-800)' }}>{text}</span>
        </div>
      )
    }
    if (line.startsWith('- ') || line.startsWith('• ')) return (
      <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <span style={{ color: 'var(--accent)', fontWeight: '700' }}>·</span>
        <span style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--sand-800)' }}>{line.slice(2)}</span>
      </div>
    )
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ fontWeight: '700', color: 'var(--sand-900)', margin: '10px 0 4px', fontSize: '14px' }}>{line.slice(2, -2)}</p>
    if (line === '') return <div key={i} style={{ height: '6px' }} />
    return <p key={i} style={{ fontSize: '14px', lineHeight: '1.6', margin: '2px 0', color: 'var(--sand-800)' }}>{line}</p>
  })
}

export default function Money() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [ideas, setIdeas] = useState<string[]>([])
  const [savedIdeas, setSavedIdeas] = useState<string[]>([])
  const [chatRefs, setChatRefs] = useState<Record<string, string>>({})
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [activeTab, setActiveTab] = useState<'ideas' | 'saved' | 'chat'>('ideas')
  const [activeTopic, setActiveTopic] = useState('ideas')
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (data) {
      setProfile(data.profile_data)
      setSavedIdeas(data.saved_income_ideas || [])
      setChatRefs(data.chat_refs || {})
      if (data.income_ideas?.length > 0) setIdeas(data.income_ideas)
      else generateIdeas(data.profile_data)
    }
  }

  const generateIdeas = async (profileData?: any) => {
    const p = profileData || profile
    if (!p) return
    setLoadingIdeas(true)
    try {
      const res = await fetch('/api/money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_ideas', profile: p })
      })
      const data = await res.json()
      const newIdeas = data.ideas || []
      setIdeas(newIdeas)
      if (userId) await supabase.from('profiles').update({ income_ideas: newIdeas }).eq('user_id', userId)
    } catch { }
    setLoadingIdeas(false)
  }

  const toggleSaved = async (idea: string) => {
    const newSaved = savedIdeas.includes(idea) ? savedIdeas.filter(i => i !== idea) : [...savedIdeas, idea]
    setSavedIdeas(newSaved)
    if (userId) await supabase.from('profiles').update({ saved_income_ideas: newSaved }).eq('user_id', userId)
  }

  const openIdeaChat = async (idea: string) => {
    if (!userId) return
    const key = `money_idea_${idea.slice(0, 30)}`
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data } = await supabase.from('chats').insert({ user_id: userId, title: idea.slice(0, 40), topic: 'general', messages: [] }).select().single()
    if (data) {
      const newRefs = { ...chatRefs, [key]: data.id }
      setChatRefs(newRefs)
      await supabase.from('profiles').update({ chat_refs: newRefs }).eq('user_id', userId)
      navigate(`/chat/${data.id}`, { state: { prompt: `I want to explore this income idea: "${idea}". Give me: 1) Realistic income potential, 2) Time to first dollar, 3) Exact steps to start, 4) Skills/resources needed.` } })
    }
  }

  const startTopicChat = (topic: string) => {
    setActiveTopic(topic)
    setActiveTab('chat')
    const intros: Record<string, string> = {
      surplus: `You have extra money each month. Let's make sure every dollar is working as hard as possible. What's your priority — building wealth faster, passive income, or reducing risk?`,
      sidehustle: `Let's find you a side hustle that fits your life. What matters most — highest earning potential, fastest to start, or most aligned with your existing skills?`,
      passive: `Passive income takes either time or capital to build. Let's figure out the best strategy for your situation. What's your timeline?`,
      ideas: `I'm your make-money strategist. What kind of income are you most interested in — something to start quickly, something that scales, or long-term wealth building?`
    }
    setChatMessages([{ role: 'assistant', content: intros[topic] || intros.ideas }])
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: Message = { role: 'user', content: chatInput.trim() }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', profile, messages: newMessages, topic: activeTopic })
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setChatLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand-100)' }}>

      {/* Header */}
      <div style={{ background: 'var(--sand-50)', borderBottom: '0.5px solid var(--sand-300)', padding: '52px 20px 0' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <button onClick={() => navigate(-1)}
              style={{ background: 'var(--sand-200)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sand-700)', fontSize: '16px' }}>←</button>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--sand-900)' }}>Make Money</h1>
              <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0 }}>Income ideas & strategies</p>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex' }}>
            {[
              { id: 'ideas', label: 'Ideas' },
              { id: 'saved', label: `Saved (${savedIdeas.length})` },
              { id: 'chat', label: 'Strategist' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === tab.id ? 'var(--accent)' : 'var(--sand-500)', fontSize: '13px', fontWeight: activeTab === tab.id ? '600' : '400', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '20px' }}>

        {/* Ideas */}
        {activeTab === 'ideas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: 0 }}>Personalized for your situation</p>
              <button onClick={() => generateIdeas()} disabled={loadingIdeas} className="btn-ghost"
                style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ display: 'inline-block', animation: loadingIdeas ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
                {loadingIdeas ? 'Generating...' : 'Refresh'}
              </button>
            </div>

            {loadingIdeas ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', height: '64px', animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ideas.map((idea, i) => (
                  <div key={i} className="card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '28px', height: '28px', background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)' }}>{i + 1}</span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--sand-900)', margin: 0, lineHeight: '1.5', flex: 1 }}>{idea}</p>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => toggleSaved(idea)}
                        style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: savedIdeas.includes(idea) ? 'rgba(200,148,58,0.1)' : 'var(--sand-200)', border: 'none', cursor: 'pointer', fontSize: '15px' }}>
                        {savedIdeas.includes(idea) ? '⭐' : '☆'}
                      </button>
                      <button onClick={() => openIdeaChat(idea)}
                        style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', color: 'var(--accent)', cursor: 'pointer', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Saved */}
        {activeTab === 'saved' && (
          <div>
            {savedIdeas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>⭐</div>
                <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 6px' }}>No saved ideas yet</p>
                <p style={{ fontSize: '13px', color: 'var(--sand-500)', margin: '0 0 16px' }}>Star ideas from the Ideas tab to save them here</p>
                <button onClick={() => setActiveTab('ideas')} className="btn-primary" style={{ padding: '8px 20px' }}>Browse ideas</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: '0 0 4px' }}>{savedIdeas.length} saved idea{savedIdeas.length !== 1 ? 's' : ''}</p>
                {savedIdeas.map((idea, i) => (
                  <div key={i} className="card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '28px', height: '28px', background: 'rgba(200,148,58,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>⭐</div>
                    <p style={{ fontSize: '14px', color: 'var(--sand-900)', margin: 0, lineHeight: '1.5', flex: 1 }}>{idea}</p>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => toggleSaved(idea)}
                        style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--sand-200)', border: 'none', cursor: 'pointer', color: 'var(--sand-500)', fontSize: '14px' }}>
                        ✕
                      </button>
                      <button onClick={() => openIdeaChat(idea)}
                        style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', color: 'var(--accent)', cursor: 'pointer', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat */}
        {activeTab === 'chat' && (
          <div>
            {chatMessages.length === 0 ? (
              <div>
                <p style={{ fontSize: '13px', color: 'var(--sand-500)', marginBottom: '12px' }}>Choose a focus to get started</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {TOPICS.map(topic => (
                    <button key={topic.id} onClick={() => startTopicChat(topic.id)}
                      className="card"
                      style={{ textAlign: 'left', cursor: 'pointer', border: '0.5px solid var(--sand-300)', background: 'var(--sand-50)', padding: '16px' }}>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--sand-900)', margin: '0 0 4px' }}>{topic.label}</p>
                      <p style={{ fontSize: '12px', color: 'var(--sand-500)', margin: 0 }}>{topic.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--sand-700)', margin: 0 }}>
                    {TOPICS.find(t => t.id === activeTopic)?.label}
                  </p>
                  <button onClick={() => setChatMessages([])} className="btn-ghost" style={{ fontSize: '11px' }}>New topic</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px', maxHeight: '55vh', overflowY: 'auto' }}>
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                      {msg.role === 'assistant' && (
                        <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                          <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
                        </div>
                      )}
                      <div style={{ maxWidth: '80%', background: msg.role === 'user' ? 'var(--accent)' : 'var(--sand-50)', border: msg.role === 'user' ? 'none' : '0.5px solid var(--sand-300)', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '12px 16px' }}>
                        {msg.role === 'user'
                          ? <p style={{ fontSize: '14px', margin: 0, color: 'var(--sand-50)', lineHeight: '1.5' }}>{msg.content}</p>
                          : <div>{formatContent(msg.content)}</div>
                        }
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'var(--sand-50)', fontSize: '9px', fontWeight: '700' }}>AI</span>
                      </div>
                      <div style={{ background: 'var(--sand-50)', border: '0.5px solid var(--sand-300)', borderRadius: '18px 18px 18px 4px', padding: '14px 16px', display: 'flex', gap: '5px' }}>
                        {[0,150,300].map(d => <div key={d} style={{ width: '6px', height: '6px', background: 'var(--sand-400)', borderRadius: '50%', animation: 'pulse 1.2s infinite', animationDelay: `${d}ms` }} />)}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Ask about making money..."
                    style={{ flex: 1, borderRadius: '20px' }}
                  />
                  <button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}
                    style={{ width: '42px', height: '42px', borderRadius: '50%', background: chatInput.trim() ? 'var(--accent)' : 'var(--sand-300)', border: 'none', cursor: chatInput.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={chatInput.trim() ? 'var(--sand-50)' : 'var(--sand-500)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
