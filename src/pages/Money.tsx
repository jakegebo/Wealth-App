import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../contexts/ProfileContext'

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

const QUICK_CHIPS = [
  { label: 'Passive', value: 'passive income that requires minimal ongoing effort' },
  { label: 'Skill-based', value: 'ideas that leverage my professional skills' },
  { label: 'Digital/Online', value: 'online or digital income streams' },
  { label: 'Low effort', value: 'low time commitment, under 5 hours per week' },
  { label: 'Quick start', value: 'ideas I can start earning from within 2-4 weeks' },
  { label: 'High income', value: 'highest earning potential, willing to put in more work' },
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
  const { userId, profileData: profile, chatRefs, savedIdeas, incomeIdeas, loading: profileLoading, updateProfile } = useProfile()
  const [ideas, setIdeas] = useState<any[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [activeTab, setActiveTab] = useState<'ideas' | 'saved' | 'chat'>('ideas')
  const [activeTopic, setActiveTopic] = useState('ideas')
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [ideaPrompt, setIdeaPrompt] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [refineInput, setRefineInput] = useState('')

  useEffect(() => {
    if (profileLoading) return
    if (incomeIdeas.length > 0) setIdeas(incomeIdeas)
    else if (profile) generateIdeas(profile)
  }, [profileLoading])

  const generateIdeas = async (profileData?: any, opts?: { prompt?: string; selectedIdeas?: any[]; refinement?: string; excludedIdeas?: any[] }) => {
    const p = profileData || profile
    if (!p) return
    setLoadingIdeas(true)
    setSelectedIds([])
    try {
      const res = await fetch('/api/money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_ideas',
          profile: p,
          prompt: opts?.prompt ?? ideaPrompt ?? undefined,
          selectedIdeas: opts?.selectedIdeas ?? undefined,
          refinement: opts?.refinement ?? undefined,
          excludedIdeas: opts?.excludedIdeas ?? undefined,
        })
      })
      const data = await res.json()
      const newIdeas = data.ideas || []
      setIdeas(newIdeas)
      await updateProfile({ income_ideas: newIdeas })
    } catch { }
    setLoadingIdeas(false)
  }

  const handleChip = (value: string) => {
    setIdeaPrompt(value)
    generateIdeas(undefined, { prompt: value, excludedIdeas: ideas.length > 0 ? ideas : undefined })
  }

  const toggleSelect = (i: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  const refineIdeas = () => {
    const selected = selectedIds.map(i => ideas[i])
    const refinement = refineInput.trim()
      ? refineInput.trim()
      : `More ideas similar to: ${selected.map(s => s.title).join(', ')}`
    generateIdeas(undefined, {
      prompt: ideaPrompt || undefined,
      selectedIdeas: selected,
      refinement,
    })
    setRefineInput('')
  }

  const toggleSaved = async (idea: any) => {
    const key = typeof idea === 'string' ? idea : idea.title
    const newSaved = savedIdeas.includes(key) ? savedIdeas.filter(i => i !== key) : [...savedIdeas, key]
    await updateProfile({ saved_income_ideas: newSaved })
  }

  const openIdeaChat = async (idea: any) => {
    if (!userId) return
    const ideaTitle = typeof idea === 'string' ? idea : idea.title
    const ideaDesc = typeof idea === 'string' ? '' : idea.description
    const key = `money_idea_${ideaTitle.slice(0, 30)}`
    if (chatRefs[key]) { navigate(`/chat/${chatRefs[key]}`); return }
    const { data } = await supabase.from('chats').insert({ user_id: userId, title: ideaTitle.slice(0, 40), topic: 'general', messages: [] }).select().single()
    if (data) {
      await updateProfile({ chat_refs: { ...chatRefs, [key]: data.id } })
      const prompt = `I want to do a deep dive on this income idea: "${ideaTitle}"${ideaDesc ? `\n\n${ideaDesc}` : ''}

Please give me a thorough breakdown:
1. Why this specifically fits my situation and background
2. Realistic income expectations — what I'd likely earn in month 1, month 3, month 6, and year 1
3. Barriers to entry — what makes this hard and how to get past them
4. Startup costs and capital I'd need upfront and ongoing
5. The exact 5 steps to get started this week
6. What separates people who succeed at this vs those who don't
7. Common mistakes and pitfalls to avoid`
      navigate(`/chat/${data.id}`, { state: { prompt } })
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
            {/* Prompt area */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {QUICK_CHIPS.map(chip => (
                  <button key={chip.value} onClick={() => handleChip(chip.value)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      border: ideaPrompt === chip.value ? '1.5px solid var(--accent)' : '0.5px solid var(--sand-300)',
                      background: ideaPrompt === chip.value ? 'var(--accent-light)' : 'var(--sand-50)',
                      color: ideaPrompt === chip.value ? 'var(--accent)' : 'var(--sand-700)',
                      fontSize: '12px',
                      fontWeight: ideaPrompt === chip.value ? '600' : '400',
                      cursor: loadingIdeas ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}>
                    {chip.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={ideaPrompt}
                  onChange={e => setIdeaPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generateIdeas(undefined, { excludedIdeas: ideas.length > 0 ? ideas : undefined })}
                  placeholder="What kind of income ideas are you looking for?"
                  style={{ flex: 1, borderRadius: '20px', fontSize: '13px' }}
                />
                <button onClick={() => generateIdeas(undefined, { excludedIdeas: ideas.length > 0 ? ideas : undefined })} disabled={loadingIdeas}
                  style={{ height: '38px', borderRadius: '20px', background: 'var(--accent)', border: 'none', color: 'var(--sand-50)', cursor: loadingIdeas ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: loadingIdeas ? 0.6 : 1, padding: '0 14px', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit', gap: '5px' }}>
                  <span style={{ display: 'inline-block', animation: loadingIdeas ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
                  {loadingIdeas ? 'Generating...' : 'New Ideas'}
                </button>
              </div>
            </div>

            {selectedIds.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--sand-400)', margin: '0 0 12px', textAlign: 'center' }}>
                Tap a card to select ideas and refine
              </p>
            )}

            {loadingIdeas ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} style={{ background: 'var(--sand-200)', borderRadius: 'var(--radius-md)', height: '64px', animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: selectedIds.length > 0 ? '100px' : '0' }}>
                {ideas.map((idea, i) => {
                  const title = typeof idea === 'string' ? idea : idea.title
                  const description = typeof idea === 'string' ? '' : idea.description
                  const range = typeof idea === 'string' ? '' : idea.monthly_range
                  const timeline = typeof idea === 'string' ? '' : idea.timeline
                  const effort = typeof idea === 'string' ? '' : idea.effort
                  const isSaved = savedIdeas.includes(title)
                  const isSelected = selectedIds.includes(i)
                  const effortColors: Record<string, { color: string; bg: string }> = {
                    low: { color: '#7a9e6e', bg: 'rgba(122,158,110,0.12)' },
                    medium: { color: '#c8943a', bg: 'rgba(200,148,58,0.12)' },
                    high: { color: '#c0392b', bg: 'rgba(192,57,43,0.1)' },
                  }
                  const effortStyle = effort ? effortColors[effort] : null
                  return (
                    <div key={i} className="card" onClick={e => toggleSelect(i, e)}
                      style={{
                        padding: '16px',
                        cursor: 'pointer',
                        border: isSelected ? '1.5px solid var(--accent)' : '0.5px solid var(--sand-300)',
                        background: isSelected ? 'var(--accent-light)' : 'var(--sand-50)',
                        transition: 'all 0.15s',
                        position: 'relative',
                      }}>
                      {isSelected && (
                        <div style={{ position: 'absolute', top: '10px', right: '10px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: 'var(--sand-50)', fontSize: '10px', fontWeight: '700' }}>✓</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ width: '28px', height: '28px', background: isSelected ? 'var(--accent)' : 'var(--accent-light)', border: '0.5px solid var(--accent-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: isSelected ? 'var(--sand-50)' : 'var(--accent)' }}>{i + 1}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '14px', fontWeight: description ? '600' : '400', color: 'var(--sand-900)', margin: '0 0 4px', lineHeight: '1.4' }}>{title}</p>
                          {description && (
                            <p style={{ fontSize: '13px', color: 'var(--sand-700)', margin: '0 0 8px', lineHeight: '1.5' }}>{description}</p>
                          )}
                          {(range || timeline || effortStyle) && (
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {range && (
                                <span style={{ fontSize: '11px', fontWeight: '600', color: '#7a9e6e', background: 'rgba(122,158,110,0.12)', padding: '2px 8px', borderRadius: '20px' }}>{range}</span>
                              )}
                              {timeline && (
                                <span style={{ fontSize: '11px', color: 'var(--sand-600)', background: 'var(--sand-200)', padding: '2px 8px', borderRadius: '20px' }}>{timeline}</span>
                              )}
                              {effortStyle && (
                                <span style={{ fontSize: '11px', fontWeight: '600', color: effortStyle.color, background: effortStyle.bg, padding: '2px 8px', borderRadius: '20px' }}>{effort} effort</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginTop: isSelected ? '0' : '0' }}>
                          <button onClick={e => { e.stopPropagation(); toggleSaved(idea) }}
                            style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: isSaved ? 'rgba(200,148,58,0.1)' : 'var(--sand-200)', border: 'none', cursor: 'pointer', fontSize: '15px' }}>
                            {isSaved ? '★' : '☆'}
                          </button>
                          <button onClick={e => { e.stopPropagation(); openIdeaChat(idea) }}
                            style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', color: 'var(--accent)', cursor: 'pointer', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            →
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Refine bar */}
            {selectedIds.length > 0 && !loadingIdeas && (
              <div style={{
                position: 'fixed',
                bottom: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'calc(100% - 40px)',
                maxWidth: '640px',
                background: 'var(--sand-50)',
                border: '0.5px solid var(--sand-300)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                zIndex: 100,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--sand-50)', fontSize: '10px', fontWeight: '700' }}>{selectedIds.length}</span>
                  </div>
                  <button onClick={() => setSelectedIds([])}
                    style={{ background: 'none', border: 'none', color: 'var(--sand-400)', fontSize: '13px', cursor: 'pointer', padding: '0', lineHeight: 1 }}>✕</button>
                </div>
                <input
                  value={refineInput}
                  onChange={e => setRefineInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && refineIdeas()}
                  placeholder="More like these, but…"
                  style={{ flex: 1, borderRadius: '20px', fontSize: '13px', padding: '8px 14px' }}
                />
                <button onClick={refineIdeas}
                  style={{ padding: '8px 14px', borderRadius: '20px', background: 'var(--accent)', border: 'none', color: 'var(--sand-50)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  Regenerate
                </button>
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
